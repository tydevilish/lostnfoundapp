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

export async function GET(_req, ctx) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success:false, message:"Unauthorized" }, { status:401 });

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ success:false, message:"Missing id" }, { status:400 });

    const convo = await prisma.conversation.findFirst({
      where: { id, members: { some: { userId: user.id } } },
      include: {
        members: { include: { user: { select: { id:true, firstName:true, lastName:true, avatarUrl:true } } } },
      },
    });
    if (!convo) return NextResponse.json({ success:false, message:"Not found" }, { status:404 });

    const me = convo.members.find(m => m.userId === user.id);
    const other = convo.members.find(m => m.userId !== user.id)?.user || null;

    return NextResponse.json({
      success:true,
      conversation: {
        id: convo.id,
        isGroup: convo.isGroup,
        title: convo.title || (other ? `${other.firstName} ${other.lastName}`.trim() : "แชท"),
        otherUser: other,
        contextItemId: convo.contextItemId || null,
        unread: me?.unreadCount || 0,
        lastMessageAt: convo.lastMessageAt,
      }
    }, { status:200 });
  } catch(e) {
    console.error(e);
    return NextResponse.json({ success:false, message:"Server error" }, { status:500 });
  }
}
