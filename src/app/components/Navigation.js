"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Navigation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const menuRef = useRef(null);

  // ✅ ใช้คลาสรวมกันเพื่อกันตกลำดับบรรทัดในภาษาไทย
  const NO_WRAP = "whitespace-nowrap [word-break:keep-all] [hyphens:none]";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (alive && res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {} finally {
        if (alive) setChecking(false);
      }
    })();
    return () => (alive = false);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const signOut = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    setUser(null); setMenuOpen(false); setOpen(false);
    window.location.href = "/";
  };

  const initials = (fn = "", ln = "") =>
    `${(fn[0] || "").toUpperCase()}${(ln[0] || "").toUpperCase()}` || "U";

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3">
              <img src="/logo/logo.png" alt="logo" className="h-19 w-auto" />
            </Link>

            {/* Desktop menu */}
            <div className="hidden md:flex items-center">
              <Link href="/" className={`rounded-full text-blue-900 px-4 py-2 text-md font-medium transition hover:text-yellow-400 ${NO_WRAP}`}>
                หน้าแรก
              </Link>
              <Link href="/found" className={`rounded-full text-blue-900 px-4 py-2 text-md font-medium transition hover:text-yellow-400 ${NO_WRAP}`}>
                แจ้งพบของ
              </Link>
              <Link href="/lost" className={`rounded-full text-blue-900 px-4 py-2 text-md font-medium transition hover:text-yellow-400 ${NO_WRAP}`}>
                ตรวจสอบของหาย
              </Link>
              <Link href="/messages" className={`rounded-full text-blue-900 px-4 py-2 text-md font-medium transition hover:text-yellow-400 ${NO_WRAP}`}>
                การพูดคุย
              </Link>
            </div>
          </div>

          {/* Right (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {checking ? (
              <div className="h-9 w-36 rounded-full bg-slate-200/60 animate-pulse" />
            ) : user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="group flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1.5 pr-2 shadow-sm hover:shadow transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="avatar" className="h-9 w-9 rounded-full object-cover ring-2 ring-blue-200" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 text-white grid place-items-center ring-2 ring-blue-200">
                      <span className="text-sm font-bold">{initials(user.firstName, user.lastName)}</span>
                    </div>
                  )}

                  <div className="hidden sm:flex flex-col items-start leading-tight mr-1">
                    {/* ✅ กันชื่อตกบรรทัด */}
                    <span className={`text-blue-900 text-sm font-semibold truncate max-w-[160px] ${NO_WRAP}`}>
                      {user.firstName} {user.lastName}
                    </span>
                    <span className={`text-xs text-slate-500 -mt-0.5 ${NO_WRAP}`}>บัญชีของฉัน</span>
                  </div>

                  <svg width="18" height="18" viewBox="0 0 24 24"
                       className={`text-slate-500 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                  </svg>
                </button>

                <div
                  role="menu"
                  className={`absolute right-0 mt-2 w-72 origin-top-right rounded-xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl p-2 transition-all duration-150
                              ${menuOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"}`}
                >
                  <span className="absolute -top-2 right-8 block w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45" />
                  <div className="px-3 py-2">
                    <div className={`text-sm font-semibold text-blue-900 ${NO_WRAP}`}>
                      {user.firstName} {user.lastName}
                    </div>
                    <div className={`text-xs text-slate-500 truncate ${NO_WRAP}`}>{user.email}</div>
                  </div>
                  <div className="my-1 h-px bg-slate-100" />
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-900 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${NO_WRAP}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
                      <path d="M4 20c1.5-3.2 4.6-5 8-5s6.5 1.8 8 5" stroke="currentColor" strokeWidth="1.8" fill="none" />
                    </svg>
                    ข้อมูลส่วนตัว
                  </Link>
                  <button
                    onClick={signOut}
                    role="menuitem"
                    className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none ${NO_WRAP}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path d="M10 12h9m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                      <path d="M4 5a2 2 0 0 1 2-2h4m0 0h0v18h0M6 21a2 2 0 0 1-2-2V5" stroke="currentColor" strokeWidth="1.8" fill="none" />
                    </svg>
                    ออกจากระบบ
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link
                  href="/signin"
                  className={`rounded-full border border-blue-900/20 text-blue-900 px-4 py-2 text-md font-medium hover:bg-blue-50 transition ${NO_WRAP}`}
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/signup"
                  className={`rounded-full px-5 py-2 text-md font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow-sm hover:shadow transition ${NO_WRAP}`}
                  aria-label="สมัครสมาชิก"
                >
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </div>

          {/* Mobile: burger */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-blue-900 hover:bg-blue-50"
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu panel */}
        <div className={`md:hidden transition-all duration-300 overflow-hidden ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="pb-4 flex flex-col gap-2">
            <Link href="/" onClick={() => setOpen(false)}
              className={`rounded-full text-blue-900 px-4 py-2 text-md font-medium transition hover:text-yellow-400 ${NO_WRAP}`}>
              หน้าแรก
            </Link>
            <Link href="/found" onClick={() => setOpen(false)}
              className={`rounded-full text-blue-900 px-4 py-2 text-md font-medium transition hover:text-yellow-400 ${NO_WRAP}`}>
              แจ้งพบของ
            </Link>
            <Link href="/lost" onClick={() => setOpen(false)}
              className={`rounded-full text-blue-900 px-4 py-2 text-md font-medium transition hover:text-yellow-400 ${NO_WRAP}`}>
              ตรวจสอบของหาย
            </Link>
            <Link href="/messages" onClick={() => setOpen(false)}
              className={`rounded-full text-blue-900 px-4 py-2 text-md font-medium transition hover:text-yellow-400 ${NO_WRAP}`}>
              การพูดคุย
            </Link>

            {/* โปรไฟล์ในมือถือ */}
            {checking ? (
              <div className="mt-2 h-10 rounded-xl bg-slate-200/60 animate-pulse" />
            ) : user ? (
              <>
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 text-white flex items-center justify-center ring-2 ring-blue-200 text-sm font-bold">
                    {initials(user.firstName, user.lastName)}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold text-blue-900 truncate ${NO_WRAP}`}>
                      {user.firstName} {user.lastName}
                    </div>
                    <div className={`text-xs text-slate-500 truncate ${NO_WRAP}`}>{user.email}</div>
                  </div>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className={`rounded-full px-4 py-2 text-md font-medium text-blue-900 text-center border border-blue-900/20 hover:bg-blue-50 transition ${NO_WRAP}`}
                >
                  ข้อมูลส่วนตัว
                </Link>
                <button
                  onClick={signOut}
                  className={`rounded-full px-4 py-2 text-md font-semibold text-red-600 text-center border border-red-200 hover:bg-red-50 transition ${NO_WRAP}`}
                >
                  ออกจากระบบ
                </button>
              </>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <Link
                  href="/signin"
                  onClick={() => setOpen(false)}
                  className={`flex-1 rounded-full border border-blue-900/20 text-blue-900 px-4 py-2 text-md font-medium text-center hover:bg-blue-50 transition ${NO_WRAP}`}
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className={`flex-1 rounded-full px-4 py-2 text-md font-semibold text-white text-center bg-gradient-to-r from-blue-900 to-blue-700 shadow-sm hover:shadow transition ${NO_WRAP}`}
                >
                  สมัครสมาชิก
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
