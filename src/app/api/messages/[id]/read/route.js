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

    const member = await prisma.conversationMember.findFirst({ where: { conversationId: id, userId: user.id }, select: { id: true }});
    if (!member) return NextResponse.json({ success:false, message:"Forbidden" }, { status:403 });

    await prisma.conversationMember.updateMany({
      where: { conversationId: id, userId: user.id },
      data: { unreadCount: 0, lastSeenAt: new Date() }
    });

    return NextResponse.json({ success:true }, { status:200 });
  } catch(e) {
    console.error(e);
    return NextResponse.json({ success:false, message:"Server error" }, { status:500 });
  }
}
