// app/api/messages/[id]/events/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_NAME = "lf_token";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

async function getAuthUser() {
  const token = (await cookies()).get(TOKEN_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return { id: payload.sub };
  } catch { return null; }
}

export async function GET(req, ctx) {
  const { id } = await ctx.params;
  if (!id) {
    return new Response(JSON.stringify({ success:false, message:"Missing id" }), { status: 400 });
  }

  // auth + member check
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ success:false, message:"Unauthorized" }, { status:401 });
  const member = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: me.id },
    select: { id: true }
  });
  if (!member) return NextResponse.json({ success:false, message:"Forbidden" }, { status:403 });

  const url = new URL(req.url);
  const sinceStr = url.searchParams.get("since");
  const since = sinceStr ? new Date(sinceStr) : null;

  const encoder = new TextEncoder();
  let intervalId;
  let sendRef;
  let setRef;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(intervalId);
    const hubs = globalThis.__sseHubs;
    if (setRef && sendRef) {
      setRef.delete(sendRef);
      if (setRef.size === 0 && hubs) hubs.delete(id);
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const hubs = (globalThis.__sseHubs ??= new Map());
      setRef = hubs.get(id);
      if (!setRef) { setRef = new Set(); hubs.set(id, setRef); }

      // สมัครสมาชิก "ก่อน" เพื่อไม่ให้หล่น event ระหว่าง backfill
      sendRef = (payload) => {
        try { controller.enqueue(encoder.encode(payload)); }
        catch { cleanup(); }
      };
      setRef.add(sendRef);

      // เปิดช่อง + keep-alive
      const send = (obj) => sendRef(`data: ${JSON.stringify(obj)}\n\n`);
      send({ type: "ready" });
      intervalId = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); }
        catch { cleanup(); }
      }, 15000);

      // backfill หลังสมัครเสร็จ — ถ้า since มี ใช้ createdAt > since, ถ้าไม่มี ส่ง recent 50
      try {
        const where = { conversationId: id, ...(since && !isNaN(since) ? { createdAt: { gt: since } } : {}) };
        const backlog = await prisma.message.findMany({
          where,
          orderBy: { createdAt: "asc" },
          take: since ? 200 : 50,
          select: { id:true, type:true, text:true, attachments:true, senderId:true, createdAt:true }
        });
        for (const m of backlog) send({ type: "message:new", message: m });
      } catch (e) {
        console.warn("SSE backlog error:", e?.message || e);
      }

      // ปิดเมื่อ client ตัดการเชื่อมต่อ
      req.signal?.addEventListener("abort", cleanup);
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
