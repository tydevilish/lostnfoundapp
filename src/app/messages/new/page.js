import { Suspense } from "react";
import ClientNewConversation from "./ClientNewConversation";

// กัน Next พยายาม SSG เพจนี้ (เลือกใส่เพื่อชัวร์บน Vercel)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl text-black mx-auto px-4 sm:px-6 py-12 text-center">
          กำลังเปิดห้องสนทนา…
        </div>
      }
    >
      <ClientNewConversation />
    </Suspense>
  );
}
