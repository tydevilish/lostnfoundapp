"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function MessagesListPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  const fetchList = async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data?.message || "โหลดรายการไม่สำเร็จ");
      setItems(data.items || []);
    } catch(e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchList(); }, []);

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/40 to-white">
      {/* hero */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_30%,white_0,transparent_40%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">การพูดคุยของฉัน</h1>
          <p className="text-blue-100 text-sm mt-1">รวมทุกห้องแชทที่คุณมี</p>
        </div>
      </section>

      {/* body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({length:6}).map((_,i)=><div key={i} className="h-16 rounded-2xl bg-slate-100/70 animate-pulse"/>)}
          </div>
        ) : err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">{err}</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
            <h3 className="text-blue-900 font-semibold">ยังไม่มีการสนทนา</h3>
            <p className="text-slate-600 text-sm mt-1">เริ่มจากหน้า ตรวจสอบของหาย แล้วกด “พูดคุย” ได้เลย</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 bg-white rounded-2xl border border-slate-100 shadow-sm">
            {items.map((c) => (
              <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50">
                {c.otherUser?.avatarUrl ? (
                  <img src={c.otherUser.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-blue-100" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 text-white grid place-items-center text-xs font-bold ring-2 ring-blue-100">
                    {initials(`${c.otherUser?.firstName||""} ${c.otherUser?.lastName||""}`)}
                  </div>
                )}
                <div className="min-w-0 grow">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-blue-900 truncate">{c.title}</div>
                    <div className="text-[11px] text-slate-500 shrink-0">{formatDateShort(c.lastMessageAt)}</div>
                  </div>
                  <div className="text-sm text-slate-600 truncate">
                    {c.lastMessage?.type === "IMAGE" ? "📷 รูปภาพ" : (c.lastMessage?.text || "เริ่มสนทนา")}
                  </div>
                </div>
                {!!c.unread && (
                  <span className="ml-2 inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-blue-600 text-white text-xs font-semibold">
                    {c.unread}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function initials(name){ return (name?.split(" ").map(s=>s[0]?.toUpperCase()||"").slice(0,2).join("")||"U"); }
function formatDateShort(d){
  if(!d) return "";
  try { return new Date(d).toLocaleString("th-TH",{ dateStyle:"short", timeStyle:"short" }) } catch { return "" }
}
