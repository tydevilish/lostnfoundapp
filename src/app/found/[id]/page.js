// app/found/[id]/page.jsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ====== UI: Spinner & Center Overlay ====== */
function Spinner({ size = 18, className = "" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
function CenterLoading({ label = "กำลังโหลดข้อมูล..." }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="rounded-xl bg-white/85 backdrop-blur px-4 py-3 border border-slate-200 shadow">
        <div className="flex items-center gap-2 text-slate-700">
          <Spinner className="text-blue-700" />
          <span className="font-medium">{label}</span>
        </div>
      </div>
    </div>
  );
}

export default function FoundDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [err, setErr] = useState("");
  const [updating, setUpdating] = useState(false);

  // รูป: สถานะการโหลดของ cover และ thumbs
  const [coverReady, setCoverReady] = useState(false);
  const [thumbReady, setThumbReady] = useState({}); // {index: boolean}

  const fetchDetail = async () => {
    setLoading(true);
    setErr("");
    setCoverReady(false);
    setThumbReady({});
    try {
      const res = await fetch(`/api/found/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "โหลดข้อมูลไม่สำเร็จ");
      setItem(data.item || null);
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const statusResolved = useMemo(() => {
    const s = (item?.statusLower || item?.status || "").toString();
    return s.toLowerCase() === "resolved";
  }, [item]);

  const reporterName = useMemo(
    () => item?.reporterName || "ฉัน",
    [item?.reporterName]
  );

  const updateStatus = async () => {
    if (!item || statusResolved) return;
    if (!confirm("ยืนยันเปลี่ยนสถานะเป็น 'ส่งคืนแล้ว' ?")) return;
    try {
      setUpdating(true);
      const res = await fetch(`/api/found/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "อัปเดตสถานะไม่สำเร็จ");
      }
      await fetchDetail();
    } catch (e) {
      alert(e.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    // สเกลตัน + overlay กลางหน้า
    return (
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="h-9 w-40 rounded bg-slate-200 animate-pulse mb-4" />
        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
        <CenterLoading />
      </div>
    );
  }

  if (err || !item) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="text-xl font-bold text-blue-900 mb-2">ไม่พบข้อมูล</h1>
        <p className="text-slate-600 mb-6">
          {err || "อาจถูกลบ/ไม่มีสิทธิ์เข้าถึงรายการนี้"}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={fetchDetail}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-blue-900 border border-blue-900/30 hover:bg-blue-50"
          >
            <Spinner className="text-blue-900" />
            ลองใหม่
          </button>
          <Link
            href="/found"
            className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow hover:shadow-md"
          >
            ← กลับไปหน้าของที่ฉันแจ้งพบ
          </Link>
        </div>
      </div>
    );
  }

  const cover = item.images?.[0];
  const thumbs = (item.images || []).slice(1);

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/40 to-white">
      {/* hero */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_30%,white_0,transparent_40%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-blue-100 text-xs sm:text-sm">
                <Link href="/found" className="underline hover:opacity-90">
                  ของที่ฉันแจ้งพบ
                </Link>{" "}
                / รายละเอียด
              </p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-white truncate">
                {item.name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  statusResolved
                    ? "bg-green-500/90 text-white"
                    : "bg-amber-500/90 text-white",
                ].join(" ")}
              >
                {statusResolved ? "ส่งคืนแล้ว" : "รอเจ้าของรับคืน"}
              </span>
              {!statusResolved && (
                <button
                  onClick={updateStatus}
                  disabled={updating}
                  className={[
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 shadow-sm transition border border-white/30 backdrop-blur",
                    updating ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                  title="เปลี่ยนสถานะเป็นส่งคืนแล้ว"
                >
                  {updating && <Spinner className="text-white" size={16} />}
                  {updating ? "กำลังอัปเดต..." : "ส่งคืนแล้ว ✓"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* gallery */}
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <div className="relative sm:col-span-4 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
            {cover ? (
              <>
                {!coverReady && (
                  <div className="absolute inset-0 grid place-items-center">
                    <Spinner className="text-slate-400" />
                  </div>
                )}
                <img
                  src={cover}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setCoverReady(true)}
                  className={`w-full h-[260px] sm:h-[360px] object-cover transition-opacity duration-300 ${
                    coverReady ? "opacity-100" : "opacity-0"
                  }`}
                />
              </>
            ) : (
              <div className="h-[260px] sm:h-[360px] grid place-items-center text-slate-400">
                ไม่มีรูปหน้าปก
              </div>
            )}
          </div>

          <div className="sm:col-span-2 grid grid-cols-4 sm:grid-cols-2 gap-3">
            {thumbs.length > 0 ? (
              thumbs.map((src, i) => (
                <div
                  key={i}
                  className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-100"
                >
                  {!thumbReady[i] && (
                    <div className="absolute inset-0 grid place-items-center">
                      <Spinner className="text-slate-400" />
                    </div>
                  )}
                  <img
                    src={src}
                    alt={`photo-${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    onLoad={() =>
                      setThumbReady((t) => ({ ...t, [i]: true }))
                    }
                    className={`w-full h-28 object-cover transition-opacity duration-300 ${
                      thumbReady[i] ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-4 sm:col-span-2 text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 grid place-items-center p-4 bg-white/60">
                ยังไม่มีรูปเพิ่มเติม
              </div>
            )}
          </div>
        </div>

        {/* info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* left info */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-bold text-blue-900">รายละเอียด</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Info label="ประเภท">{item.category || "-"}</Info>
              <Info label="สถานที่">{item.place || "-"}</Info>
              <Info label="วัน–เวลา">{formatDate(item.datetime)}</Info>
              <Info label="สี/ลักษณะเด่น">{item.color || "-"}</Info>
              <Info label="ยี่ห้อ/รุ่น">{item.brand || "-"}</Info>
            </div>
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                รายละเอียดเพิ่มเติม
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-slate-700">
                {item.description || "-"}
              </p>
            </div>
          </div>

          {/* reporter */}
          <div className="lg:col-span-1 rounded-2xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6">
            <h3 className="text-lg font-bold text-blue-900">ผู้แจ้งพบ</h3>
            <div className="mt-4 flex items-center gap-3">
              {item.createdBy?.avatarUrl ? (
                <img
                  src={item.createdBy.avatarUrl}
                  alt={reporterName}
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-blue-100"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 text-white grid place-items-center text-sm font-bold ring-2 ring-blue-100">
                  {initials(reporterName)}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-medium text-blue-900 truncate">
                  {reporterName}
                </div>
                <div className="text-xs text-slate-500">
                  สถานะ:{" "}
                  <span
                    className={
                      statusResolved ? "text-green-700" : "text-amber-700"
                    }
                  >
                    {statusResolved ? "ส่งคืนแล้ว" : "รอเจ้าของรับคืน"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 truncate">
                  อีเมล:{" "}
                  {item.createdBy?.email ? (
                    <a href={`mailto:${item.createdBy.email}`}>
                      {item.createdBy.email}
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  โทร:{" "}
                  {item.createdBy?.phone ? (
                    <a href={`tel:${item.createdBy.phone}`}>
                      {item.createdBy.phone}
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
            </div>

            <div
              className="mt-4 text-xs text-slate-500"
              aria-live="polite"
              aria-atomic="true"
            >
              * หน้านี้เห็นได้เฉพาะผู้ที่เป็นผู้แจ้งพบรายการนี้เท่านั้น
            </div>
          </div>
        </div>

        {/* back */}
        <div className="pt-2">
          <button
            onClick={() => router.push("/found")}
            className="rounded-full px-4 py-2 text-sm font-medium border text-blue-900 border-blue-900/30 hover:bg-blue-50"
          >
            ← กลับไปหน้ารายการของฉัน
          </button>
        </div>
      </div>
    </div>
  );
}

/* small UI */
function Info({ label, children }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-slate-700">{children}</div>
    </div>
  );
}

function initials(name) {
  return (
    name
      ?.split(" ")
      .map((s) => s[0]?.toUpperCase() || "")
      .slice(0, 2)
      .join("") || "U"
  );
}

function formatDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    return dt.toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return d;
  }
}
