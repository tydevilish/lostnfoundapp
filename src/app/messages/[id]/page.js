// app/messages/[id]/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import Link from "next/link";

/** อีโมจิยอดฮิต (เพิ่มจากของเดิม + จัดหมวด) */
const EMOJI_SMILEYS = ["😀","😁","😂","🤣","😊","😍","😘","🙂","🤔","😅","😎","😇","🥳","🤩","😴","😭","😡","😤","🤯"];
const EMOJI_HANDS   = ["👍","👎","🙏","👏","🙌","👌","🤝","✌️","👋","🤏","🤘","☝️","✊","🤚","👉","👈","👇","👆"];
const EMOJI_MISC    = ["🔥","❤️","💙","💚","💛","💜","🖤","🤍","✨","🎉"];
const EMOJI_ALL = [...EMOJI_SMILEYS, ...EMOJI_HANDS, ...EMOJI_MISC];

// ===== ตั้งค่าความถี่ Poll แบบ Adaptive =====
const POLL_MS = { active: 1000, idle: 3000, hidden: 10000 };
const JITTER = 200; // กระจายโหลดให้ไม่ยิงพร้อมกันเป๊ะ

/** ทำความสะอาดข้อความก่อนเทียบ */
const normalizeText = (t = "") => t.replace(/\s+/g, " ").trim();

/** นับรูปใน message */
const attachCount = (m) => (m?.attachments?.length ?? m?.images?.length ?? 0);

/** ลายเซ็นข้อความ (ตัวล็อก) */
const signatureOf = (m) =>
  `${m?.senderId || ""}|${normalizeText(m?.text || "")}|${attachCount(m)}`;

/** รวมข้อความกันซ้ำพื้นฐาน (กัน Poll ดึงมาแทรกซ้ำ) */
function mergeMessagesUnique(prev = [], incoming = []) {
  if (!incoming.length) return prev;
  const keyOf = (m) => m?.id ?? `${m?.createdAt ?? ""}|${m?.senderId ?? ""}|${m?.text ?? ""}`;
  const seen = new Set(prev.map(keyOf));
  const add = incoming.filter((m) => !seen.has(keyOf(m)));
  if (!add.length) return prev;
  return [...prev, ...add];
}

/** ตัดซ้ำด้วย id โดยคงลำดับ */
function dedupeByIdKeepOrder(arr) {
  const out = [];
  const seen = new Set();
  for (const m of arr) {
    if (m?.id && seen.has(m.id)) continue;
    if (m?.id) seen.add(m.id);
    out.push(m);
  }
  return out;
}

/** บีบอัดรูปฝั่ง client (เร็ว + ขนาดเล็กลง ส่งไวขึ้น) */
async function compressImages(files, { maxSide = 1600, quality = 0.8 } = {}) {
  const results = [];
  for (const f of files) {
    const dataUrl = await fileToDataURL(f);
    const { blob, width, height } = await resizeDataURL(dataUrl, { maxSide, quality });
    const file = new File([blob], `img-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`, { type: blob.type || "image/jpeg" });
    const url = URL.createObjectURL(blob);
    results.push({ file, url, width, height });
  }
  return results; // [{file, url}]
}

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function resizeDataURL(dataUrl, { maxSide = 1600, quality = 0.8 } = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      let tw = width, th = height;
      if (Math.max(width, height) > maxSide) {
        if (width > height) { tw = maxSide; th = Math.round(height * maxSide / width); }
        else { th = maxSide; tw = Math.round(width * maxSide / height); }
      }
      const canvas = document.createElement("canvas");
      canvas.width = tw; canvas.height = th;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, tw, th);
      canvas.toBlob((b) => resolve({ blob: b || new Blob(), width: tw, height: th }), "image/jpeg", quality);
    };
    img.onerror = () => resolve({ blob: new Blob(), width: 0, height: 0 });
    img.src = dataUrl;
  });
}

export default function ConversationPage() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);        // (compressed) File[]
  const [previews, setPreviews] = useState([]);  // objectURL ของ compressed
  const [compressing, setCompressing] = useState(false);
  const [meId, setMeId] = useState(null);

  const sendingRef = useRef(false);
  const inputRef = useRef(null);
  const scrollerRef = useRef(null);
  const bottomSentinelRef = useRef(null);

  // ===== optimistic stores
  const tempStoreRef = useRef(new Map()); // tempId -> { text, files }
  const tempUrlsRef = useRef(new Map());  // tempId -> [objectURLs]

  // ===== lock: ชุดลายเซ็นที่กำลังส่งอยู่ (มี temp แสดงอยู่)
  const pendingSigRef = useRef(new Set());     // Set<string>
  const tempIdBySigRef = useRef(new Map());    // sig -> tempId

  // ===== polling / SSE
  const lastTsRef = useRef(null);
  const lastEventRef = useRef(Date.now());

  // ===== READ: debounce/throttle
  const readTimerRef = useRef(null);
  const readInflightRef = useRef(false);
  const lastReadAtRef = useRef(0);

  // ===== สมาชิกเป็น map
  const memberById = useMemo(() => {
    const m = new Map();
    if (conv?.members) conv.members.forEach(u => m.set(u.id, u));
    return m;
  }, [conv]);

  const getUserOfMessage = (m) => m?.sender || memberById.get(m?.senderId) || null;
  const getName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "ผู้ใช้";

  const scrollToBottom = (smooth = true) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (smooth) el.style.scrollBehavior = "smooth";
    el.scrollTop = el.scrollHeight + 9999;
    if (smooth) setTimeout(() => (el.style.scrollBehavior = "auto"), 300);
  };

  const isNearBottom = () => {
    const el = scrollerRef.current;
    if (!el) return false;
    const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
    return gap < 120;
  };

  const ensureVisible = (fromMe = false) => {
    if (fromMe || isNearBottom()) requestAnimationFrame(() => scrollToBottom(true));
  };

  const nextDelay = () => {
    const visible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
    const typing = !!text.trim();
    const nearBottom = isNearBottom();
    const base = !visible ? POLL_MS.hidden : (typing || nearBottom ? POLL_MS.active : POLL_MS.idle);
    return base + Math.floor(Math.random() * JITTER);
  };

  // ===== ยิง read แบบสุภาพ
  const scheduleRead = (opts = { force: false }) => {
    if (!id || !meId) return;
    if (!opts.force && !isNearBottom()) return;
    if (Date.now() - lastReadAtRef.current < 1000) return; // throttle ~1s
    clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(async () => {
      if (readInflightRef.current) return;
      readInflightRef.current = true;
      try {
        await fetch(`/api/messages/${id}/read`, { method: "POST", credentials: "include" });
        lastReadAtRef.current = Date.now();
      } catch { /* noop */ }
      finally { readInflightRef.current = false; }
    }, 120);
  };

  // ===== โหลดเริ่มต้น
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
      requestAnimationFrame(() => {
        scrollToBottom(false);
        scheduleRead({ force: false });
      });
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);

  // ===== helper: แทนที่ temp ตามลายเซ็น
  const replaceOptimisticBySignature = (realMsg) => {
    const sig = signatureOf(realMsg);
    if (!pendingSigRef.current.has(sig)) return false;
    const tempId = tempIdBySigRef.current.get(sig);
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === tempId);
      if (idx === -1) return prev;
      const arr = prev.slice();
      arr[idx] = realMsg;
      return dedupeByIdKeepOrder(arr);
    });
    const urls = tempUrlsRef.current.get(tempId) || [];
    urls.forEach(u => URL.revokeObjectURL(u));
    tempUrlsRef.current.delete(tempId);
    tempStoreRef.current.delete(tempId);
    pendingSigRef.current.delete(sig);
    tempIdBySigRef.current.delete(sig);
    return true;
  };

  // ===== SSE
  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/messages/${id}/events`, { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data || "{}");
        const msg = payload?.message;
        if ((payload?.type === "message" || payload?.type === "message:new") && msg) {
          if (msg.senderId === meId && replaceOptimisticBySignature(msg)) {
            lastTsRef.current = msg.createdAt;
            lastEventRef.current = Date.now();
            ensureVisible(true);
            return;
          }
          setMessages(prev => {
            const next = mergeMessagesUnique(prev, [msg]);
            lastTsRef.current = msg.createdAt;
            return next;
          });
          lastEventRef.current = Date.now();
          // ถ้ามาจากฝั่งตรงข้ามและเราอยู่ก้น → read
          scheduleRead({ force: false });
          ensureVisible(msg.senderId === meId);
        }
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, [id, meId]);

  // ===== Polling fallback
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
            let arr = prev;
            let gotMine = false;
            for (const m of data.messages) {
              if (m.senderId === meId && pendingSigRef.current.has(signatureOf(m))) {
                const sig = signatureOf(m);
                const tempId = tempIdBySigRef.current.get(sig);
                const idx = arr.findIndex(x => x.id === tempId);
                if (idx !== -1) {
                  const copy = arr.slice();
                  copy[idx] = m;
                  arr = copy;
                  const urls = tempUrlsRef.current.get(tempId) || [];
                  urls.forEach(u => URL.revokeObjectURL(u));
                  tempUrlsRef.current.delete(tempId);
                  tempStoreRef.current.delete(tempId);
                  pendingSigRef.current.delete(sig);
                  tempIdBySigRef.current.delete(sig);
                  gotMine = true;
                }
              }
            }
            const merged = mergeMessagesUnique(arr, data.messages);
            const last = data.messages[data.messages.length - 1];
            lastTsRef.current = last?.createdAt || lastTsRef.current;
            // หลังอัปเดต ลองอ่านถ้าอยู่ก้น
            setTimeout(() => scheduleRead({ force: gotMine ? true : false }), 0);
            setTimeout(() => ensureVisible(gotMine), 0);
            return merged;
          });
          lastEventRef.current = Date.now();
        }
      } catch {}

      setTimeout(tick, nextDelay());
    };

    setTimeout(tick, nextDelay());
    return () => { stopped = true; };
  }, [id, text, meId]);

  // ===== อัพโหลด preview (บีบอัดก่อน)
  const onPickFiles = async (e) => {
    const arr = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    setCompressing(true);
    try {
      const compressed = await compressImages(arr, { maxSide: 1600, quality: 0.82 });
      setFiles(prev => [...prev, ...compressed.map(c => c.file)]);
      setPreviews(prev => [...prev, ...compressed.map(c => c.url)]);
    } finally {
      setCompressing(false);
    }
  };
  const removePreview = (i) => {
    setFiles(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, idx) => idx !== i);
    });
  };
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  // ===== ส่งข้อความ (Optimistic + Signature lock)
  const send = async () => {
    if (sendingRef.current) return;
    const payloadText = text.trim();
    if (!payloadText && files.length === 0) return;

    sendingRef.current = true;

    const tempId = `temp-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    const tempUrls = previews.slice(); // ใช้ preview ที่บีบแล้ว
    const tempMsg = {
      id: tempId,
      senderId: meId,
      text: payloadText || null,
      attachments: tempUrls,
      createdAt: new Date().toISOString(),
      __optimistic: true,
      __failed: false,
    };

    const tempSig = signatureOf(tempMsg);
    pendingSigRef.current.add(tempSig);
    tempIdBySigRef.current.set(tempSig, tempId);

    tempStoreRef.current.set(tempId, { text: payloadText, files: files.slice() });
    tempUrlsRef.current.set(tempId, tempUrls.slice());

    setMessages(prev => mergeMessagesUnique(prev, [tempMsg]));
    ensureVisible(true); // เราส่งเอง → เลื่อนเสมอ

    // เคลียร์อินพุตทันที
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

      const real = data.message;

      if (!pendingSigRef.current.has(tempSig)) {
        setMessages(prev => dedupeByIdKeepOrder(prev));
      } else {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === tempId);
          if (idx === -1) return mergeMessagesUnique(prev, [real]);
          const arr = prev.slice();
          arr[idx] = real;
          return dedupeByIdKeepOrder(arr);
        });
        const urls = tempUrlsRef.current.get(tempId) || [];
        urls.forEach(u => URL.revokeObjectURL(u));
        tempUrlsRef.current.delete(tempId);
        tempStoreRef.current.delete(tempId);
      }

      pendingSigRef.current.delete(tempSig);
      tempIdBySigRef.current.delete(tempSig);

      lastTsRef.current = real?.createdAt || lastTsRef.current;
      lastEventRef.current = Date.now();
      ensureVisible(true);
      scheduleRead({ force: false }); // หลังส่งเสร็จ เราอยู่ก้น → เคลียร์ unread ของเราเองด้วย
    } catch (e) {
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, __failed: true } : m)));
      pendingSigRef.current.delete(tempSig);
      tempIdBySigRef.current.delete(tempSig);
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

    const tempMsgLike = { id: tempId, senderId: meId, text: payload.text, attachments: (tempUrlsRef.current.get(tempId) || []) };
    const tempSig = signatureOf(tempMsgLike);
    pendingSigRef.current.add(tempSig);
    tempIdBySigRef.current.set(tempSig, tempId);

    try {
      const fd = new FormData();
      if (payload.text) fd.append("text", payload.text);
      (payload.files || []).forEach(f => fd.append("attachments", f));

      const res = await fetch(`/api/messages/${id}`, { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || data?.success === false) throw new Error(data?.message || "ส่งข้อความไม่สำเร็จ");

      const real = data.message;

      if (pendingSigRef.current.has(tempSig)) {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === tempId);
          const arr = idx === -1 ? prev.slice() : (() => { const a=prev.slice(); a[idx]=real; return a; })();
          return dedupeByIdKeepOrder(arr);
        });
        const urls = tempUrlsRef.current.get(tempId) || [];
        urls.forEach(u => URL.revokeObjectURL(u));
        tempUrlsRef.current.delete(tempId);
        tempStoreRef.current.delete(tempId);
      }
      pendingSigRef.current.delete(tempSig);
      tempIdBySigRef.current.delete(tempSig);

      lastTsRef.current = real?.createdAt || lastTsRef.current;
      lastEventRef.current = Date.now();
      ensureVisible(true);
      scheduleRead({ force: false });
    } catch (e) {
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, __failed: true } : m)));
      pendingSigRef.current.delete(tempSig);
      tempIdBySigRef.current.delete(tempSig);
    } finally {
      sendingRef.current = false;
    }
  };

  // เก็บกวาด URL ชั่วคราวเมื่อ unmount
  useEffect(() => {
    return () => {
      for (const urls of tempUrlsRef.current.values()) urls.forEach((u) => URL.revokeObjectURL(u));
      tempUrlsRef.current.clear();
      previews.forEach(u => URL.revokeObjectURL(u));
    };
  }, []); // eslint-disable-line

  // อ่านอัตโนมัติเมื่อ bottom sentinel โผล่ใน viewport ของ scroller
  useEffect(() => {
    const root = scrollerRef.current;
    const target = bottomSentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) scheduleRead({ force: true });
      },
      { root, threshold: 0.1 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  // เมื่อหน้าต่างโฟกัส/แท็บ visible → ลอง read อีกที
  useEffect(() => {
    const onFocus = () => scheduleRead({ force: false });
    const onVis = () => { if (document.visibilityState === "visible") scheduleRead({ force: false }); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
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
        <div
          ref={scrollerRef}
          className="h-[62vh] sm:h-[68vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4"
          style={{ scrollBehavior: "auto" }}
          onScroll={() => scheduleRead({ force: false })}
        >
          {messages.length === 0 ? (
            <div className="h-full grid place-items-center text-slate-500">เริ่มต้นการสนทนาได้เลย</div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => {
                const mine = !!meId && m.senderId === meId;
                const u = getUserOfMessage(m);
                const imgs = (m.attachments?.length ? m.attachments : m.images) || [];
                const handleImgLoad = () => { ensureVisible(mine); scheduleRead({ force: false }); };

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
                            <img key={j} src={src} alt={`img-${j}`} className="rounded-lg object-cover w-full h-32" onLoad={handleImgLoad} />
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
              {/* sentinel ตรวจว่ามาถึงก้นจริง */}
              <div ref={bottomSentinelRef} style={{ height: 1 }} />
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

          {compressing && (
            <div className="mb-2 text-xs text-slate-500 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" /> กำลังลดขนาดรูป…
            </div>
          )}

          <div className="flex items-end gap-2">
            <EmojiPicker onPick={(emo)=>{ setText(t=>t+emo); inputRef.current?.focus(); }} />
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

/* ===== Avatar + Emoji (ใหม่: สวยขึ้น, ไม่ซ้อน, ค้นหา/ล่าสุด) ===== */

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
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState([]);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("emoji_recent") || "[]");
      if (Array.isArray(r)) setRecent(r.slice(0, 18));
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const updatePosition = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = 300, height = 320, margin = 8;
    let left = r.left;
    let top = r.top - height - margin;
    if (top < margin) top = r.bottom + margin;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
    if (left < margin) left = margin;
    setPos({ top, left });
  };

  const toggle = () => {
    if (!open) {
      updatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const filtered = (query ? EMOJI_ALL.filter(e => e.includes(query)) : EMOJI_ALL).slice(0, 200);

  const pick = (e) => {
    onPick(e);
    setOpen(false);
    const next = [e, ...recent.filter(x => x !== e)].slice(0, 18);
    setRecent(next);
    try { localStorage.setItem("emoji_recent", JSON.stringify(next)); } catch {}
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        aria-label="เลือกอีโมจิ"
      >
        😊
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100]" onMouseDown={() => setOpen(false)}>
          <div
            className="absolute bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 w-[300px]"
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={(e)=>e.stopPropagation()}
          >
            {!!recent.length && !query && (
              <>
                <div className="px-2 text-[11px] text-slate-500 mb-1">ใช้บ่อย</div>
                <div className="grid grid-cols-8 gap-1 px-2 mb-2">
                  {recent.map((e,i)=>(
                    <button key={`r-${i}`} className="text-2xl leading-none hover:bg-slate-100 rounded p-1"
                      onClick={()=>pick(e)} title={e}>{e}</button>
                  ))}
                </div>
              </>
            )}

            <div className="px-2 text-[11px] text-slate-500 mb-1">{query ? "ผลลัพธ์" : "ทั้งหมด"}</div>
            <div className="max-h-[220px] overflow-y-auto px-2 pb-2">
              <div className="grid grid-cols-8 gap-1">
                {filtered.map((e,i)=>(
                  <button key={`a-${i}`} className="text-2xl leading-none hover:bg-slate-100 rounded p-1"
                    onClick={()=>pick(e)} title={e}>{e}</button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
