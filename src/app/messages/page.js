"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MessagesListPage() {
  const router = useRouter();

  // ===== data state
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  // ===== ui state
  const [q, setQ] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [conn, setConn] = useState("live"); // live | poll | offline
  const [focusIdx, setFocusIdx] = useState(-1);

  // ===== realtime helpers
  const lastEventRef = useRef(Date.now());
  const sseConnectedRef = useRef(false);
  const flashRef = useRef(new Map()); // id -> expireTs

  const totalUnread = useMemo(() => items.reduce((a,c)=>a+(c.unread||0),0), [items]);

  const upsert = (prev, item) => {
    const idx = prev.findIndex(x => x.id === item.id);
    let next = idx === -1 ? [item, ...prev] : prev.map((x, i) => (i === idx ? { ...x, ...item } : x));
    next = next.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    return next;
  };

  const fetchList = async () => {
    setErr("");
    try {
      const res = await fetch("/api/messages", { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data?.message || "โหลดรายการไม่สำเร็จ");
      setItems((prev) => {
        const byId = new Map(prev.map(x => [x.id, x]));
        const merged = data.items?.map(it => ({ ...(byId.get(it.id) || {}), ...it })) ?? [];
        return merged.sort((a,b)=> new Date(b.lastMessageAt||0) - new Date(a.lastMessageAt||0));
      });
    } catch(e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  };

  // initial load + refresh when focus/visible
  useEffect(() => {
    fetchList();
    const onFocus = () => fetchList();
    const onVis = () => { if (document.visibilityState === "visible") fetchList(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // SSE for inbox realtime
  useEffect(() => {
    const es = new EventSource("/api/messages/inbox/events", { withCredentials: true });
    es.onopen = () => { sseConnectedRef.current = true; };
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data || "{}");
        if (payload?.type === "inbox:upsert" && payload.item) {
          setItems(prev => upsert(prev, payload.item));
          lastEventRef.current = Date.now();
          // flash highlight 1.5s
          flashRef.current.set(payload.item.id, Date.now()+1500);
          // clean up expired marks lazily
          setTimeout(() => {
            const now = Date.now();
            for (const [k, t] of flashRef.current) if (t < now) flashRef.current.delete(k);
          }, 2000);
        }
      } catch {}
    };
    es.onerror = () => { sseConnectedRef.current = false; };
    return () => es.close();
  }, []);

  // Polling fallback (20s idle when visible)
  useEffect(() => {
    let stopped = false;
    const loop = async () => {
      if (stopped) return;
      const visible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
      const idle = Date.now() - lastEventRef.current > 20000;
      if (visible && idle) {
        await fetchList();
        lastEventRef.current = Date.now();
      }
      setTimeout(loop, visible ? 20000 : 60000);
    };
    loop();
    return () => { stopped = true; };
  }, []);

  // Connection status indicator updater
  useEffect(() => {
    const tick = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) { setConn("offline"); return; }
      const fresh = Date.now() - lastEventRef.current < 15000;
      setConn(sseConnectedRef.current && fresh ? "live" : "poll");
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, []);

  // keyboard navigation (↑ ↓ Enter)
  useEffect(() => {
    const handler = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(items.length-1, (i<0?0:i+1))); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusIdx(i => Math.max(0, (i<0?0:i-1))); }
      if (e.key === 'Home')      { e.preventDefault(); setFocusIdx(0); }
      if (e.key === 'End')       { e.preventDefault(); setFocusIdx(items.length-1); }
      if (e.key === 'Enter' && focusIdx >= 0) {
        const id = filtered[focusIdx]?.id;
        if (id) router.push(`/messages/${id}`);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, focusIdx]);

  // filter client-side
  const filtered = useMemo(() => {
    const qq = q.trim();
    const base = onlyUnread ? items.filter(i => (i.unread||0) > 0) : items;
    if (!qq) return base;
    const norm = qq.toLowerCase();
    return base.filter(c =>
      (c.title || '').toLowerCase().includes(norm) ||
      (c.lastMessage?.text || '').toLowerCase().includes(norm)
    );
  }, [items, q, onlyUnread]);

  const onClearSearch = () => setQ("");

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/40 to-white">
      {/* header */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_30%,white_0,transparent_40%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">การพูดคุยของฉัน</h1>
            <ConnBadge mode={conn} />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <input
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder="ค้นหาชื่อห้องหรือข้อความล่าสุด…"
                className="w-full rounded-xl text-black border border-white/30 bg-white/90 px-3 py-2 pr-9 text-[15px] outline-none focus:ring-2 focus:ring-blue-200"
              />
              {q && (
                <button onClick={onClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800">✕</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={()=>setOnlyUnread(false)}
                className={`px-3 py-2 rounded-xl text-sm font-medium border ${!onlyUnread? 'bg-white text-blue-900 border-white':'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
              >ทั้งหมด</button>
              <button
                onClick={()=>setOnlyUnread(true)}
                className={`px-3 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 ${onlyUnread? 'bg-white text-blue-900 border-white':'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
              >ยังไม่ได้อ่าน{totalUnread? <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px]">{totalUnread}</span>:null}</button>
              <button onClick={fetchList} className="px-3 py-2 rounded-xl text-sm font-medium border bg-white/10 text-white border-white/30 hover:bg-white/20">รีเฟรช</button>
            </div>
          </div>
        </div>
      </section>

      {/* body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({length:6}).map((_,i)=>
              <div key={i} className="h-16 rounded-2xl bg-slate-100/70 animate-pulse"/>
            )}
          </div>
        ) : err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4 flex items-center justify-between">
            <span>{err}</span>
            <button onClick={fetchList} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg">ลองใหม่</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
            <h3 className="text-blue-900 font-semibold">ไม่พบผลลัพธ์</h3>
            {items.length ? (
              <p className="text-slate-600 text-sm mt-1">ลองเปลี่ยนคำค้นหรือปิดตัวกรอง "ยังไม่ได้อ่าน"</p>
            ) : (
              <p className="text-slate-600 text-sm mt-1">ยังไม่มีการสนทนา — เริ่มจากหน้า ตรวจสอบของหาย แล้วกด “พูดคุย”</p>
            )}
          </div>
        ) : (
          <div role="listbox" aria-label="รายการสนทนา" className="divide-y divide-slate-200 bg-white rounded-2xl border border-slate-100 shadow-sm">
            {filtered.map((c, i) => {
              const focused = i === focusIdx;
              const flashed = (flashRef.current.get(c.id) || 0) > Date.now();
              return (
                <Link
                  key={c.id}
                  href={`/messages/${c.id}`}
                  className={`relative flex items-center gap-3 p-4 hover:bg-slate-50 focus:bg-slate-50 outline-none ${focused? 'ring-2 ring-blue-300 z-10':''} ${flashed? 'bg-blue-50/70':''}`}
                >
                  {/* unread ping */}
                  {!!c.unread && (
                    <span className="absolute left-1 top-1.5 h-2 w-2 rounded-full bg-blue-600">
                      <span className="absolute inset-0 rounded-full animate-ping bg-blue-400/60" />
                    </span>
                  )}

                  {/* avatar */}
                  {c.otherUser?.avatarUrl ? (
                    <img src={c.otherUser.avatarUrl} alt="" className={`h-10 w-10 rounded-full object-cover ring-2 ${c.unread? 'ring-blue-300':'ring-blue-100'}`} />
                  ) : (
                    <div className={`h-10 w-10 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 text-white grid place-items-center text-xs font-bold ring-2 ${c.unread? 'ring-blue-300':'ring-blue-100'}`}>
                      {initials(`${c.otherUser?.firstName||""} ${c.otherUser?.lastName||""}`)}
                    </div>
                  )}

                  <div className="min-w-0 grow">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`truncate ${c.unread? 'font-bold text-blue-900':'font-semibold text-blue-900'}`}>{c.title}</div>
                      <div className="text-[11px] text-slate-500 shrink-0">{formatRelativeOrDate(c.lastMessageAt)}</div>
                    </div>
                    <div className={`text-sm truncate ${c.unread? 'text-slate-800':'text-slate-600'}`}>
                      {c.lastMessage?.type === "IMAGE" ? "📷 รูปภาพ" : (c.lastMessage?.text || "เริ่มสนทนา")}
                    </div>
                  </div>

                  {!!c.unread && (
                    <span className="ml-2 inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-blue-600 text-white text-xs font-semibold">
                      {c.unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ConnBadge({ mode }) {
  const map = {
    live: { text: "เชื่อมต่อสด", dot: "bg-emerald-500", ring: "ring-emerald-300/60" },
    poll: { text: "โหมดประหยัด", dot: "bg-amber-500", ring: "ring-amber-300/60" },
    offline: { text: "ออฟไลน์", dot: "bg-slate-400", ring: "ring-slate-300/60" },
  };
  const m = map[mode] || map.live;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-3 py-1.5 text-xs border border-white/30 ring-2 ${m.ring}`} title={m.text}>
      <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
      <span className="hidden sm:inline">{m.text}</span>
    </div>
  );
}

function initials(name){ return (name?.split(" ").map(s=>s[0]?.toUpperCase()||"").slice(0,2).join("")||"U"); }

function formatDateShort(d){
  if(!d) return "";
  try { return new Date(d).toLocaleString("th-TH",{ dateStyle:"short", timeStyle:"short" }) } catch { return "" }
}

function formatRelativeOrDate(d){
  try{
    const dt = new Date(d);
    const diffMs = Date.now() - dt.getTime();
    const sec = Math.round(diffMs/1000);
    const min = Math.round(sec/60);
    const hr  = Math.round(min/60);
    const day = Math.round(hr/24);
    const rtf = new Intl.RelativeTimeFormat("th-TH", { numeric: "auto" });
    if (sec < 60)  return rtf.format(-sec, "second");
    if (min < 60)  return rtf.format(-min, "minute");
    if (hr  < 24)  return rtf.format(-hr,  "hour");
    if (day < 7)   return rtf.format(-day, "day");
    return formatDateShort(d);
  } catch {
    return formatDateShort(d);
  }
}