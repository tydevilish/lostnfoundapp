// app/messages/new/page.jsx
"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewConversationPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const called = useRef(false); // ★ กันซ้ำ

  useEffect(() => {
    if (called.current) return;      // ★ กันซ้ำ
    called.current = true;           // ★ กันซ้ำ

    const to = qs.get("to");
    const item = qs.get("item");
    if (!to) { router.replace("/messages"); return; }

    (async () => {
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, item }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
          throw new Error(data?.message || "สร้างห้องไม่สำเร็จ");
        }
        router.replace(`/messages/${data.conversationId}`);
      } catch (e) {
        alert(e.message || "เกิดข้อผิดพลาด");
        router.replace("/messages");
      }
    })();
  }, [qs, router]);

  return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center">กำลังเปิดห้องสนทนา…</div>;
}
