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

export async function POST(_req, ctx) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success:false, message:"Unauthorized" }, { status:401 });

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ success:false, message:"Missing id" }, { status:400 });

    const member = await prisma.conversationMember.findFirst({
      where: { conversationId: id, userId: user.id }, select: { id: true }
    });
    if (!member) return NextResponse.json({ success:false, message:"Forbidden" }, { status:403 });

    await prisma.conversationMember.updateMany({
      where: { conversationId: id, userId: user.id },
      data: { unreadCount: 0, lastSeenAt: new Date() }
    });

    // ส่งอัปเดตไปที่ "หน้ารวมแชท" ของคนที่อ่าน เพื่อให้เลขหายทันที
    try {
      const lastMsg = await prisma.message.findFirst({
        where: { conversationId: id },
        orderBy: { createdAt: "desc" },
        select: { id:true, type:true, text:true, createdAt:true }
      });
      const convo = await prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          contextItem: { select: { name: true } },
          members: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true }}} },
        }
      });

      const others = convo.members.filter(x => x.user.id !== user.id).map(x => x.user);
      const primary = others[0] || null;
      const title =
        convo.contextItem?.name ||
        (convo.members.length === 2
          ? [primary?.firstName, primary?.lastName].filter(Boolean).join(" ") || "การสนทนา"
          : `การสนทนากลุ่ม (${convo.members.length} คน)`);

      const item = {
        id: convo.id,
        title,
        otherUser: primary ? {
          firstName: primary.firstName, lastName: primary.lastName, avatarUrl: primary.avatarUrl
        } : null,
        lastMessage: lastMsg ? { id: lastMsg.id, type: lastMsg.type, text: lastMsg.text || null } : null,
        lastMessageAt: lastMsg?.createdAt || new Date().toISOString(),
        unread: 0,
      };

      const hubs = (globalThis.__inboxHubs ??= new Map());
      const subs = hubs.get(user.id);
      if (subs) {
        const payload = `data: ${JSON.stringify({ type: "inbox:upsert", item })}\n\n`;
        subs.forEach(fn => fn(payload));
      }
    } catch (e) { console.warn("SSE inbox read notify fail:", e); }

    return NextResponse.json({ success:true }, { status:200 });
  } catch(e) {
    console.error(e);
    return NextResponse.json({ success:false, message:"Server error" }, { status:500 });
  }
}
