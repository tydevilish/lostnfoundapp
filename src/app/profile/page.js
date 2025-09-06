// app/profile/page.jsx
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {type:'success'|'error', text}
  const [user, setUser] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const fetchMe = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return router.replace("/signin");
      const data = await res.json().catch(() => ({}));
      setUser(data?.user || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const onChange = (e) => {
    const { id, value } = e.target;
    setUser((u) => ({ ...u, [id]: value }));
  };

  // บันทึก: อัปโหลดรูป (ถ้ามี) + อัปเดตโปรไฟล์
  const saveProfile = async () => {
    setMsg(null);
    setSaving(true);
    try {
      const hasNewAvatar = !!fileRef.current?.files?.[0];

      if (hasNewAvatar) {
        const form = new FormData();
        form.append("file", fileRef.current.files[0]);
        const upRes = await fetch("/api/user/avatar", {
          method: "POST",
          body: form,
        });
        const upData = await upRes.json().catch(() => ({}));
        if (!upRes.ok || upData?.success === false) {
          throw new Error(upData?.message || "อัปโหลดรูปไม่สำเร็จ");
        }
        setUser((u) => ({ ...u, ...upData.user })); // sync avatarUrl (data URL)
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "บันทึกโปรไฟล์ไม่สำเร็จ");
      }

      setUser(data.user);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
      if (fileRef.current) fileRef.current.value = "";

      setMsg({
        type: "success",
        text: hasNewAvatar
          ? "อัปโหลดรูปและบันทึกโปรไฟล์สำเร็จ"
          : "บันทึกโปรไฟล์สำเร็จ",
      });
      window.location.reload();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <div className="w-10 h-10 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const initials =
    ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() ||
    "U";

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-yellow-100/50 to-white">
      {/* cover */}
      <div className="h-36 sm:h-44 bg-gradient-to-r from-blue-900 to-blue-700 relative">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_30%,white_0,transparent_40%)]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20 pb-16">
        <div className="relative bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative shrink-0">
              {preview ? (
                <img
                  src={preview}
                  alt="preview"
                  className="h-28 w-28 sm:h-32 sm:w-32 rounded-full object-cover ring-4 ring-blue-100 shadow-md"
                />
              ) : user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="avatar"
                  className="h-28 w-28 sm:h-32 sm:w-32 rounded-full object-cover ring-4 ring-blue-100 shadow-md"
                />
              ) : (
                <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full grid place-items-center text-white ring-4 ring-blue-100 shadow-md bg-gradient-to-br from-blue-900 to-blue-700">
                  <span className="text-2xl font-bold">{initials}</span>
                </div>
              )}

              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full text-black bg-white shadow ring-1 ring-slate-200 grid place-items-center hover:bg-blue-50 transition"
                aria-label="เปลี่ยนรูปโปรไฟล์"
              >
                <CameraIcon />
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onPickFile}
              />
            </div>

            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-blue-900">
                โปรไฟล์ของฉัน
              </h1>
              <p className="text-slate-600 mt-1">
                แก้ไขข้อมูลส่วนตัวและเพิ่มรูปโปรไฟล์ของคุณ
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full border border-blue-900/25 text-blue-900 px-4 py-2 text-sm font-medium hover:bg-blue-50 transition"
                >
                  เลือกรูปใหม่
                </button>
                {preview && (
                  <span className="text-xs text-slate-500">
                    มีรูปที่เลือกไว้ • จะอัปโหลดตอนกด “บันทึกโปรไฟล์”
                  </span>
                )}
              </div>
            </div>
          </div>

          {msg && (
            <div
              className={[
                "mt-6 rounded-xl border px-4 py-3 text-sm",
                msg.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700",
              ].join(" ")}
            >
              {msg.text}
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="ชื่อ" htmlFor="firstName">
              <InputIconLeft
                id="firstName"
                value={user.firstName || ""}
                onChange={onChange}
                placeholder="เช่น ก้องภพ"
                icon={<UserIcon />}
              />
            </Field>

            <Field label="นามสกุล" htmlFor="lastName">
              <InputIconLeft
                id="lastName"
                value={user.lastName || ""}
                onChange={onChange}
                placeholder="เช่น ศรีสวัสดิ์"
                icon={<UserIcon />}
              />
            </Field>

            <Field label="อีเมล (แก้ไขไม่ได้)" htmlFor="email" full>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  value={user.email || ""}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pl-10 text-slate-500"
                />
              </div>
            </Field>

            <Field label="เบอร์โทร" htmlFor="phone" full>
              <InputIconLeft
                id="phone"
                value={user.phone || ""}
                onChange={onChange}
                placeholder="เช่น 0812345678"
                icon={<PhoneIcon />}
                inputMode="numeric"
              />
            </Field>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={fetchMe}
              disabled={saving}
              className="rounded-full px-5 py-2.5 text-sm font-medium border text-blue-900 border-blue-900/30 hover:bg-blue-50 transition disabled:opacity-60"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className={[
                "rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow",
                saving
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:shadow-md active:scale-95",
              ].join(" ")}
            >
              {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- UI bits ---------- */
function Field({ label, htmlFor, children, full = false }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold tracking-wide uppercase text-slate-500"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function InputIconLeft({ id, value, onChange, placeholder, icon, inputMode }) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
        {icon}
      </span>
      <input
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full text-black rounded-xl border border-slate-300 bg-white px-4 py-2.5 pl-10 outline-none transition focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}

/* ---------- Icons (SVG) ---------- */
function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.5-2h4L15.5 6H18A2.5 2.5 0 0 1 20.5 8.5V18A2 2 0 0 1 18.5 20h-13A2 2 0 0 1 3.5 18V8.5z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 20c1.5-3.2 4.6-5 8-5s6.5 1.8 8 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
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
