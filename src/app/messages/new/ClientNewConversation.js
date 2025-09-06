"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

/* --- small UI: spinner + center overlay --- */
function Spinner({ size = 18, className = "" }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-90" />
    </svg>
  );
}
function CenterCreating({ label = "กำลังเปิดห้องสนทนา…" }) {
  const el = (
    <div className="fixed inset-0 z-[80] grid place-items-center">
      <div className="rounded-xl bg-white/95 backdrop-blur px-4 py-3 border border-slate-200 shadow">
        <div className="flex items-center gap-2 text-slate-700">
          <Spinner className="text-blue-700" />
          <span className="font-medium">{label}</span>
        </div>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(el, document.body) : null;
}

export default function ClientNewConversation() {
  const router = useRouter();
  const qs = useSearchParams();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const to = qs.get("to");
    const item = qs.get("item");
    if (!to) {
      router.replace("/messages");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, item }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.conversationId) {
          throw new Error(data?.message || "สร้างห้องไม่สำเร็จ");
        }
        router.replace(`/messages/${data.conversationId}`);
      } catch (e) {
        console.error(e);
        alert(e.message || "เกิดข้อผิดพลาด");
        router.replace("/messages");
      }
    })();
  }, [qs, router]);

  // 🔵 แสดง overlay หมุน ๆ ไว้ระหว่างสร้าง/redirect (เผื่อไม่มี Suspense หุ้ม)
  return <CenterCreating />;
}
