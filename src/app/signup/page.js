"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Signup() {
  const router = useRouter();
  const redirectTimer = useRef(null);
  const [step, setStep] = useState(1);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null); // {type:'error'|'success', text:string}
  const [touched, setTouched] = useState({});
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
  });

  useEffect(() => {
    return () => clearTimeout(redirectTimer.current);
  }, []);

  const onChange = (e) => {
    const { id, value } = e.target;
    setForm((p) => ({ ...p, [id]: value }));
  };
  const markTouched = (k) => setTouched((t) => ({ ...t, [k]: true }));

  // validations
  const emailOk = /^\S+@\S+\.\S+$/.test(form.email);
  const phoneOk = /^[0-9]{9,12}$/.test(form.phone);
  const pwdLenOk = form.password.length >= 6;
  const pwdMatch = form.password === form.confirm;
  const step1Valid = !!form.firstName.trim() && !!form.lastName.trim() && phoneOk;
  const step2Valid = emailOk && pwdLenOk && pwdMatch;

  const pwdScore = useMemo(() => {
    let s = 0;
    if (form.password.length >= 6) s++;
    if (/[A-Z]/.test(form.password)) s++;
    if (/[0-9]/.test(form.password)) s++;
    if (/[^A-Za-z0-9]/.test(form.password)) s++;
    return Math.min(s, 4);
  }, [form.password]);

  const next = () => {
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2 && step2Valid) handleSubmit();
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    setServerMsg(null);
    try {
      setSubmitting(true);
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "สมัครไม่สำเร็จ กรุณาลองใหม่");
      }

      setServerMsg({ type: "success", text: data?.message || "สมัครสมาชิกสำเร็จ" });
      setStep(3);
      redirectTimer.current = setTimeout(() => router.push("/signin"), 3000);
    } catch (err) {
      setServerMsg({ type: "error", text: err.message });
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

      <div className="mx-auto max-w-3xl px-4 sm:px-6 -mt-16 sm:-mt-20 pb-16">
        {/* card */}
        <div className="relative bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8">
          {/* top accent line */}


          {/* header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-blue-900">สมัครสมาชิก</h1>
            <p className="text-slate-600 mt-1">แจ้งของหาย • ติดตามสถานะ • เชื่อมต่อคนเจอของกับเจ้าของ</p>
          </div>

          {/* step progress */}
          <Stepper step={step} />

          {/* server message */}
          {serverMsg?.type === "error" && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverMsg.text}
            </div>
          )}
          {serverMsg?.type === "success" && step !== 3 && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {serverMsg.text}
            </div>
          )}

          {/* title per step */}
          <div className="mt-6 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-blue-900">
              {step === 1 && "ข้อมูลติดต่อ"}
              {step === 2 && "ข้อมูลเข้าสู่ระบบ"}
              {step === 3 && "สมัครสมาชิกสำเร็จ"}
            </h2>
            <p className="text-slate-600 text-sm">
              {step === 1 && "กรอกชื่อ-นามสกุล และเบอร์โทรของคุณเพื่อให้ติดต่อได้"}
              {step === 2 && "ใช้อีเมลและรหัสผ่านสำหรับเข้าสู่ระบบครั้งถัดไป"}
              {step === 3 && "บัญชีของคุณพร้อมใช้งานแล้ว"}
            </p>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                id="firstName"
                label="ชื่อ"
                placeholder="เช่น ก้องภพ"
                value={form.firstName}
                onChange={onChange}
                onBlur={() => markTouched("firstName")}
                touched={touched.firstName}
                invalid={!form.firstName.trim()}
                error="กรุณากรอกชื่อ"
                icon={<UserIcon />}
              />
              <FormField
                id="lastName"
                label="นามสกุล"
                placeholder="เช่น ศรีสวัสดิ์"
                value={form.lastName}
                onChange={onChange}
                onBlur={() => markTouched("lastName")}
                touched={touched.lastName}
                invalid={!form.lastName.trim()}
                error="กรุณากรอกนามสกุล"
                icon={<UserIcon />}
              />
              <FormField
                className="sm:col-span-2"
                id="phone"
                type="tel"
                label="เบอร์โทร"
                placeholder="เช่น 0812345678"
                value={form.phone}
                onChange={onChange}
                onBlur={() => markTouched("phone")}
                touched={touched.phone}
                invalid={!phoneOk}
                error="กรอกตัวเลข 9–12 หลัก (ไม่ต้องมีเว้นวรรคหรือขีด)"
                icon={<PhoneIcon />}
                inputProps={{ inputMode: "numeric" }}
              />
            </form>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-4">
              <FormField
                id="email"
                type="email"
                label="อีเมล"
                placeholder="you@example.com"
                value={form.email}
                onChange={onChange}
                onBlur={() => markTouched("email")}
                touched={touched.email}
                invalid={!emailOk}
                error="รูปแบบอีเมลไม่ถูกต้อง"
                icon={<MailIcon />}
              />

              {/* password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)
                </label>
                <div className="mt-1 relative">
                  <InputBase
                    id="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••"
                    value={form.password}
                    onChange={onChange}
                    onBlur={() => markTouched("password")}
                    rightButton={
                      <IconButton
                        onClick={() => setShowPwd((v) => !v)}
                        label={showPwd ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                        icon={showPwd ? <EyeOffIcon /> : <EyeIcon />}
                      />
                    }
                  />
                </div>
                {/* meter */}
                <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={[
                      "h-full transition-all",
                      pwdScore <= 1
                        ? "w-1/4 bg-red-400"
                        : pwdScore === 2
                        ? "w-2/4 bg-yellow-400"
                        : pwdScore === 3
                        ? "w-3/4 bg-blue-500"
                        : "w-full bg-green-500",
                    ].join(" ")}
                  />
                </div>
                {touched.password && !pwdLenOk && (
                  <p className="text-xs text-red-600 mt-1">รหัสผ่านอย่างน้อย 6 ตัวอักษร</p>
                )}
              </div>

              {/* confirm */}
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
                  ยืนยันรหัสผ่าน
                </label>
                <div className="mt-1 relative">
                  <InputBase
                    id="confirm"
                    type={showPwd2 ? "text" : "password"}
                    placeholder="••••••"
                    value={form.confirm}
                    onChange={onChange}
                    onBlur={() => markTouched("confirm")}
                    rightButton={
                      <IconButton
                        onClick={() => setShowPwd2((v) => !v)}
                        label={showPwd2 ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                        icon={showPwd2 ? <EyeOffIcon /> : <EyeIcon />}
                      />
                    }
                  />
                </div>
                {touched.confirm && !pwdMatch && (
                  <p className="text-xs text-red-600 mt-1">รหัสผ่านไม่ตรงกัน</p>
                )}
              </div>
            </form>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-green-100 text-green-700 grid place-items-center">
                <CheckIcon />
              </div>
              <h3 className="text-xl font-semibold text-blue-900">สมัครสมาชิกสำเร็จ!</h3>
              <p className="text-slate-600 mt-1">บัญชีของคุณพร้อมใช้งานแล้ว กำลังพาไปหน้าเข้าสู่ระบบใน 3 วินาที…</p>
              <div className="mt-6">
                <Link
                  href="/signin"
                  className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow hover:shadow-md transition"
                >
                  ไปที่หน้าเข้าสู่ระบบ
                </Link>
              </div>
            </div>
          )}

          {/* actions */}
          {step < 3 && (
            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={back}
                disabled={step === 1 || submitting}
                className={[
                  "rounded-full px-5 py-2.5 text-sm font-medium border transition",
                  step === 1 || submitting
                    ? "text-slate-400 border-slate-200 cursor-not-allowed"
                    : "text-blue-900 border-blue-900/30 hover:bg-blue-50",
                ].join(" ")}
              >
                ย้อนกลับ
              </button>

              <button
                type="button"
                onClick={() => {
                  if (step === 1) ["firstName", "lastName", "phone"].forEach(markTouched);
                  if (step === 2) ["email", "password", "confirm"].forEach(markTouched);
                  next();
                }}
                disabled={submitting || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                className={[
                  "rounded-full px-6 py-2.5 text-sm font-semibold text-white transition",
                  "bg-gradient-to-r from-blue-900 to-blue-700 shadow",
                  submitting || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-md active:scale-95",
                ].join(" ")}
              >
                {step === 1 ? "ขั้นตอนต่อไป" : submitting ? "กำลังสมัคร..." : "สมัครสมาชิก"}
              </button>
            </div>
          )}

          {/* note */}
          {step < 3 && (
            <p className="text-center text-xs text-slate-500 mt-4">
              การสมัครหมายถึงคุณยอมรับ{" "}
              <Link href="/terms" className="underline hover:text-blue-800">
                เงื่อนไขการใช้งาน
              </Link>{" "}
              และ{" "}
              <Link href="/privacy" className="underline hover:text-blue-800">
                นโยบายความเป็นส่วนตัว
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }) {
  const labels = ["ข้อมูลติดต่อ", "ข้อมูลเข้าสู่ระบบ", "สำเร็จ"];
  const total = labels.length;

  // ให้เส้นเริ่ม/จบที่กึ่งกลางวงกลมแรก/สุดท้าย
  const offsetPct = 100 / (total * 2);       // 16.6667% เมื่อ total=3
  const trackWidthPct = 100 - offsetPct * 2; // ✅ ต้อง *2 ไม่ใช่ *3
  const clamped = Math.min(Math.max(step, 1), total);
  const activePct = ((clamped - 1) / (total - 1)) * trackWidthPct;

  return (
    <div className="select-none">
      {/* แถววงกลม (กำหนดความสูงเท่าขนาดจุด แล้ววางเส้นไว้กึ่งกลางแนวตั้ง) */}
      <div className="relative h-9 mb-2">
        {/* เส้นพื้นหลัง */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-slate-200"
          style={{ left: `${offsetPct}%`, width: `${trackWidthPct}%` }}
        />
        {/* เส้น active */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-blue-900 to-blue-700 transition-all duration-300"
          style={{ left: `${offsetPct}%`, width: `${activePct}%` }}
        />

        {/* จุด 1–3 วางทับเส้น */}
        <div className="grid grid-cols-3 relative">
          {labels.map((_, i) => {
            const idx = i + 1;
            const active = step >= idx;
            return (
              <div key={idx} className="flex justify-center">
                <div
                  className={[
                    "z-10 h-9 w-9 rounded-full grid place-items-center text-xs font-bold shadow-sm",
                    active
                      ? "bg-gradient-to-r from-blue-900 to-blue-700 text-white"
                      : "bg-slate-200 text-slate-600",
                  ].join(" ")}
                  aria-label={`Step ${idx}`}
                >
                  {idx}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ป้ายข้อความใต้แต่ละจุด */}
      <div className="grid grid-cols-3">
        {labels.map((label, i) => {
          const idx = i + 1;
          const active = step >= idx;
          return (
            <div key={label} className="text-center">
              <div
                className={[
                  "text-xs font-semibold",
                  active ? "text-blue-900" : "text-slate-500",
                ].join(" ")}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



/* ---------- Small UI primitives (Tailwind only) ---------- */
function FormField({
  id,
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  touched,
  invalid,
  error,
  type = "text",
  icon = null,
  className = "",
  inputProps = {},
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1 relative">
        {icon && <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">{icon}</span>}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={[
            "w-full text-black rounded-xl border bg-white px-4 py-2.5 outline-none transition",
            "focus:border-blue-900 focus:ring-2 focus:ring-blue-200",
            icon ? "pl-10" : "",
            "border-slate-300",
          ].join(" ")}
          {...inputProps}
        />
      </div>
      {touched && invalid && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function InputBase({ id, type, value, onChange, onBlur, placeholder, rightButton }) {
  return (
    <>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-11 outline-none transition focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
      />
      {rightButton}
    </>
  );
}

function IconButton({ onClick, label, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute inset-y-0 right-0 px-3 text-slate-600 hover:text-blue-800"
    >
      {icon}
    </button>
  );
}

/* --------- Icons (pure SVG) --------- */
function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 20c1.5-3.2 4.6-5 8-5s6.5 1.8 8 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13.5l4 1.5v3A2.5 2.5 0 0 1 18.5 21 15.5 15.5 0 0 1 3 5.5 2.5 2.5 0 0 1 5.5 3h1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
