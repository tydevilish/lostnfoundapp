import { NextResponse } from "next/server";
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

export async function GET(req) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ success:false, message:"Unauthorized" }, { status:401 });

  const encoder = new TextEncoder();
  let intervalId;
  let sendRef;
  let setRef;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(intervalId);
    const hubs = globalThis.__inboxHubs;
    if (setRef && sendRef) {
      setRef.delete(sendRef);
      if (setRef.size === 0 && hubs) hubs.delete(me.id);
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      const hubs = (globalThis.__inboxHubs ??= new Map());
      setRef = hubs.get(me.id);
      if (!setRef) { setRef = new Set(); hubs.set(me.id, setRef); }

      sendRef = (payload) => {
        try { controller.enqueue(encoder.encode(payload)); }
        catch { cleanup(); }
      };
      setRef.add(sendRef);

      const send = (obj) => sendRef(`data: ${JSON.stringify(obj)}\n\n`);
      send({ type: "ready" });

      intervalId = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); }
        catch { cleanup(); }
      }, 15000);

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
