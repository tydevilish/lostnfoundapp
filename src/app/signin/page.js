"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Signin() {
  const router = useRouter();
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", remember: true });

  const emailOk = /^\S+@\S+\.\S+$/.test(form.email);
  const pwdOk = form.password.length >= 6;

  const onChange = (e) => {
    const { id, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [id]: type === "checkbox" ? checked : value }));
  };

  const submit = async (e) => {
    e?.preventDefault();
    setServerMsg(null);
    if (!emailOk || !pwdOk) {
      setServerMsg({ type: "error", text: "กรอกอีเมล/รหัสผ่านให้ถูกต้อง" });
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "เข้าสู่ระบบไม่สำเร็จ");
      }
      window.location.href = "/";
    } catch (e) {
      setServerMsg({ type: "error", text: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/50 to-white">
      {/* cover */}
      <div className="h-36 sm:h-44 bg-gradient-to-r from-blue-900 to-blue-700 relative">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_30%,white_0,transparent_40%)]" />
      </div>

      <div className="mx-auto max-w-xl px-4 sm:px-6 -mt-16 sm:-mt-20 pb-16">
        {/* card */}
        <div className="relative bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8">
          {/* top accent */}

          {/* header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-blue-900">
              เข้าสู่ระบบ
            </h1>
            <p className="text-slate-600 mt-1">
              ยินดีต้อนรับกลับสู่ LostnFound
            </p>
          </div>

          {/* server message */}
          {serverMsg?.type === "error" && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverMsg.text}
            </div>
          )}

          <form className="space-y-4" onSubmit={submit}>
            {/* email */}
            <Field label="อีเมล" htmlFor="email">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!form.email && !emailOk}
                  className={[
                    "w-full text-black rounded-xl border bg-white px-4 py-2.5 pl-10 outline-none transition",
                    "focus:border-blue-900 focus:ring-2 focus:ring-blue-200",
                    "border-slate-300",
                  ].join(" ")}
                />
              </div>
              {!!form.email && !emailOk && (
                <p className="mt-1 text-xs text-red-600">
                  รูปแบบอีเมลไม่ถูกต้อง
                </p>
              )}
            </Field>

            {/* password */}
            <Field label="รหัสผ่าน" htmlFor="password">
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={onChange}
                  placeholder="••••••"
                  autoComplete="current-password"
                  aria-invalid={!!form.password && !pwdOk}
                  className="w-full text-black rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-11 outline-none transition focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  className="absolute inset-y-0 right-0 px-3 text-slate-600 hover:text-blue-800"
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={form.remember}
                    onChange={onChange}
                    className="h-4 w-4 rounded border-slate-300   focus:ring-blue-200"
                  />
                  จำฉันไว้
                </label>
                <Link
                  href="#"
                  className="text-sm text-blue-800 hover:underline"
                >
                  ลืมรหัสผ่าน ?{" "}
                  <span className="text-gray-900 text-sm bold">
                    ติดต่อผู้ดูแลระบบ
                  </span>
                </Link>
              </div>
              {!!form.password && !pwdOk && (
                <p className="mt-1 text-xs text-red-600">
                  รหัสผ่านอย่างน้อย 6 ตัวอักษร
                </p>
              )}
            </Field>

            {/* action */}
            <button
              type="submit"
              disabled={submitting}
              className={[
                "w-full rounded-full px-6 py-2.5 text-sm font-semibold text-white transition",
                "bg-gradient-to-r from-blue-900 to-blue-700 shadow",
                submitting
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:shadow-md active:scale-95",
              ].join(" ")}
            >
              {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>

            <p className="text-center text-sm text-slate-600">
              ยังไม่มีบัญชี?{" "}
              <Link href="/signup" className="text-blue-800 hover:underline">
                สมัครสมาชิก
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ----- small UI ---- */
function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/* icons (SVG) */
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4 7l8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
