// app/messages/[id]/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const EMOJIS = ["😀","😂","😊","😍","🤔","😎","🤝","🙏","🎉","👍","🔥","❤️"];

// ===== ตั้งค่าความถี่ Poll แบบ Adaptive =====
const POLL_MS = { active: 1000, idle: 3000, hidden: 10000 };
const JITTER = 200; // กระจายโหลดไม่ให้ยิงพร้อมกันเป๊ะ

/** รวมข้อความกันซ้ำ (กันกรณี SSE + Poll) */
function mergeMessagesUnique(prev = [], incoming = []) {
  if (!incoming.length) return prev;
  const keyOf = (m) => m?.id ?? `${m?.createdAt ?? ""}|${m?.senderId ?? ""}|${m?.text ?? ""}`;
  const seen = new Set(prev.map(keyOf));
  const add = incoming.filter((m) => !seen.has(keyOf(m)));
  if (!add.length) return prev;
  return [...prev, ...add];
}

/** ตัดซ้ำด้วย id โดยคงลำดับเดิมไว้ */
function dedupeByIdKeepOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const m of arr) {
    if (m?.id && seen.has(m.id)) continue;
    if (m?.id) seen.add(m.id);
    out.push(m);
  }
  return out;
}

export default function ConversationPage() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [meId, setMeId] = useState(null);

  const sendingRef = useRef(false);
  const inputRef = useRef(null);
  const scrollerRef = useRef(null);

  // optimistic store
  const tempStoreRef = useRef(new Map()); // tempId -> { text, files }
  const tempUrlsRef = useRef(new Map());  // tempId -> [objectURLs]

  // polling/SSE refs
  const lastTsRef = useRef(null);
  const lastEventRef = useRef(Date.now());

  // map สมาชิก
  const memberById = useMemo(() => {
    const m = new Map();
    if (conv?.members) conv.members.forEach(u => m.set(u.id, u));
    return m;
  }, [conv]);

  const getUserOfMessage = (m) => m?.sender || memberById.get(m?.senderId) || null;
  const getName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "ผู้ใช้";

  const scrollToBottom = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight + 9999;
  };

  const isNearBottom = () => {
    const el = scrollerRef.current;
    if (!el) return false;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    return gap < 120;
  };

  const nextDelay = () => {
    const visible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
    const typing = !!text.trim();
    const nearBottom = isNearBottom();
    const base = !visible ? POLL_MS.hidden : (typing || nearBottom ? POLL_MS.active : POLL_MS.idle);
    return base + Math.floor(Math.random() * JITTER);
  };

  // โหลดเริ่มต้น
  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/messages/${id}`, { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data?.message || "โหลดห้องสนทนาไม่สำเร็จ");
      setConv(data.conversation);
      setMeId(data.meId || null);
      setMessages(data.messages || []);
      const last = (data.messages || [])[Math.max(0, (data.messages || []).length - 1)];
      lastTsRef.current = last?.createdAt || null;
      lastEventRef.current = Date.now();
      queueMicrotask(scrollToBottom);
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);

  // SSE
  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/messages/${id}/events`, { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data || "{}");
        const msg = payload?.message;
        if ((payload?.type === "message" || payload?.type === "message:new") && msg) {
          setMessages(prev => {
            // 🔥 ถ้ามี optimistic ของเราที่ “น่าจะตรงกัน” ให้แทนที่ ไม่ใช่เพิ่มใหม่
            const idx = prev.findIndex(m =>
              m.__optimistic &&
              m.senderId === meId &&
              (m.text || "") === (msg.text || "") &&
              (m.attachments?.length || 0) === ((msg.attachments || []).length || 0)
            );
            if (idx !== -1) {
              const arr = prev.slice();
              arr[idx] = msg;
              lastTsRef.current = msg.createdAt;
              return dedupeByIdKeepOrder(arr);
            }
            // ปกติใช้ merge กันซ้ำด้วย id
            const next = mergeMessagesUnique(prev, [msg]);
            lastTsRef.current = msg.createdAt;
            return next;
          });
          lastEventRef.current = Date.now();
          queueMicrotask(scrollToBottom);
        }
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, [id, meId]);

  // Polling fallback
  useEffect(() => {
    if (!id) return;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;

      if (Date.now() - lastEventRef.current <= 1500) {
        setTimeout(tick, nextDelay());
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setTimeout(tick, nextDelay());
        return;
      }

      const qs = lastTsRef.current ? `?since=${encodeURIComponent(lastTsRef.current)}` : `?take=1`;
      try {
        const res = await fetch(`/api/messages/${id}${qs}`, { cache: "no-store", credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data?.messages) && data.messages.length) {
          setMessages(prev => {
            const next = mergeMessagesUnique(prev, data.messages);
            const last = data.messages[data.messages.length - 1];
            lastTsRef.current = last?.createdAt || lastTsRef.current;
            return next;
          });
          lastEventRef.current = Date.now();
          queueMicrotask(scrollToBottom);
        }
      } catch {}

      setTimeout(tick, nextDelay());
    };

    setTimeout(tick, nextDelay());
    return () => { stopped = true; };
  }, [id, text]);

  // อัพโหลด preview
  const onPickFiles = (e) => {
    const arr = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    setFiles(prev => [...prev, ...arr]);
    const urls = arr.map(f => URL.createObjectURL(f));
    setPreviews(prev => [...prev, ...urls]);
  };
  const removePreview = (i) => {
    setFiles(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, idx) => idx !== i);
    });
  };
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  // ส่งข้อความ (Optimistic + กันซ้ำ)
  const send = async () => {
    if (sendingRef.current) return;
    const payloadText = text.trim();
    if (!payloadText && files.length === 0) return;

    sendingRef.current = true;

    const tempId = `temp-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    const tempUrls = files.map(f => URL.createObjectURL(f));
    const tempMsg = {
      id: tempId,
      senderId: meId,
      text: payloadText || null,
      attachments: tempUrls,
      createdAt: new Date().toISOString(),
      __optimistic: true,
      __failed: false,
    };
    tempStoreRef.current.set(tempId, { text: payloadText, files });
    tempUrlsRef.current.set(tempId, tempUrls);

    setMessages(prev => mergeMessagesUnique(prev, [tempMsg]));
    queueMicrotask(scrollToBottom);

    setText("");
    setFiles([]);
    setPreviews([]);
    inputRef.current?.focus();

    try {
      const fd = new FormData();
      if (payloadText) fd.append("text", payloadText);
      (tempStoreRef.current.get(tempId)?.files || []).forEach(f => fd.append("attachments", f));

      const res = await fetch(`/api/messages/${id}`, { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || data?.success === false) throw new Error(data?.message || "ส่งข้อความไม่สำเร็จ");

      // ✅ แทนที่ temp + กรองของซ้ำตาม real id (กันเคส SSE มาก่อน)
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempId && m.id !== data.message.id);
        filtered.push(data.message);
        return dedupeByIdKeepOrder(filtered);
      });

      const urls = tempUrlsRef.current.get(tempId) || [];
      urls.forEach(u => URL.revokeObjectURL(u));
      tempUrlsRef.current.delete(tempId);
      tempStoreRef.current.delete(tempId);

      lastTsRef.current = data.message?.createdAt || lastTsRef.current;
      lastEventRef.current = Date.now();
      queueMicrotask(scrollToBottom);
    } catch (e) {
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, __failed: true } : m)));
    } finally {
      sendingRef.current = false;
    }
  };

  const resendTemp = async (tempId) => {
    if (sendingRef.current) return;
    const payload = tempStoreRef.current.get(tempId);
    if (!payload) return;

    sendingRef.current = true;
    setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, __failed: false } : m)));

    try {
      const fd = new FormData();
      if (payload.text) fd.append("text", payload.text);
      (payload.files || []).forEach(f => fd.append("attachments", f));

      const res = await fetch(`/api/messages/${id}`, { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || data?.success === false) throw new Error(data?.message || "ส่งข้อความไม่สำเร็จ");

      // ✅ กรอง temp + of same real id แล้วค่อยใส่ใหม่
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempId && m.id !== data.message.id);
        filtered.push(data.message);
        return dedupeByIdKeepOrder(filtered);
      });

      const urls = tempUrlsRef.current.get(tempId) || [];
      urls.forEach(u => URL.revokeObjectURL(u));
      tempUrlsRef.current.delete(tempId);
      tempStoreRef.current.delete(tempId);

      lastTsRef.current = data.message?.createdAt || lastTsRef.current;
      lastEventRef.current = Date.now();
      queueMicrotask(scrollToBottom);
    } catch (e) {
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, __failed: true } : m)));
    } finally {
      sendingRef.current = false;
    }
  };

  // เก็บกวาด URL ชั่วคราวเมื่อ unmount
  useEffect(() => {
    return () => {
      for (const urls of tempUrlsRef.current.values()) urls.forEach((u) => URL.revokeObjectURL(u));
      tempUrlsRef.current.clear();
    };
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="h-[60vh] bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }
  if (err || !conv) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="text-xl font-bold text-blue-900 mb-2">ไม่พบห้องสนทนา</h1>
        <p className="text-slate-600 mb-6">{err || "ไม่มีสิทธิ์เข้าถึง / ห้องอาจถูกลบ"}</p>
        <Link href="/messages" className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700">← กลับไปกล่องข้อความ</Link>
      </div>
    );
  }

  const isGroup = (conv.members?.length || 0) > 2;

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/40 to-white">
      {/* header */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3">
          <Link href="/messages" className="rounded-full px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 border border-white/30">← ทั้งหมด</Link>
          <div className="min-w-0">
            <div className="text-blue-100 text-xs">ห้องสนทนา</div>
            <h1 className="text-white font-semibold truncate">
              {conv.item?.name ? `เกี่ยวกับ: ${conv.item.name}` : "การสนทนา"}
            </h1>
          </div>
        </div>
      </section>

      {/* chat body */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div ref={scrollerRef} className="h-[62vh] sm:h-[68vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4">
          {messages.length === 0 ? (
            <div className="h-full grid place-items-center text-slate-500">เริ่มต้นการสนทนาได้เลย</div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => {
                const mine = !!meId && m.senderId === meId;
                const u = getUserOfMessage(m);
                const imgs = (m.attachments?.length ? m.attachments : m.images) || [];

                return (
                  <div key={m.id || `${m.createdAt}-${i}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine && (
                      <div className="mr-2 shrink-0 self-end">
                        <AvatarCircle user={u} size={36} />
                      </div>
                    )}

                    <div className={`${mine ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900"} max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow`}>
                      {!mine && isGroup && (
                        <div className={`mb-0.5 text-[11px] ${mine ? "text-white/80" : "text-slate-500"}`}>
                          {getName(u)}
                        </div>
                      )}
                      {!!m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
                      {!!imgs.length && (
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          {imgs.map((src, j) => (
                            <img key={j} src={src} alt={`img-${j}`} className="rounded-lg object-cover w-full h-32" />
                          ))}
                        </div>
                      )}
                      <div className={`${mine ? "text-white/70" : "text-slate-500"} text-[11px] mt-1`}>
                        {new Date(m.createdAt).toLocaleString("th-TH", { timeStyle:"short", dateStyle:"short" })}
                      </div>

                      {mine && m.__optimistic && !m.__failed && (
                        <div className={`${mine ? "text-white/80" : "text-slate-500"} text-[11px] mt-0.5 flex items-center gap-1`}>
                          <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse" />
                          กำลังส่ง…
                        </div>
                      )}
                      {mine && m.__failed && (
                        <div className="text-[11px] mt-1 flex items-center gap-2">
                          <span className="text-red-500 font-medium">ส่งไม่สำเร็จ</span>
                          <button
                            className="px-2 py-0.5 rounded-full border text-xs hover:bg-white/10"
                            onClick={() => resendTemp(m.id)}
                          >
                            ลองอีกครั้ง
                          </button>
                        </div>
                      )}
                    </div>

                    {mine && (
                      <div className="ml-2 shrink-0 self-end">
                        <AvatarCircle user={memberById.get(meId)} size={36} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* composer */}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
          {!!previews.length && (
            <div className="mb-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`p-${i}`} className="w-full h-24 object-cover rounded-lg border" />
                  <button className="absolute -top-2 -right-2 bg-white rounded-full border shadow px-1.5 text-xs"
                          onClick={()=>removePreview(i)}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <EmojiPicker onPick={(emo)=>setText(t=>t+emo)} />
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e)=>setText(e.target.value)}
              rows={1}
              placeholder="พิมพ์ข้อความ…"
              className="flex-1 text-black resize-none rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
              onKeyDown={(e)=>{ if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <label className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              รูป
              <input type="file" accept="image/*" multiple className="sr-only" onChange={onPickFiles} />
            </label>
            <button
              onClick={send}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 disabled:opacity-60"
              disabled={!text.trim() && files.length===0}
            >
              ส่ง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Avatar + Emoji ===== */

function AvatarCircle({ user, size = 36 }) {
  const url = user?.avatarUrl;
  const initials = (user?.firstName?.[0] || "") + (user?.lastName?.[0] || "");
  return url ? (
    <img
      src={url}
      alt={user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "avatar"}
      className="rounded-full object-cover border border-slate-200 shadow-sm"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full grid place-items-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 border border-slate-200 shadow-sm"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.floor(size/3)) }}
      title={user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "ผู้ใช้"}
    >
      {initials || "?"}
    </div>
  );
}

function EmojiPicker({ onPick }) {
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!popRef.current) return;
      if (popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative">
      <button onClick={()=>setOpen(o=>!o)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">😊</button>
      {open && (
        <div
          ref={popRef}
          className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 min-w-[180px] max-w-[260px]"
          style={{ transform: "translateY(-4px)" }}
        >
          <div className="grid grid-cols-7 gap-1">
            {EMOJIS.map((e)=>(
              <button key={e} className="text-2xl leading-none hover:bg-slate-100 rounded p-1"
                      onClick={()=>{ onPick(e); setOpen(false); }} title={e}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
