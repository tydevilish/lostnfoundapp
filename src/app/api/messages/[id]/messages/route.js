import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const TOKEN_NAME = "lf_token";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return { id: payload.sub };
  } catch { return null; }
}

// GET messages (cursor-based, ใหม่->เก่า แล้วค่อยกลับลำดับให้เก่า->ใหม่)
export async function GET(req, ctx) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success:false, message:"Unauthorized" }, { status:401 });

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ success:false, message:"Missing id" }, { status:400 });

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 100);
    const cursor = url.searchParams.get("cursor"); // ISO datetime

    const member = await prisma.conversationMember.findFirst({ where: { conversationId: id, userId: user.id }, select: { id: true }});
    if (!member) return NextResponse.json({ success:false, message:"Forbidden" }, { status:403 });

    const where = { conversationId: id, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) };

    const rows = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: { id:true, senderId:true, type:true, text:true, attachments:true, createdAt:true }
    });

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? slice[slice.length - 1].createdAt.toISOString() : null;

    // แสดงแบบเก่า->ใหม่
    const messages = slice.reverse();

    return NextResponse.json({ success:true, messages, nextCursor }, { status:200 });
  } catch(e) {
    console.error(e);
    return NextResponse.json({ success:false, message:"Server error" }, { status:500 });
  }
}

// POST send message (text/attachments URL)
export async function POST(req, ctx) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success:false, message:"Unauthorized" }, { status:401 });

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ success:false, message:"Missing id" }, { status:400 });

    const member = await prisma.conversationMember.findFirst({ where: { conversationId: id, userId: user.id }, select: { id: true }});
    if (!member) return NextResponse.json({ success:false, message:"Forbidden" }, { status:403 });

    const body = await req.json().catch(() => ({}));
    const text = (body?.text || "").toString().trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments.map(String) : [];

    if (!text && attachments.length === 0) {
      return NextResponse.json({ success:false, message:"Empty message" }, { status:400 });
    }

    const msg = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: user.id,
        type: attachments.length ? "IMAGE" : "TEXT",
        text: text || null,
        attachments,
      },
      select: { id:true, senderId:true, type:true, text:true, attachments:true, createdAt:true }
    });

    await prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date() }});
    await prisma.conversationMember.updateMany({
      where: { conversationId: id, userId: { not: user.id } },
      data: { unreadCount: { increment: 1 } }
    });
    await prisma.conversationMember.updateMany({
      where: { conversationId: id, userId: user.id },
      data: { lastSeenAt: new Date() }
    });

    return NextResponse.json({ success:true, message: msg }, { status:200 });
  } catch(e) {
    console.error(e);
    return NextResponse.json({ success:false, message:"Server error" }, { status:500 });
  }
}
