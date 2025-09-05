// app/messages/[id]/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const EMOJIS = [
  "😀",
  "😂",
  "😊",
  "😍",
  "🤔",
  "😎",
  "🤝",
  "🙏",
  "🎉",
  "👍",
  "🔥",
  "❤️",
];

export default function ConversationPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState(null); // {id, item, members}
  const [messages, setMessages] = useState([]);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // string[]
  const sendingRef = useRef(false);
  const inputRef = useRef(null);
  const scrollerRef = useRef(null);

  // ---- load conversation + messages
  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/messages/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "โหลดห้องสนทนาไม่สำเร็จ");
      setConv(data.conversation);
      setMessages(data.messages || []);
      queueMicrotask(scrollToBottom);
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load(); /* eslint-disable-next-line */
  }, [id]);

  // ---- SSE subscribe (รองรับทั้ง type: "message" และ "message:new")
  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/messages/${id}/events`);
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data || "{}");
        if (
          (payload?.type === "message" || payload?.type === "message:new") &&
          payload.message
        ) {
          setMessages((prev) => [...prev, payload.message]);
          queueMicrotask(scrollToBottom);
        }
      } catch {}
    };
    es.onerror = () => {
      /* optional: retry/backoff */
    };
    return () => es.close();
  }, [id]);

  // ---- image picker
  const onPickFiles = (e) => {
    const arr = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (!arr.length) return;
    setFiles((prev) => [...prev, ...arr]);
    const urls = arr.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...urls]);
  };
  const removePreview = (i) => {
    setFiles((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, idx) => idx !== i);
    });
  };
  // revoke on unmount
  useEffect(
    () => () => previews.forEach((u) => URL.revokeObjectURL(u)),
    [previews]
  );

  // ---- send (ใช้คีย์ "attachments" ให้ตรง API; API ยังรับ "images" ได้ แต่ให้ตรงไว้ก่อน)
  const send = async () => {
    if (sendingRef.current) return;
    if (!text.trim() && files.length === 0) return;

    sendingRef.current = true;
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      files.forEach((f) => fd.append("attachments", f));

      const res = await fetch(`/api/messages/${id}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false)
        throw new Error(data?.message || "ส่งข้อความไม่สำเร็จ");

      // optimistic clear (ตัวจริงจะมาเองผ่าน SSE)
      setText("");
      setFiles([]);
      previews.forEach((u) => URL.revokeObjectURL(u));
      setPreviews([]);
      inputRef.current?.focus();
      queueMicrotask(scrollToBottom);
    } catch (e) {
      alert(e.message || "เกิดข้อผิดพลาด");
    } finally {
      sendingRef.current = false;
    }
  };

  // ---- utils
  const meId = useMemo(() => null, []); // ถ้าอยากจัด bubble ฝั่งขวา ให้ส่ง meId จากเซิร์ฟเวอร์
  const other = useMemo(() => conv?.members?.[0] || null, [conv]);

  const scrollToBottom = () => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight + 9999;
  };

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
        <p className="text-slate-600 mb-6">
          {err || "ไม่มีสิทธิ์เข้าถึง / ห้องอาจถูกลบ"}
        </p>
        <Link
          href="/messages"
          className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700"
        >
          ← กลับไปกล่องข้อความ
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/40 to-white">
      {/* header */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3">
          <Link
            href="/messages"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 border border-white/30"
          >
            ← ทั้งหมด
          </Link>
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
        <div
          ref={scrollerRef}
          className="h-[62vh] sm:h-[68vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4"
        >
          {messages.length === 0 ? (
            <div className="h-full grid place-items-center text-slate-500">
              เริ่มต้นการสนทนาได้เลย
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const mine = meId && m.senderId === meId;
                const imgs =
                  (m.attachments?.length ? m.attachments : m.images) || [];

                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`${
                        mine
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-900"
                      } max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow`}
                    >
                      {!!m.text && (
                        <div className="whitespace-pre-wrap break-words">
                          {m.text}
                        </div>
                      )}
                      {!!imgs.length && (
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          {imgs.map((src, i) => (
                            <img
                              key={i}
                              src={src}
                              alt={`img-${i}`}
                              className="rounded-lg object-cover w-full h-32"
                            />
                          ))}
                        </div>
                      )}
                      <div
                        className={`${
                          mine ? "text-white/70" : "text-slate-500"
                        } text-[11px] mt-1`}
                      >
                        {new Date(m.createdAt).toLocaleString("th-TH", {
                          timeStyle: "short",
                          dateStyle: "short",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* composer */}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
          {/* previews */}
          {!!previews.length && (
            <div className="mb-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt={`p-${i}`}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                  <button
                    className="absolute -top-2 -right-2 bg-white rounded-full border shadow px-1.5 text-xs"
                    onClick={() => removePreview(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <EmojiPicker onPick={(emo) => setText((t) => t + emo)} />
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              placeholder="พิมพ์ข้อความ…"
              className="flex-1 text-black resize-none rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <label className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              รูป
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={onPickFiles}
              />
            </label>
            <button
              onClick={send}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 disabled:opacity-60"
              disabled={!text.trim() && files.length === 0}
            >
              ส่ง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================= Emoji (แก้อีโมจิทับกัน) ======================= */
function EmojiPicker({ onPick }) {
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  // ปิดเมื่อคลิกนอก
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
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
      >
        😊
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50
                     min-w-[180px] max-w-[260px]"
          style={{ transform: "translateY(-4px)" }}
        >
          <div className="grid grid-cols-7 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                className="text-2xl leading-none hover:bg-slate-100 rounded p-1"
                onClick={() => {
                  onPick(e);
                  setOpen(false);
                }}
                title={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
