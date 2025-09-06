"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

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

/* ---------- Spinner (หมุน ๆ) ---------- */
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

/* overlay กลางกริดการ์ด */
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

export default function Found() {
  // ---------- list & filters (เฉพาะของฉัน) ----------
  const [loadingList, setLoadingList] = useState(true);
  const [items, setItems] = useState([]);
  const [mineCount, setMineCount] = useState(0);
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

  // ---------- add form ----------
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    category: "",
    categoryOther: "",
    name: "",
    description: "",
    datetime: "",
    place: "",
    placeOther: "",
    color: "",
    brand: "",
  });
  const [files, setFiles] = useState([]);

  const [previews, setPreviews] = useState([]);
  const fileRef = useRef(null);
  const firstFieldRef = useRef(null);

  // mobile filter + density + pagination
  const [openFilter, setOpenFilter] = useState(false);
  const [mobileDensity, setMobileDensity] = useState("x1"); // 'x1' | 'x2'
  const PAGE_SIZE = 9;
  const [page, setPage] = useState(1);

  // ----- helpers -----
  const includesI = (hay = "", needle = "") =>
    String(hay).toLowerCase().includes(String(needle).trim().toLowerCase());

  // ----- fetch my list -----
  const fetchList = async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ mine: "1" });
      if (filters.q) params.append("q", filters.q);
      if (filters.status) params.append("status", filters.status);
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.category && filters.category !== "อื่น ๆ")
        params.append("category", filters.category);
      if (filters.place && filters.place !== "อื่น ๆ")
        params.append("place", filters.place);

      const res = await fetch(`/api/found?${params.toString()}`, {
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
        setMineCount(data.mineCount ?? data.items.length ?? 0);
      } else {
        setItems([]);
        setMineCount(0);
      }
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchList(); /* eslint-disable-next-line */
  }, []);
  useEffect(() => {
    const t = setTimeout(fetchList, 250);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [filters]);

  // reset page เมื่อรายการ/ฟิลเตอร์เปลี่ยน
  useEffect(() => {
    setPage(1);
  }, [filters, items.length]);

  // revoke previews on unmount
  useEffect(
    () => () => previews.forEach((u) => URL.revokeObjectURL(u)),
    [previews]
  );

  // ----- modal UX helpers -----
  useEffect(() => {
    if (!openAdd) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setOpenAdd(false);
    window.addEventListener("keydown", onKey);
    setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openAdd]);

  // ----- file handlers -----
  const handleFiles = (list) => {
    const arr = Array.from(list || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (!arr.length) return;
    const newPreviews = arr.map((x) => URL.createObjectURL(x));
    setFiles((prev) => [...prev, ...arr]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };
  const onPickFiles = (e) => handleFiles(e.target.files);
  const onDropFiles = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };
  const removeFileAt = (i) => {
    setFiles((arr) => arr.filter((_, idx) => idx !== i));
    setPreviews((arr) => {
      URL.revokeObjectURL(arr[i]);
      return arr.filter((_, idx) => idx !== i);
    });
  };
  const makeCover = (i) => {
    if (i === 0) return;
    setFiles((arr) => {
      const cp = [...arr];
      const [x] = cp.splice(i, 1);
      cp.unshift(x);
      return cp;
    });
    setPreviews((arr) => {
      const cp = [...arr];
      const [x] = cp.splice(i, 1);
      cp.unshift(x);
      return cp;
    });
  };
  const setF = (e) => setForm((p) => ({ ...p, [e.target.id]: e.target.value }));

  const valid = useMemo(() => {
    const nameOK = !!form.name.trim();
    const catOK =
      !!form.category &&
      (form.category !== "อื่น ๆ" || !!form.categoryOther.trim());
    const dtOK = !!form.datetime;
    const placeOK =
      !!form.place && (form.place !== "อื่น ๆ" || !!form.placeOther.trim());
    return nameOK && catOK && dtOK && placeOK;
  }, [form]);

  const submit = async () => {
    if (!valid) {
      setMsg({ type: "error", text: "กรอกข้อมูลที่จำเป็นให้ครบถ้วน" });
      return;
    }
    setMsg(null);
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("mode", "found");
      fd.append("name", form.name.trim());
      fd.append(
        "category",
        form.category === "อื่น ๆ" ? form.categoryOther.trim() : form.category
      );
      fd.append("description", form.description.trim());
      fd.append("datetime", form.datetime);
      fd.append(
        "place",
        form.place === "อื่น ๆ" ? form.placeOther.trim() : form.place
      );
      if (form.color) fd.append("color", form.color.trim());
      if (form.brand) fd.append("brand", form.brand.trim());
      files.forEach((f) => fd.append("images", f));

      const res = await fetch("/api/found", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false)
        throw new Error(data?.message || "บันทึกไม่สำเร็จ");

      setForm({
        category: "",
        categoryOther: "",
        name: "",
        description: "",
        datetime: "",
        place: "",
        placeOther: "",
        color: "",
        brand: "",
      });
      previews.forEach((u) => URL.revokeObjectURL(u));
      setFiles([]);
      setPreviews([]);
      if (fileRef.current) fileRef.current.value = "";
      setMsg({ type: "success", text: "แจ้งพบของสำเร็จ" });
      setOpenAdd(false);
      fetchList();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ====== pagination derive ======
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = Math.min(items.length, startIdx + PAGE_SIZE);
  const pageItems = items.slice(startIdx, startIdx + PAGE_SIZE);
  const mobileColsClass =
    mobileDensity === "x2" ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-blue-100/50 to-white">
      {/* HERO */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_30%,white_0,transparent_40%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                แจ้งพบของ
              </h1>
              <p className="text-blue-100 mt-1 flex items-center gap-2">
                คุณแจ้งพบของทั้งหมด{" "}
                {loadingList ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="text-white" />
                  </span>
                ) : (
                  <span className="font-semibold text-white">{mineCount}</span>
                )}{" "}
                รายการ
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* mobile filter button */}
              <button
                onClick={() => setOpenFilter(true)}
                className="inline-flex sm:hidden items-center rounded-full px-4 py-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 shadow border border-white/30 backdrop-blur"
              >
                ⚙️ ตัวกรอง
              </button>
              <button
                onClick={() => setOpenAdd(true)}
                className="self-start rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 shadow-sm hover:shadow transition border border-white/30 backdrop-blur"
              >
                + แจ้งพบของ
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

          {/* Middle: Cards */}
          <main className="md:col-span-9">
            {/* mobile top toolbar: filter + density */}
            <div className="md:hidden mb-4 flex items-center justify-between">
              <button
                onClick={() => setOpenFilter(true)}
                className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow border border-blue-800/40"
              >
                ⚙️ ตัวกรอง
              </button>
              <div className="inline-flex items-center rounded-full border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setMobileDensity("x1")}
                  className={`px-3 py-1.5 text-xs font-semibold ${
                    mobileDensity === "x1"
                      ? "bg-slate-400"
                      : "bg-white text-slate-700"
                  } `}
                  aria-label="แสดง 1 คอลัมน์"
                >
                  x1
                </button>
                <button
                  onClick={() => setMobileDensity("x2")}
                  className={`px-3 py-1.5 text-xs font-semibold border-l border-slate-300 ${
                    mobileDensity === "x2"
                      ? "bg-slate-400"
                      : "bg-white text-slate-700"
                  }`}
                  aria-label="แสดง 2 คอลัมน์"
                >
                  x2
                </button>
              </div>
            </div>

            {/* ====== บริเวณการ์ด: แสดงสเกลตัน + overlay กลางคำว่า "กำลังโหลดข้อมูล..." ====== */}
            {loadingList ? (
              <div className="relative min-h-[360px]">
                <div
                  className={`grid ${mobileColsClass} sm:grid-cols-2 xl:grid-cols-3 gap-5`}
                >
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-64 rounded-2xl bg-slate-100/70 animate-pulse"
                    />
                  ))}
                </div>
                <CenterLoading label="กำลังโหลดข้อมูล..." />
              </div>
            ) : items.length === 0 ? (
              <EmptyState onAdd={() => setOpenAdd(true)} />
            ) : (
              <>
                {/* grid 9 items per page */}
                <div
                  className={`grid ${mobileColsClass} sm:grid-cols-2 xl:grid-cols-3 gap-5`}
                >
                  {pageItems.map((it) => (
                    <FoundCard key={it.id} item={it} />
                  ))}
                </div>

                {/* pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-600">
                      แสดง {startIdx + 1}-{endIdx} จาก {items.length} รายการ
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className={`rounded-full px-3 py-1.5 text-sm border ${
                          page <= 1
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-slate-50"
                        } border-slate-300 text-slate-700`}
                      >
                        ← ก่อนหน้า
                      </button>
                      <div className="text-sm text-slate-700">
                        หน้า {page}/{totalPages}
                      </div>
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
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
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* MODAL (Add) */}
      {openAdd && (
        <div
          className="fixed inset-0 z-[70] flex"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenAdd(false);
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />
          <div
            className="relative mx-auto w-full h-[100dvh] bg-white
                          sm:my-10 sm:h-auto sm:max-w-3xl sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-100
                          flex flex-col"
          >
            {/* header */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 rounded-full">
              <div className="px-4 sm:px-6 py-3 flex items-center justify-between rounded-full">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-blue-900">
                    แจ้งพบของ
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600">
                    กรอกรายละเอียดให้ครบถ้วนเพื่อให้เจ้าของติดต่อกลับได้ง่ายขึ้น
                  </p>
                </div>
                <button
                  onClick={() => setOpenAdd(false)}
                  className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {msg && (
                <div
                  className={[
                    "mx-4 sm:mx-6 mb-3 rounded-xl border px-4 py-2.5 text-sm",
                    msg.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700",
                  ].join(" ")}
                >
                  {msg.text}
                </div>
              )}
            </div>

            {/* body */}
            <div className="px-4 sm:px-6 py-5 overflow-y-auto grow">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ประเภทสิ่งของ" required>
                  <select
                    id="category"
                    ref={firstFieldRef}
                    value={form.category}
                    onChange={setF}
                    className="w-full text-black bg-white rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">เลือกประเภท</option>
                    {CATEGORY_OPTIONS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Field>

                {form.category === "อื่น ๆ" && (
                  <Field label="ระบุประเภทอื่น ๆ" required>
                    <input
                      id="categoryOther"
                      value={form.categoryOther}
                      onChange={setF}
                      placeholder="เช่น ถุงผ้า, พาวเวอร์แบงก์"
                      className="w-full text-black rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                    />
                  </Field>
                )}

                <Field label="ชื่อสิ่งของ" required>
                  <input
                    id="name"
                    value={form.name}
                    onChange={setF}
                    placeholder="เช่น กระเป๋าสตางค์สีน้ำตาล"
                    className="w-full text-black rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                  />
                </Field>

                <Field label="วัน–เวลาที่พบเจอ" required>
                  <input
                    id="datetime"
                    type="datetime-local"
                    value={form.datetime}
                    onChange={setF}
                    className="w-full text-black rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                  />
                </Field>

                <Field label="สถานที่" required>
                  <select
                    id="place"
                    value={form.place}
                    onChange={setF}
                    className="w-full text-black bg-white rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">เลือกสถานที่</option>
                    {PLACE_OPTIONS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Field>

                {form.place === "อื่น ๆ" && (
                  <Field label="ระบุสถานที่อื่น ๆ" required>
                    <input
                      id="placeOther"
                      value={form.placeOther}
                      onChange={setF}
                      placeholder="เช่น ร้านกาแฟหน้ามหาวิทยาลัย"
                      className="w-full text-black rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                    />
                  </Field>
                )}

                <Field label="สี/ลักษณะเด่น">
                  <input
                    id="color"
                    value={form.color}
                    onChange={setF}
                    placeholder="เช่น น้ำตาลเข้ม มีรอยขีดเล็ก ๆ"
                    className="w-full text-black rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                  />
                </Field>
                <Field label="ยี่ห้อ/รุ่น (ถ้ามี)">
                  <input
                    id="brand"
                    value={form.brand}
                    onChange={setF}
                    placeholder="เช่น Apple iPhone 13"
                    className="w-full text-black rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                  />
                </Field>

                <Field label="รายละเอียดเพิ่มเติม" full>
                  <textarea
                    id="description"
                    rows={4}
                    value={form.description}
                    onChange={setF}
                    placeholder="เช่น เก็บไว้ที่ประชาสัมพันธ์อาคาร X"
                    className="w-full text-black rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
                  />
                </Field>

                {/* UPLOAD */}
                <Field label="รูปภาพสิ่งของ" full>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={onDropFiles}
                    className="rounded-xl border-2 border-dashed border-slate-300 bg-white/60 p-4 sm:p-5 text-center hover:border-blue-300 transition"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 rounded-full bg-blue-50 grid place-items-center text-blue-700">
                        📷
                      </div>
                      <div className="text-sm text-slate-600">
                        ลากรูปมาวางที่นี่ หรือ
                        <label className="mx-1 font-semibold text-blue-900 underline cursor-pointer">
                          เลือกรูป
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            capture="environment"
                            onChange={onPickFiles}
                            className="sr-only"
                          />
                        </label>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        รองรับ JPG/PNG/WEBP หลายไฟล์ (รูปแรกจะเป็นหน้าปก)
                      </div>
                    </div>
                  </div>

                  {!!previews.length && (
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {previews.map((src, i) => (
                        <div
                          key={i}
                          className="relative group rounded-lg overflow-hidden"
                        >
                          <img
                            src={src}
                            alt={`preview-${i}`}
                            className="h-28 sm:h-32 w-full object-cover"
                          />
                          <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={() => removeFileAt(i)}
                              className="h-7 w-7 rounded-full bg-white/95 text-slate-700 shadow grid place-items-center"
                              title="ลบรูป"
                            >
                              ✕
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => makeCover(i)}
                            className={[
                              "absolute bottom-1 left-1 text-[11px] font-medium px-2 py-0.5 rounded-full shadow",
                              i === 0
                                ? "bg-blue-600 text-white"
                                : "bg-white/95 text-slate-700 hover:bg-white",
                            ].join(" ")}
                            title={i === 0 ? "หน้าปก" : "ตั้งเป็นหน้าปก"}
                          >
                            {i === 0 ? "หน้าปก" : "ตั้งเป็นหน้าปก"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Field>
              </div>
            </div>

            {/* footer */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-100 rounded-full">
              <div className="px-4 sm:px-6 py-3 flex items-center justify-end gap-3 rounded-full">
                <button
                  onClick={() => setOpenAdd(false)}
                  className="rounded-full px-5 py-2.5 text-sm font-medium border text-blue-900 border-blue-900/30 hover:bg-blue-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={submit}
                  disabled={saving || !valid}
                  className={[
                    "inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow",
                    saving || !valid
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:shadow-md active:scale-95",
                  ].join(" ")}
                >
                  {saving && <Spinner className="text-white" size={16} />}
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL (mobile filters) */}
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
function Field({ label, children, required = false, full = false }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
function EmptyState({ onAdd }) {
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
      <h3 className="text-blue-900 font-semibold">ยังไม่มีการแจ้งพบของ</h3>
      <p className="text-slate-600 text-sm mt-1">
        เริ่มแจ้งพบของชิ้นแรกของคุณได้เลย
      </p>
      <button
        onClick={onAdd}
        className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow hover:shadow-md"
      >
        + แจ้งพบของ
      </button>
    </div>
  );
}

/* ---------- FilterPanel ---------- */
function FilterPanel({ filters, setFilters, compact = false }) {
  return (
    <div
      className={`bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-slate-100 ${
        compact ? "" : "p-4 sm:p-5"
      } p-4`}
    >
      {!compact && <h3 className="text-sm font-bold text-blue-900">ตัวกรอง</h3>}
      <div className="mt-3 space-y-3">
        <div className="relative">
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="ค้นหาชื่อ/รายละเอียด"
            className="w-full text-black rounded-xl border border-slate-300 pl-10 pr-3 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
          />
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            🔎
          </span>
        </div>

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
          <div className="animate-[fadeIn_.15s_ease-out]">
            <input
              value={filters.categoryOther}
              onChange={(e) =>
                setFilters((f) => ({ ...f, categoryOther: e.target.value }))
              }
              placeholder="พิมพ์บางส่วนก็ได้ เช่น tes"
              className="w-full text-black rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
            />
          </div>
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
          <div className="animate-[fadeIn_.15s_ease-out]">
            <input
              value={filters.placeOther}
              onChange={(e) =>
                setFilters((f) => ({ ...f, placeOther: e.target.value }))
              }
              placeholder="พิมพ์บางส่วนก็ได้ เช่น mar"
              className="w-full text-black rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200"
            />
          </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="จาก">
            <DateInput
              id="from"
              value={filters.from}
              onChange={(e) =>
                setFilters((f) => ({ ...f, from: e.target.value }))
              }
            />
          </Field>
          <Field label="ถึง">
            <DateInput
              id="to"
              value={filters.to}
              onChange={(e) =>
                setFilters((f) => ({ ...f, to: e.target.value }))
              }
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

/* ---------- Card (มีสปินเนอร์ทับรูปจนโหลดเสร็จ) ---------- */
function FoundCard({ item }) {
  const [imgReady, setImgReady] = useState(false);

  const cover = item.images?.[0];
  const statusResolved = item.status === "RESOLVED";
  const reporter =
    item.owner?.firstName || item.reporter?.firstName
      ? `${(item.owner?.firstName || item.reporter?.firstName) ?? ""} ${
          (item.owner?.lastName || item.reporter?.lastName) ?? ""
        }`.trim()
      : item.reporterName || "ผู้แจ้งไม่ระบุ";

  const initials = (name) =>
    name
      ?.split(" ")
      .map((s) => s[0]?.toUpperCase() || "")
      .slice(0, 2)
      .join("") || "U";
  const avatarUrl = item.owner?.avatarUrl || item.reporter?.avatarUrl || null;

  return (
    <div className="group rounded-2xl overflow-hidden border border-slate-100 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition">
      <div className="relative aspect-[16/9] bg-slate-100">
        {cover ? (
          <>
            {!imgReady && (
              <div className="absolute inset-0 grid place-items-center">
                <Spinner className="text-slate-400" />
              </div>
            )}
            <img
              src={cover}
              alt={item.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgReady(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                imgReady ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-slate-400">
            ไม่มีรูป
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
        <div className="absolute top-3 left-3">
          <span
            className={[
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur",
              statusResolved
                ? "bg-green-500/90 text-white"
                : "bg-amber-500/90 text-white",
            ].join(" ")}
          >
            {statusResolved ? "ส่งคืนแล้ว" : "รอเจ้าของรับคืน"}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center rounded-full bg-white/90 text-blue-900 text-[11px] font-semibold px-2.5 py-1 shadow">
            {item.category}
          </span>
        </div>
      </div>

      <div className="p-5">
        <h4 className="font-semibold text-blue-900 line-clamp-1">
          {item.name}
        </h4>
        <p className="mt-1 text-[13px] text-slate-600 line-clamp-2">
          {item.description}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span>📍</span>
            <span className="truncate">{item.place}</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end sm:justify-start">
            <span>🕒</span>
            <span className="truncate">{formatDate(item.datetime)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={reporter}
                loading="lazy"
                decoding="async"
                className="h-8 w-8 rounded-full object-cover ring-2 ring-blue-100"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 text-white grid place-items-center text-[11px] font-bold ring-2 ring-blue-100">
                {initials(reporter)}
              </div>
            )}
            <span className="text-xs text-slate-600 truncate">
              โดย <span className="font-medium text-blue-900">{reporter}</span>
            </span>
          </div>
          <Link
            href={`/found/${item.id}`}
            className="text-sm text-blue-800 hover:underline whitespace-nowrap"
          >
            ดูรายละเอียด
          </Link>
        </div>
      </div>
    </div>
  );
}

/* utils */
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

function DateInput({ id, value, onChange }) {
  return (
    <div className="relative rounded-xl ring-1 ring-slate-300 bg-white
                    focus-within:ring-2 focus-within:ring-blue-900 overflow-hidden">
      <input
        id={id}
        type="date"
        value={value}
        onChange={onChange}
        className="block w-full border-0 outline-none ring-0 bg-transparent
                   px-3 py-2.5 text-black appearance-none
                   [color-scheme:light]"
      />
    </div>
  );
}
