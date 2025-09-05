"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "หน้าแรก", icon: "home" },
  { href: "/found", label: "แจ้งพบของ", icon: "plus" },
  { href: "/track", label: "ตรวจสอบของหาย", icon: "search" },
];

function Icon({ name, active }) {
  const common = "w-5 h-5";
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none">
          <path
            d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19.5v-9Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 21v-6h6v6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 8v8M8 12h8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none">
          <circle
            cx="11"
            cy="11"
            r="7"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M20 20l-3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function Footer() {
  const pathname = usePathname();
  const isActive = (href) => pathname === href;

  return (
    <footer className="bg-white border-t border-slate-200">
      {/* Bottom small print (optional) */}
      <div className="block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="py-3 text-center text-sm text-slate-500">
            © {new Date().getFullYear()} LostnFound — ศูนย์กลางแจ้งของหาย
          </div>
        </div>
      </div>
    </footer>
  );
}
