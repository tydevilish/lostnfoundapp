// app/lost/[id]/page.jsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function LostDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [err, setErr] = useState("");

  // 👇 โหลดข้อมูลผู้ใช้ปัจจุบัน เพื่อตรวจว่าเป็นของตัวเองหรือไม่
  const [me, setMe] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        if (!alive) return;
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setMe(data?.user || null);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const fetchDetail = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/lost/${id}`, { cache: "no-store" });
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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="h-9 w-40 rounded bg-slate-200 animate-pulse mb-4" />
        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (err || !item) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="text-xl font-bold text-blue-900 mb-2">ไม่พบข้อมูล</h1>
        <p className="text-slate-600 mb-6">
          {err || "อาจถูกลบหรือไม่มีข้อมูลรายการนี้"}
        </p>
        <Link
          href="/lost"
          className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow hover:shadow-md"
        >
          ← กลับไปหน้ารายการทั้งหมด
        </Link>
      </div>
    );
  }

  const statusResolved = String(item.status).toUpperCase() === "RESOLVED";
  const reporterName =
    `${item?.createdBy?.firstName || ""} ${item?.createdBy?.lastName || ""}`.trim() || "ผู้แจ้งไม่ระบุ";
  const cover = item.images?.[0];

  // 👇 เช็คว่าเป็นของฉันหรือไม่
  const ownerIds = [item.createdById, item.createdBy?.id, item.ownerId, item.owner?.id].filter(Boolean);
  const isMine = !!me?.id && ownerIds.some((oid) => String(oid) === String(me.id));
  const chatTo = item.createdById ?? item.createdBy?.id ?? "";

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/40 to-white">
      {/* hero */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_30%,white_0,transparent_40%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-blue-100 text-xs sm:text-sm">
                <Link href="/lost" className="underline hover:opacity-90">
                  รายการของหายทั้งหมด
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
                  statusResolved ? "bg-green-500/90 text-white" : "bg-amber-500/90 text-white",
                ].join(" ")}
              >
                {statusResolved ? "ส่งคืนแล้ว" : "รอเจ้าของรับคืน"}
              </span>

              {/* 👇 ปุ่มพูดคุย (ซ่อนเมื่อเป็นของฉัน) */}
              {!isMine && chatTo && (
                <Link
                  href={`/messages/new?to=${chatTo}&item=${item.id}`}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 shadow-sm transition border border-white/30 backdrop-blur"
                  title="พูดคุยกับผู้แจ้ง"
                >
                  พูดคุย 💬
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* gallery */}
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <div className="sm:col-span-4 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
            {cover ? (
              <img
                src={cover}
                alt={item.name}
                className="w-full h-[260px] sm:h-[360px] object-cover"
              />
            ) : (
              <div className="h-[260px] sm:h-[360px] grid place-items-center text-slate-400">
                ไม่มีรูปหน้าปก
              </div>
            )}
          </div>
          <div className="sm:col-span-2 grid grid-cols-4 sm:grid-cols-2 gap-3">
            {(item.images || []).slice(1).map((src, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden bg-slate-100 border border-slate-100"
              >
                <img
                  src={src}
                  alt={`photo-${i + 1}`}
                  className="w-full h-28 object-cover"
                />
              </div>
            ))}
            {(!item.images || item.images.length <= 1) && (
              <div className="col-span-4 sm:col-span-2 text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 grid place-items-center p-4 bg-white/60">
                ยังไม่มีรูปเพิ่มเติม
              </div>
            )}
          </div>
        </div>

        {/* info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* details */}
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
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-blue-100"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 text-white grid place-items-center text-sm font-bold ring-2 ring-blue-100">
                  {initials(reporterName)}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-medium text-blue-900 truncate">{reporterName}</div>
                <div className="text-xs text-slate-500">
                  สถานะ:{" "}
                  <span className={statusResolved ? "text-green-700" : "text-amber-700"}>
                    {statusResolved ? "ส่งคืนแล้ว" : "รอเจ้าของรับคืน"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 truncate">
                  อีเมล:{" "}
                  {item.createdBy?.email ? (
                    <a href={`mailto:${item.createdBy.email}`}>{item.createdBy.email}</a>
                  ) : (
                    "-"
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  โทร:{" "}
                  {item.createdBy?.phone ? (
                    <a href={`tel:${item.createdBy.phone}`}>{item.createdBy.phone}</a>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
            </div>

            {/* 👇 ซ่อนปุ่มพูดคุยถ้าเป็นของฉัน */}
            {!isMine && chatTo && (
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/messages/new?to=${chatTo}&item=${item.id}`}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-blue-900 border border-blue-900/30 hover:bg-blue-50"
                >
                  พูดคุยกับผู้แจ้ง 💬
                </Link>
              </div>
            )}

            <div className="mt-4 text-xs text-slate-500">
              * หน้านี้เป็นข้อมูลสาธารณะ
            </div>
          </div>
        </div>

        {/* back */}
        <div className="pt-2">
          <button
            onClick={() => router.push("/lost")}
            className="rounded-full px-4 py-2 text-sm font-medium border text-blue-900 border-blue-900/30 hover:bg-blue-50"
          >
            ← กลับไปหน้ารายการทั้งหมด
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
