// app/api/user/avatar/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, TOKEN_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** แปลงไฟล์ภาพจาก FormData ให้เป็น Data URL (base64) */
async function fileToDataUrl(file) {
  if (!file || typeof file === "string") throw new Error("ไม่พบไฟล์");
  // จำกัดขนาด 5MB
  const MAX = 5 * 1024 * 1024;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX) throw new Error("ไฟล์ใหญ่เกิน 5MB");
  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/")) throw new Error("รองรับเฉพาะไฟล์รูปภาพเท่านั้น");
  const b64 = buf.toString("base64");
  return `data:${mime};base64,${b64}`;
}

export async function POST(req) {
  try {
    const token = cookies().get(TOKEN_NAME)?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
    }
    const payload = await verifyToken(token).catch(() => null);
    if (!payload?.email) {
      return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
    }

    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let dataUrl = "";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") || form.get("avatar");
      dataUrl = await fileToDataUrl(file);
    } else if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const raw = String(body?.dataUrl || "");
      if (!raw.startsWith("data:image/")) {
        return NextResponse.json({ success: false, message: "รูปแบบ dataUrl ไม่ถูกต้อง" }, { status: 400 });
      }
      // (อาจตรวจขนาดโดยนับตัวอักษร base64 + คูณ 3/4 เพื่อจำกัด ~5MB)
      dataUrl = raw;
    } else {
      return NextResponse.json(
        { success: false, message: "กรุณาส่งเป็น multipart/form-data หรือ JSON" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { email: payload.email },
      data: { avatarUrl: dataUrl },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true },
    });

    return NextResponse.json({ success: true, url: dataUrl, user });
  } catch (e) {
    console.error("AVATAR_UPLOAD_ERR", e);
    return NextResponse.json({ success: false, message: e?.message || "server error" }, { status: 500 });
  }
}
