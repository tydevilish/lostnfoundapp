import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const TOKEN_NAME = "lf_token";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

async function getAuthUser() {
  const token = cookies().get(TOKEN_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    return { id: payload.sub };
  } catch {
    return null;
  }
}

function normalizeItemForClient(item, userId) {
  const statusLower = String(item.status || "").toLowerCase(); // "open" | "resolved"
  const isMine = item.createdById === userId;
  const reporterName =
    `${item.createdBy?.firstName ?? ""} ${item.createdBy?.lastName ?? ""}`.trim() ||
    item.createdBy?.email?.split("@")[0] ||
    "ฉัน";
  return { ...item, isMine, reporterName, statusLower };
}

export async function GET(_req, ctx) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await ctx.params; // ตามสไตล์ที่คุณใช้
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing id" },
        { status: 400 }
      );
    }

    const item = await prisma.foundItem.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
    });
    if (!item) {
      return NextResponse.json(
        { success: false, message: "Not found" },
        { status: 404 }
      );
    }
    if (item.createdById !== user.id) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: true, item: normalizeItemForClient(item, user.id) },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req, ctx) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing id" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const nextStatus = String(body?.status || "").toUpperCase(); // OPEN | RESOLVED
    if (!["OPEN", "RESOLVED"].includes(nextStatus)) {
      return NextResponse.json(
        { success: false, message: "Invalid status" },
        { status: 400 }
      );
    }

    const owned = await prisma.foundItem.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!owned) {
      return NextResponse.json(
        { success: false, message: "Not found" },
        { status: 404 }
      );
    }
    if (owned.createdById !== user.id) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const updated = await prisma.foundItem.update({
      where: { id },
      data: { status: nextStatus },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json(
      { success: true, item: normalizeItemForClient(updated, user.id) },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
