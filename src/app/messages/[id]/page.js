"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ChatRoomPage(){
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState(null);
  const [err, setErr] = useState("");
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  const fetchConv = async () => {
    setLoading(true); setErr("");
    try{
      const res = await fetch(`/api/messages/${id}`, { cache: "no-store" });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data?.message || "โหลดห้องไม่สำเร็จ");
      setConv(data.conversation);
    }catch(e){ setErr(e.message||"เกิดข้อผิดพลาด"); }
    finally{ setLoading(false); }
  };

  const fetchMessages = async (reset=false) => {
    const q = new URLSearchParams(); if(!reset && cursor) q.set("cursor", cursor);
    const res = await fetch(`/api/messages/${id}/messages?${q.toString()}`, { cache:"no-store" });
    const data = await res.json().catch(()=>({}));
    if(res.ok){
      if(reset){
        setMessages(data.messages||[]);
      } else {
        // prepend older
        setMessages(prev => [...(data.messages||[]), ...prev]);
      }
      setCursor(data.nextCursor || null);
      // mark read
      fetch(`/api/messages/${id}/read`, { method: "POST" }).catch(()=>{});
    }
  };

  useEffect(()=>{ if(id){ fetchConv(); fetchMessages(true); } }, [id]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages.length]);

  const send = async () => {
    const msg = text.trim();
    if(!msg || sending) return;
    try{
      setSending(true);
      const res = await fetch(`/api/messages/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ text: msg })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || data?.success === false) throw new Error(data?.message || "ส่งข้อความไม่สำเร็จ");
      setText("");
      // append new
      setMessages(prev => [...prev, data.message]);
      bottomRef.current?.scrollIntoView({ behavior:"smooth" });
    }catch(e){ alert(e.message); }
    finally{ setSending(false); }
  };

  if(loading){
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-9 w-40 rounded bg-slate-200 animate-pulse mb-4"/>
      <div className="h-64 rounded-2xl bg-slate-100 animate-pulse"/>
    </div>;
  }
  if(err || !conv){
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center">
      <h1 className="text-xl font-bold text-blue-900 mb-2">ไม่พบห้องแชท</h1>
      <p className="text-slate-600 mb-6">{err || "อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง"}</p>
      <Link href="/messages" className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow hover:shadow-md">← กลับรายการแชท</Link>
    </div>;
  }

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/40 to-white">
      {/* header */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 text-white">
            <Link href="/messages" className="rounded-full px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/30">←</Link>
            {conv.otherUser?.avatarUrl ? (
              <img src={conv.otherUser.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-blue-100"/>
            ) : (
              <div className="h-8 w-8 rounded-full bg-white/20 grid place-items-center text-xs font-bold">
                {initials(`${conv.otherUser?.firstName||""} ${conv.otherUser?.lastName||""}`)}
              </div>
            )}
            <div className="font-semibold truncate">{conv.title}</div>
          </div>
        </div>
      </section>

      {/* chat body */}
      <div className="max-w-6xl mx-auto px-2 sm:px-6 py-4">
        <div className="mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm grid grid-rows-[auto,auto,1fr,auto] min-h-[60vh]">
          {/* load older */}
          <div className="p-3 text-center">
            {cursor ? (
              <button onClick={()=>fetchMessages(false)} className="text-sm text-blue-900 underline">โหลดข้อความก่อนหน้า</button>
            ) : (
              <span className="text-xs text-slate-400">เริ่มต้นการสนทนา</span>
            )}
          </div>

          {/* messages */}
          <div className="px-3 sm:px-4 pb-3 overflow-y-auto">
            {messages.map((m) => (
              <Bubble key={m.id} mine={false /* server ไม่ส่ง selfId; ไว้เพิ่มใน realtime ภายหลัง */} msg={m} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div className="p-3 sm:p-4 border-t border-slate-100 bg-white rounded-b-2xl">
            <div className="flex items-end gap-2">
              {/* (ส่วน emoji/อัปโหลดรูป จะใส่ในส่วนถัดไป) */}
              <textarea
                value={text}
                onChange={(e)=>setText(e.target.value)}
                rows={1}
                placeholder="พิมพ์ข้อความ..."
                onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } }}
                className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200 text-black"
              />
              <button
                onClick={send}
                disabled={sending || !text.trim()}
                className={["rounded-full px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700",
                  (sending||!text.trim()) ? "opacity-60 cursor-not-allowed" : "hover:shadow"].join(" ")}
              >
                ส่ง
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg, mine }){
  const isImage = msg.type === "IMAGE" && msg.attachments?.length;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} my-1.5`}>
      <div className={`max-w-[78%] rounded-2xl px-3 py-2 shadow-sm border ${mine ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-800 border-slate-200"}`}>
        {isImage ? (
          <div className="grid grid-cols-2 gap-2">
            {msg.attachments.map((u,i)=><img key={i} src={u} alt="" className="rounded-lg object-cover max-h-40"/>)}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-[15px]">{msg.text}</div>
        )}
        <div className={`text-[10px] mt-1 ${mine ? "text-white/80" : "text-slate-400"}`}>{formatTime(msg.createdAt)}</div>
      </div>
    </div>
  );
}

function initials(name){ return (name?.split(" ").map(s=>s[0]?.toUpperCase()||"").slice(0,2).join("")||"U"); }
function formatTime(d){ try{ return new Date(d).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}) }catch{return ""} }
