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
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    return { id: payload.sub };
  } catch {
    return null;
  }
}

// GET /api/messages  -> รายการห้องแชทของฉัน
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user)
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );

    const convos = await prisma.conversation.findMany({
      where: { members: { some: { userId: user.id } } },
      orderBy: { lastMessageAt: "desc" },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            text: true,
            type: true,
            createdAt: true,
            attachments: true,
            senderId: true,
          },
        },
      },
    });

    const items = convos.map((c) => {
      const me = c.members.find((m) => m.userId === user.id);
      const other = c.members.find((m) => m.userId !== user.id)?.user || null;
      return {
        id: c.id,
        isGroup: c.isGroup,
        title:
          c.title ||
          (other ? `${other.firstName} ${other.lastName}`.trim() : "แชท"),
        otherUser: other, // เพื่อใช้บน client ได้เลย
        contextItemId: c.contextItemId || null,
        lastMessage: c.messages[0] || null,
        unread: me?.unreadCount || 0,
        lastMessageAt: c.lastMessageAt || c.createdAt,
      };
    });

    return NextResponse.json({ success: true, items }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

// POST /api/messages  -> สร้าง/เปิดห้อง 1:1 (optional: contextItemId, text แรก)
export async function POST(req) {
  try {
    const user = await getAuthUser();
    if (!user)
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );

    const body = await req.json().catch(() => ({}));
    const toId = String(body?.to || "").trim();
    const contextItemId = body?.item ? String(body.item) : undefined;
    const text = (body?.text || "").toString();

    if (!toId)
      return NextResponse.json(
        { success: false, message: "Missing `to`" },
        { status: 400 }
      );
    if (toId === user.id)
      return NextResponse.json(
        { success: false, message: "Cannot chat with yourself" },
        { status: 400 }
      );

    // หาแชทเดิม (1:1) ที่มีทั้งสองฝั่ง และ contextItemId (ถ้าส่งมา)
    const where = {
      isGroup: false,
      members: { some: { userId: user.id } },
      AND: [{ members: { some: { userId: toId } } }],
      ...(contextItemId ? { contextItemId } : {}),
    };

    let convo = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        members: { some: { userId: user.id } },
        AND: [{ members: { some: { userId: toId } } }],
        ...(contextItemId ? { contextItemId } : {}),
      },
      include: { members: true },
    });

    if (!convo) {
      convo = await prisma.conversation.create({
        data: {
          isGroup: false,
          contextItemId: contextItemId ?? null,
          members: { create: [{ userId: user.id }, { userId: toId }] },
          lastMessageAt: new Date(),
        },
      });
    }

    // ส่งข้อความแรกถ้ามี
    if (text.trim()) {
      await prisma.message.create({
        data: {
          conversationId: convo.id,
          senderId: user.id,
          type: "TEXT",
          text: text.trim(),
        },
      });
      await prisma.conversation.update({
        where: { id: convo.id },
        data: { lastMessageAt: new Date() },
      });
      await prisma.conversationMember.updateMany({
        where: { conversationId: convo.id, userId: { not: user.id } },
        data: { unreadCount: { increment: 1 } },
      });
      await prisma.conversationMember.updateMany({
        where: { conversationId: convo.id, userId: user.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return NextResponse.json(
      { success: true, conversationId: convo.id },
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
