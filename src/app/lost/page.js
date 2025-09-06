// app/lost/page.jsx
"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const CATEGORY_OPTIONS = [
  "กระเป๋าสตางค์",
  "โทรศัพท์มือถือ",
  "กุญแจ",
  "บัตร/เอกสารสำคัญ",
  "อิเล็กทรอนิกส์",
  "กระเป๋า/เป้",
  "เครื่องประดับ",
  "เสื้อผ้า/หมวก",
  "สัตว์เลี้ยง",
  "อื่น ๆ",
];

const PLACE_OPTIONS = [
  "The Park In Market",
  "Laemtong",
  "Best Soup",
  "Institute of Marine Science",
  "Wanna Park",
  "Piboonbumpen Demonstration School",
  "Wonnapha Beach",
  "Bang Saen Beach",
  "Khao Sam Mook",
  "Lame Thaen",
  "อื่น ๆ",
];

const PAGE_SIZE = 9;

/* ========= Default export wrapped with Suspense ========= */
export default function LostPage() {
  return (
    <Suspense fallback={<LostPageFallback />}>
      <Lost />
    </Suspense>
  );
}

/* ========= Fallback while Suspense resolves ========= */
function LostPageFallback() {
  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/40 to-white">
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_30%,white_0,transparent_40%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="h-7 w-56 rounded bg-white/20 mb-2" />
          <div className="h-4 w-80 rounded bg-white/10" />
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-100/70 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========= Actual page content (uses useSearchParams) ========= */
function Lost() {
  const searchParams = useSearchParams();

  // ---------- me ----------
  const [me, setMe] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });
        if (!alive) return;
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setMe(data?.user || null);
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---------- list & filters ----------
  const [loadingList, setLoadingList] = useState(true);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    category: "",
    categoryOther: "",
    place: "",
    placeOther: "",
    status: "",
    from: "",
    to: "",
  });

  // mobile: คอลัมน์ x1/x2
  const [mobileCols, setMobileCols] = useState(1);
  const mobileColsClass = mobileCols === 1 ? "grid-cols-1" : "grid-cols-2";

  // pagination
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const sliceStart = (page - 1) * PAGE_SIZE;
  const pageItems = items.slice(sliceStart, sliceStart + PAGE_SIZE);

  // mobile filter modal
  const [openFilter, setOpenFilter] = useState(false);

  const includesI = (hay = "", needle = "") =>
    String(hay).toLowerCase().includes(String(needle).trim().toLowerCase());

  // sync query -> filters
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category") || "";
    const categoryOther = searchParams.get("categoryOther") || "";
    const place = searchParams.get("place") || "";
    const placeOther = searchParams.get("placeOther") || "";
    const status = searchParams.get("status") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    setFilters((prev) => {
      const next = { q, category, categoryOther, place, placeOther, status, from, to };
      const same = Object.keys(next).every(
        (k) => String(prev[k] || "") === String(next[k] || "")
      );
      return same ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // fetch list
  const fetchList = async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.append("q", filters.q);
      if (filters.status) params.append("status", filters.status);
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.category && filters.category !== "อื่น ๆ")
        params.append("category", filters.category);
      if (filters.place && filters.place !== "อื่น ๆ")
        params.append("place", filters.place);

      const res = await fetch(`/api/lost?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && Array.isArray(data?.items)) {
        let list = data.items;
        if (filters.category === "อื่น ๆ" && filters.categoryOther.trim()) {
          list = list.filter((it) =>
            includesI(it.category, filters.categoryOther)
          );
        }
        if (filters.place === "อื่น ๆ" && filters.placeOther.trim()) {
          list = list.filter((it) => includesI(it.place, filters.placeOther));
        }
        setItems(list);
      } else {
        setItems([]);
      }
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    setPage(1);
    const t = setTimeout(fetchList, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const goto = (p) => setPage(Math.min(totalPages, Math.max(1, p)));

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/40 to-white">
      {/* HERO */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_30%,white_0,transparent_40%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                รายการของหายทั้งหมด
              </h1>
              <p className="text-blue-100 mt-1">
                ระบบแสดงรายการจากทุกคนในชุมชน
                เพื่อช่วยให้เจ้าของรับคืนได้เร็วขึ้น
              </p>
            </div>

            {/* mobile: x1/x2 + filter */}
            <div className="flex items-center gap-2">
              <div className="md:hidden inline-flex items-center rounded-full border border-white/30 bg-white/10 backdrop-blur text-white">
                {[1, 2].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMobileCols(n)}
                    className={`px-3 py-1.5 text-sm font-semibold transition ${
                      mobileCols === n
                        ? "bg-white/90 text-blue-900 rounded-full"
                        : "hover:bg-white/20"
                    }`}
                    aria-pressed={mobileCols === n}
                  >
                    {n}x
                  </button>
                ))}
              </div>

              <button
                onClick={() => setOpenFilter(true)}
                className="inline-flex sm:hidden items-center rounded-full px-4 py-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur"
              >
                ⚙️ ตัวกรอง
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left: Filters (desktop) */}
          <aside className="hidden md:block md:col-span-3">
            <FilterPanel filters={filters} setFilters={setFilters} />
          </aside>

          {/* List */}
          <main className="md:col-span-9">
            {/* top search (mobile) */}
            <div className="md:hidden mb-4">
              <SearchBar
                value={filters.q}
                onChange={(v) => setFilters((f) => ({ ...f, q: v }))}
              />
            </div>

            {loadingList ? (
              <div
                className={`grid ${mobileColsClass} sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5`}
              >
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div
                    key={i}
                    className="h-64 rounded-2xl bg-slate-100/70 animate-pulse"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div
                  className={`grid ${mobileColsClass} sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5`}
                >
                  {pageItems.map((it) => (
                    <LostCard
                      key={it.id}
                      item={it}
                      compact={mobileCols === 2}
                      meId={me?.id}
                    />
                  ))}
                </div>

                {/* pagination */}
                <div className="mt-5 flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    แสดง {sliceStart + 1}-
                    {Math.min(sliceStart + PAGE_SIZE, items.length)} จาก{" "}
                    {items.length} รายการ
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goto(page - 1)}
                      disabled={page <= 1}
                      className={`rounded-full px-3 py-1.5 text-sm border ${
                        page <= 1
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-slate-50"
                      } border-slate-300 text-slate-700`}
                    >
                      ← ก่อนหน้า
                    </button>
                    <span className="text-sm text-slate-600">
                      หน้า{" "}
                      <span className="font-semibold text-blue-900">
                        {page}
                      </span>{" "}
                      / {totalPages}
                    </span>
                    <button
                      onClick={() => goto(page + 1)}
                      disabled={page >= totalPages}
                      className={`rounded-full px-3 py-1.5 text-sm border ${
                        page >= totalPages
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-slate-50"
                      } border-slate-300 text-slate-700`}
                    >
                      ถัดไป →
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Filter modal (mobile) */}
      {openFilter && (
        <div
          className="fixed inset-0 z-[70] flex"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenFilter(false);
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
          <div className="relative mx-auto w-full h-[100dvh] bg-white sm:my-10 sm:h-auto sm:max-w-lg sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-100 flex flex-col">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100">
              <div className="px-4 py-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-blue-900">ตัวกรอง</h3>
                <button
                  onClick={() => setOpenFilter(false)}
                  className="rounded-full p-2 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto grow">
              <FilterPanel filters={filters} setFilters={setFilters} compact />
            </div>
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-100">
              <div className="p-3 flex gap-2 justify-end">
                <button
                  onClick={() =>
                    setFilters({
                      q: "",
                      category: "",
                      categoryOther: "",
                      place: "",
                      placeOther: "",
                      status: "",
                      from: "",
                      to: "",
                    })
                  }
                  className="rounded-full px-4 py-2 text-sm font-medium border text-blue-900 border-blue-900/30 hover:bg-blue-50"
                >
                  ล้างตัวกรอง
                </button>
                <button
                  onClick={() => setOpenFilter(false)}
                  className="rounded-full px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700"
                >
                  ใช้ตัวกรอง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Components ================= */

function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ค้นหาชื่อ/รายละเอียด"
        className="w-full text-black rounded-xl border border-slate-300 pl-10 pr-3 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
      />
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
        🔎
      </span>
    </div>
  );
}

function FilterPanel({ filters, setFilters, compact = false }) {
  return (
    <div
      className={`bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-slate-100 ${
        compact ? "" : "p-4 sm:p-5"
      } p-4`}
    >
      {!compact && <h3 className="text-sm font-bold text-blue-900">ตัวกรอง</h3>}
      <div className="mt-3 space-y-3">
        <SearchBar
          value={filters.q}
          onChange={(v) => setFilters((f) => ({ ...f, q: v }))}
        />

        <Select
          label="ประเภท"
          value={filters.category}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              category: e.target.value,
              categoryOther: "",
            }))
          }
        >
          <option value="">ทั้งหมด</option>
          {CATEGORY_OPTIONS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
        {filters.category === "อื่น ๆ" && (
          <input
            value={filters.categoryOther}
            onChange={(e) =>
              setFilters((f) => ({ ...f, categoryOther: e.target.value }))
            }
            placeholder="พิมพ์บางส่วน เช่น กระเป๋า / ถุง"
            className="w-full text-black rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
          />
        )}

        <Select
          label="สถานที่"
          value={filters.place}
          onChange={(e) =>
            setFilters((f) => ({ ...f, place: e.target.value, placeOther: "" }))
          }
        >
          <option value="">ทั้งหมด</option>
          {PLACE_OPTIONS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
        {filters.place === "อื่น ๆ" && (
          <input
            value={filters.placeOther}
            onChange={(e) =>
              setFilters((f) => ({ ...f, placeOther: e.target.value }))
            }
            placeholder="พิมพ์บางส่วน เช่น mar / beach"
            className="w-full text-black rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
          />
        )}

        <Select
          label="สถานะ"
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value }))
          }
        >
          <option value="">ทั้งหมด</option>
          <option value="open">รอเจ้าของรับคืน</option>
          <option value="resolved">ส่งคืนแล้ว</option>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <Field label="จาก">
            <input
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((f) => ({ ...f, from: e.target.value }))
              }
              className="w-full text-black rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
            />
          </Field>
          <Field label="ถึง">
            <input
              type="date"
              value={filters.to}
              onChange={(e) =>
                setFilters((f) => ({ ...f, to: e.target.value }))
              }
              className="w-full text-black rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
            />
          </Field>
        </div>

        <button
          onClick={() =>
            setFilters({
              q: "",
              category: "",
              categoryOther: "",
              place: "",
              placeOther: "",
              status: "",
              from: "",
              to: "",
            })
          }
          className="w-full rounded-full border border-blue-900/30 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-50"
        >
          ล้างตัวกรอง
        </button>
      </div>
    </div>
  );
}

function LostCard({ item, compact = false, meId }) {
  const cover = item.images?.[0];
  const statusResolved =
    (item.status || "").toString().toUpperCase() === "RESOLVED";
  const reporter =
    item.createdBy?.firstName || item.reporter?.firstName
      ? `${(item.createdBy?.firstName || item.reporter?.firstName) ?? ""} ${
          (item.createdBy?.lastName || item.reporter?.lastName) ?? ""
        }`.trim()
      : item.reporterName || "ผู้แจ้งไม่ระบุ";

  const avatarUrl =
    item.createdBy?.avatarUrl || item.reporter?.avatarUrl || null;

  const imgAspect = compact ? "aspect-[4/5]" : "aspect-[16/9]";

  // ซ่อนปุ่มพูดคุยถ้าเป็นของตัวเอง
  const ownerIds = [
    item.createdById,
    item.createdBy?.id,
    item.ownerId,
    item.owner?.id,
  ].filter(Boolean);
  const isMine = !!meId && ownerIds.some((id) => String(id) === String(meId));
  const chatTo = item.createdById ?? item.createdBy?.id ?? "";

  return (
    <div className="group rounded-2xl overflow-hidden border border-slate-100 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition">
      {/* image */}
      <div className={`relative ${imgAspect} bg-slate-100`}>
        {cover ? (
          <img
            src={cover}
            alt={item.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-slate-400">
            ไม่มีรูป
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 pointer-events-none" />
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
          <span
            className={[
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold backdrop-blur",
              statusResolved
                ? "bg-green-500/90 text-white"
                : "bg-amber-500/90 text-white",
            ].join(" ")}
          >
            {statusResolved ? "ส่งคืนแล้ว" : "รอเจ้าของรับคืน"}
          </span>
        </div>
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
          <span className="inline-flex items-center rounded-full bg-white/90 text-blue-900 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 shadow">
            {item.category}
          </span>
        </div>

        {compact && !isMine && chatTo && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
            <Link
              href={`/messages/new?to=${chatTo}&item=${item.id}`}
              className="rounded-full bg-white/90 text-blue-900 text-xs font-semibold px-2.5 py-1 shadow hover:bg-white"
              title="พูดคุย"
            >
              💬 พูดคุย
            </Link>
            <Link
              href={`/lost/${item.id}`}
              className="rounded-full bg-blue-600 text-white text-xs font-semibold px-3 py-1 shadow hover:bg-blue-700"
              title="ดูรายละเอียด"
            >
              ดู
            </Link>
          </div>
        )}
      </div>

      {/* content */}
      <div className={compact ? "p-3" : "p-5"}>
        <h4
          className={`${
            compact ? "text-[13px]" : "text-base"
          } font-semibold text-blue-900 line-clamp-1`}
        >
          {item.name}
        </h4>
        {!compact && (
          <p className="mt-1 text-[13px] text-slate-600 line-clamp-2">
            {item.description}
          </p>
        )}

        <div
          className={`mt-2 ${
            compact ? "text-[11px]" : "text-xs"
          } grid grid-cols-2 gap-2 text-slate-600`}
        >
          <div className="flex items-center gap-1.5">
            <span>📍</span>
            <span className="truncate">{item.place}</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end sm:justify-start">
            <span>🕒</span>
            <span className="truncate">{formatDate(item.datetime)}</span>
          </div>
        </div>

        {!compact && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={reporter}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-blue-100"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 text-white grid place-items-center text-[11px] font-bold ring-2 ring-blue-100">
                  {initials(reporter)}
                </div>
              )}
              <span className="text-xs text-slate-600 truncate">
                โดย{" "}
                <span className="font-medium text-blue-900">{reporter}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isMine && chatTo && (
                <Link
                  href={`/messages/new?to=${chatTo}&item=${item.id}`}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-blue-900 border border-blue-900/30 hover:bg-blue-50"
                >
                  พูดคุย
                </Link>
              )}
              <Link
                href={`/lost/${item.id}`}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow hover:shadow-md"
              >
                ดูรายละเอียด
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- small UI ---------- */
function Select({ label, children, ...rest }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <select
        {...rest}
        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200 bg-white text-black"
      >
        {children}
      </select>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-50 text-blue-700 grid place-items-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="text-blue-900 font-semibold">ยังไม่พบรายการ</h3>
      <p className="text-slate-600 text-sm mt-1">
        ลองปรับตัวกรองหรือค้นหาด้วยคำอื่น ๆ
      </p>
    </div>
  );
}

/* ---------- utils ---------- */
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
