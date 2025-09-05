"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

  // UI จริงจะแสดงจาก fallback ของ Suspense แทน
  return null;
}
