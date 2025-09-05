export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, TOKEN_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function POST(req) {
  try {
    const token = cookies().get(TOKEN_NAME)?.value;
    if (!token)
      return NextResponse.json(
        { success: false, message: "unauthorized" },
        { status: 401 }
      );

    const payload = await verifyToken(token);
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, message: "ไม่พบไฟล์" },
        { status: 400 }
      );
    }

    // จำกัดขนาด ~ 5MB
    const max = 5 * 1024 * 1024;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > max) {
      return NextResponse.json(
        { success: false, message: "ไฟล์ใหญ่เกิน 5MB" },
        { status: 400 }
      );
    }

    // กำหนดโฟลเดอร์ปลายทาง
    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(uploadDir, { recursive: true });

    // ตั้งชื่อไฟล์
    const orig = file.name || "avatar.png";
    const ext = path.extname(orig) || mimeToExt(file.type);
    const filename = `${payload.sub}_${Date.now()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    await writeFile(filepath, buffer);

    const url = `/uploads/avatars/${filename}`;

    const user = await prisma.user.update({
      where: { email: payload.email },
      data: { avatarUrl: url },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ success: true, url, user });
  } catch (e) {
    console.error("AVATAR_UPLOAD_ERR", e);
    return NextResponse.json(
      { success: false, message: "server error" },
      { status: 500 }
    );
  }
}

function mimeToExt(type) {
  if (!type) return ".png";
  if (type.includes("jpeg")) return ".jpg";
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  return ".png";
}
