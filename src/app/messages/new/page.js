"use client";
import { Suspense } from "react";
import ClientNewConversation from "./ClientNewConversation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function Spinner({ size = 18, className = "" }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-90" />
    </svg>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] grid place-items-center px-4 sm:px-6">
          <div className="rounded-xl bg-white/90 backdrop-blur px-5 py-4 border border-slate-200 shadow">
            <div className="flex items-center gap-2 text-slate-700">
              <Spinner className="text-blue-700" />
              <span className="font-medium">กำลังเปิดห้องสนทนา…</span>
            </div>
          </div>
        </div>
      }
    >
      <ClientNewConversation />
    </Suspense>
  );
}
