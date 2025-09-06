import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const TOKEN_NAME = "lf_token";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const isObjectId = (s) => typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

async function getAuthUser() {
  const token = (await cookies()).get(TOKEN_NAME)?.value;
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

// ---------- GET: รายละเอียดห้อง + ข้อความล่าสุด / ใหม่กว่า since ----------
export async function GET(_req, ctx) {
  try {
    const me = await getAuthUser();
    if (!me)
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );

    const { id } = await ctx.params;
    if (!isObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid id" },
        { status: 400 }
      );
    }

    const url = new URL(_req.url);
    const sinceStr = url.searchParams.get("since");
    const takeParam = parseInt(url.searchParams.get("take") || "200", 10);
    const take = Number.isFinite(takeParam)
      ? Math.min(Math.max(takeParam, 1), 500)
      : 200;

    const convo = await prisma.conversation.findFirst({
      where: { id, members: { some: { userId: me.id } } },
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
        contextItem: {
          select: {
            id: true,
            name: true,
            images: true,
            category: true,
            place: true,
          },
        },
      },
    });
    if (!convo)
      return NextResponse.json(
        { success: false, message: "Not found" },
        { status: 404 }
      );

    const where = { conversationId: id };
    if (sinceStr) {
      const s = new Date(sinceStr);
      if (!isNaN(s)) where.createdAt = { gt: s };
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take,
      select: {
        id: true,
        type: true,
        text: true,
        attachments: true,
        senderId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        meId: me.id,
        conversation: {
          id: convo.id,
          item: convo.contextItem || null,
          members: convo.members.map((m) => ({
            id: m.user.id,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            avatarUrl: m.user.avatarUrl,
          })),
        },
        messages,
      },
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

// ---------- POST: ส่งข้อความ (text + แนบรูป) + broadcast ไปหาหน้ารวมแชท ----------
export async function POST(req, ctx) {
  try {
    const user = await getAuthUser();
    if (!user)
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );

    const { id } = await ctx.params;
    if (!id)
      return NextResponse.json(
        { success: false, message: "Missing id" },
        { status: 400 }
      );

    const member = await prisma.conversationMember.findFirst({
      where: { conversationId: id, userId: user.id },
      select: { id: true },
    });
    if (!member)
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );

    // ----- รับ JSON หรือ multipart/form-data
    const ct = req.headers.get("content-type") || "";
    let text = "";
    let attachments = [];

    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      text = (body?.text || "").toString().trim().slice(0, 5000);
      if (Array.isArray(body?.attachments))
        attachments = body.attachments.map(String);
      else if (Array.isArray(body?.images))
        attachments = body.images.map(String);
    } else if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      text = (fd.get("text") || "").toString().trim().slice(0, 5000);
      let files = fd.getAll("attachments").filter(Boolean);
      if (!files.length) files = fd.getAll("images").filter(Boolean);
      for (const f of files) {
        if (typeof f?.arrayBuffer === "function") {
          const ab = await f.arrayBuffer();
          const b64 = Buffer.from(ab).toString("base64");
          const mime = f.type || "application/octet-stream";
          attachments.push(`data:${mime};base64,${b64}`);
        }
      }
    }

    if (!text && attachments.length === 0) {
      return NextResponse.json(
        { success: false, message: "Empty message" },
        { status: 400 }
      );
    }

    const msg = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: user.id,
        type: attachments.length ? "IMAGE" : "TEXT",
        text: text || null,
        attachments,
      },
      select: {
        id: true,
        type: true,
        text: true,
        attachments: true,
        senderId: true,
        createdAt: true,
      },
    });

    // อัพเดตสถานะแชท
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });
    await prisma.conversationMember.updateMany({
      where: { conversationId: id, userId: { not: user.id } },
      data: { unreadCount: { increment: 1 } },
    });
    await prisma.conversationMember.updateMany({
      where: { conversationId: id, userId: user.id },
      data: { lastSeenAt: new Date() },
    });

    // 🔔 แจ้งผู้ฟัง SSE ในห้องนี้ (local instance)
    try {
      const hubs = (globalThis.__sseHubs ??= new Map());
      const subs = hubs.get(id);
      if (subs) {
        const payload = `data: ${JSON.stringify({
          type: "message:new",
          message: msg,
        })}\n\n`;
        subs.forEach((fn) => fn(payload));
      }
    } catch (e) {
      console.warn("SSE room notify fail:", e);
    }

    // 🔔 แจ้ง “หน้ารวมแชท” ของสมาชิกทุกคน
    try {
      // เตรียมข้อมูลสรุปแชท (ใช้ร่วมกันทุกคน)
      const convo = await prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          lastMessageAt: true,
          contextItem: { select: { name: true } },
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
        },
      });

      const hubs = (globalThis.__inboxHubs ??= new Map());
      for (const m of convo.members) {
        const viewerId = m.userId;
        const cm = await prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: { conversationId: id, userId: viewerId },
          },
          select: { unreadCount: true },
        });

        const others = convo.members
          .filter((x) => x.user.id !== viewerId)
          .map((x) => x.user);
        const primary = others[0] || null;
        const title =
          convo.contextItem?.name ||
          (convo.members.length === 2
            ? [primary?.firstName, primary?.lastName]
                .filter(Boolean)
                .join(" ") || "การสนทนา"
            : `การสนทนากลุ่ม (${convo.members.length} คน)`);

        const item = {
          id: convo.id,
          title,
          otherUser: primary
            ? {
                firstName: primary.firstName,
                lastName: primary.lastName,
                avatarUrl: primary.avatarUrl,
              }
            : null,
          lastMessage: { id: msg.id, type: msg.type, text: msg.text || null },
          lastMessageAt: msg.createdAt,
          unread: cm?.unreadCount || 0,
        };

        const subs = hubs.get(viewerId);
        if (subs) {
          const payload = `data: ${JSON.stringify({
            type: "inbox:upsert",
            item,
          })}\n\n`;
          subs.forEach((fn) => fn(payload));
        }
      }
    } catch (e) {
      console.warn("SSE inbox notify fail:", e);
    }

    return NextResponse.json({ success: true, message: msg }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
