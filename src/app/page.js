// app/page.jsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/* ========= Static options ========= */
const CATEGORY_OPTIONS = [
  "กระเป๋าสตางค์","โทรศัพท์มือถือ","กุญแจ","บัตร/เอกสารสำคัญ",
  "อิเล็กทรอนิกส์","กระเป๋า/เป้","เครื่องประดับ","เสื้อผ้า/หมวก",
  "สัตว์เลี้ยง","อื่น ๆ",
];
const PLACE_OPTIONS = [
  "The Park In Market","Laemtong","Best Soup","Institute of Marine Science",
  "Wanna Park","Piboonbumpen Demonstration School","Wonnapha Beach",
  "Bang Saen Beach","Khao Sam Mook","Lame Thaen","อื่น ๆ",
];

/* ใช้รูปเดียวเป็นพื้นหลัง hero */
const HERO_IMG = "/lost.jpg";

/* ========= helpers ========= */
const fmt = (d) => {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return d; }
};
const uniqTop = (arr, key, n = 8) => {
  const cnt = new Map();
  arr.forEach((x) => {
    const v = (x?.[key] || "").trim();
    if (!v) return;
    cnt.set(v, (cnt.get(v) || 0) + 1);
  });
  return [...cnt.entries()].sort((a,b)=>b[1]-a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
};
const initials = (name="") =>
  (name.split(" ").map(s => s[0]?.toUpperCase() || "").slice(0,2).join("")) || "U";

export default function Home() {
  const router = useRouter();

  // search state (เหลือแค่ของหาย → ไปหน้า /lost)
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [categoryOther, setCategoryOther] = useState("");
  const [place, setPlace] = useState("");
  const [placeOther, setPlaceOther] = useState("");

  // data state
  const [loading, setLoading] = useState(true);
  const [lost, setLost] = useState([]);
  const [found, setFound] = useState([]);
  const [foundNeedsLogin, setFoundNeedsLogin] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setFoundNeedsLogin(false);

      const grab = async (url) => {
        const res = await fetch(url, { cache: "no-store", credentials: "include" });
        const data = await res.json().catch(()=>({}));
        return { ok: res.ok, status: res.status, items: Array.isArray(data?.items) ? data.items : [] };
      };

      const [lostR, foundR] = await Promise.allSettled([
        grab("/api/lost?limit=24"),
        grab("/api/found?limit=24"),
      ]);

      if (!alive) return;

      const L = lostR.status === "fulfilled" ? lostR.value : { ok:false, status:0, items:[] };
      const F = foundR.status === "fulfilled" ? foundR.value : { ok:false, status:0, items:[] };

      setLost(L.items);
      setFound(F.items);

      if (!F.ok && (F.status === 401 || F.status === 403)) setFoundNeedsLogin(true);

      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const topCategories = useMemo(() => uniqTop([...lost, ...found], "category", 8), [lost, found]);
  const topPlaces = useMemo(() => uniqTop([...lost, ...found], "place", 8), [lost, found]);

  // helper: พาไปหน้า /lost พร้อมพารามิเตอร์แบบ GET
  const goLost = (params = {}) => {
    const qs = new URLSearchParams();
    const qv = params.q ?? q;
    const cat = params.category ?? category;
    const catOther = params.categoryOther ?? categoryOther;
    const plc = params.place ?? place;
    const plcOther = params.placeOther ?? placeOther;

    if (qv?.trim()) qs.set("q", qv.trim());
    if (cat) {
      qs.set("category", cat);
      if (cat === "อื่น ๆ" && catOther?.trim()) qs.set("categoryOther", catOther.trim());
    }
    if (plc) {
      qs.set("place", plc);
      if (plc === "อื่น ๆ" && plcOther?.trim()) qs.set("placeOther", plcOther.trim());
    }
    router.push(`/lost${qs.toString() ? `?${qs.toString()}` : ""}`);
  };

  const submit = (e) => { e?.preventDefault?.(); goLost(); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* ===== HERO SECTION (พื้นหลังเป็นรูปเดียว) ===== */}
      <section
        className="relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(6, 36, 84, .65), rgba(0, 0, 0, .65)), url(${HERO_IMG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="relative max-w-6xl mx-auto px-6 py-16 lg:py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-2 text-sm text-blue-100 mb-6 border border-white/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ชุมชนช่วยกันหาเจ้าของของหาย
            </div>
            <h1 className="text-4xl lg:text-6xl font-black text-white mb-4 leading-tight">
              หาเจอไว <span className="text-blue-200">คืนเจ้าของไว</span>
            </h1>
            <p className="text-lg text-blue-100/90 max-w-2xl mx-auto">
              ค้นหาของหาย และติดต่อกันได้ทันที ช่วยให้ของกลับคืนสู่เจ้าของอย่างรวดเร็ว
            </p>
          </div>

          {/* Search Bar (ตัดแท็บโหมด เหลือค้นหาของหายอย่างเดียว) */}
          <form onSubmit={submit} className="max-w-4xl mx-auto">
            <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 overflow-hidden p-6 space-y-4">
              {/* ค้นหาข้อความ */}
              <div className="relative">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหาชื่อของหรือรายละเอียด..."
                  className="w-full px-4 py-3 text-lg border border-slate-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-slate-800 placeholder-slate-400"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</div>
              </div>

              {/* ตัวกรอง */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setCategoryOther(""); }}
                  className="px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-slate-700"
                >
                  <option value="">ทุกประเภท</option>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                  value={place}
                  onChange={(e) => { setPlace(e.target.value); setPlaceOther(""); }}
                  className="px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-slate-700"
                >
                  <option value="">ทุกสถานที่</option>
                  {PLACE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-900 to-blue-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                >
                  ค้นหาของหาย
                </button>
              </div>

              {/* อื่น ๆ */}
              {(category === "อื่น ๆ" || place === "อื่น ๆ") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  {category === "อื่น ๆ" && (
                    <input
                      value={categoryOther}
                      onChange={(e) => setCategoryOther(e.target.value)}
                      placeholder="ระบุประเภทอื่น ๆ..."
                      className="px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-slate-700"
                    />
                  )}
                  {place === "อื่น ๆ" && (
                    <input
                      value={placeOther}
                      onChange={(e) => setPlaceOther(e.target.value)}
                      placeholder="ระบุสถานที่อื่น ๆ..."
                      className="px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-slate-700"
                    />
                  )}
                </div>
              )}
            </div>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link
              href="/found"
              className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-full backdrop-blur transition-all duration-200 hover:scale-105"
            >
              📢 แจ้งพบของ
            </Link>
            <Link
              href="/lost"
              className="px-8 py-3 bg-white text-blue-900 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
              🔍 ตรวจสอบของหาย
            </Link>
          </div>
        </div>
      </section>

      {/* ===== MAIN CONTENT (เดิม) ===== */}
      <main className="max-w-6xl mx-auto px-6 py-16 space-y-16">
        {/* Popular Categories & Places */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Categories */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">📁 หมวดหมู่ยอดนิยม</h2>
              <Link href="/lost" className="text-sm text-blue-600 hover:text-blue-800 font-medium">ดูทั้งหมด →</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {topCategories.length === 0 ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  {Array.from({length: 4}).map((_, i) => <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />)}
                </div>
              ) : (
                topCategories.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => goLost({ category: c.name })}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-sm font-medium transition-colors border border-blue-100"
                    title={`${c.name} (${c.count})`}
                  >
                    {c.name}
                    <span className="bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded text-xs font-semibold">{c.count}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Places */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">📍 สถานที่ยอดนิยม</h2>
              <Link href="/lost" className="text-sm text-blue-600 hover:text-blue-800 font-medium">ดูทั้งหมด →</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {topPlaces.length === 0 ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  {Array.from({length: 4}).map((_, i) => <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />)}
                </div>
              ) : (
                topPlaces.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => goLost({ place: p.name })}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-sm font-medium transition-colors border border-emerald-100"
                    title={`${p.name} (${p.count})`}
                  >
                    {p.name}
                    <span className="bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded text-xs font-semibold">{p.count}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Recent Items Grid */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Lost Items */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">🔍 ของหายล่าสุด</h2>
              <Link href="/lost" className="text-blue-600 hover:text-blue-800 font-medium">ดูทั้งหมด →</Link>
            </div>
            {loading ? (
              <div className="space-y-4">{Array.from({length: 3}).map((_, i) => <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />)}</div>
            ) : lost.length === 0 ? (
              <EmptyState text="ยังไม่มีรายการของหาย" icon="🔍" />
            ) : (
              <div className="space-y-4">
                {lost.slice(0, 4).map(item => <CompactItemCard key={`lost-${item.id}`} item={item} kind="lost" />)}
              </div>
            )}
          </div>

          {/* Found Items */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">📢 พบของล่าสุด</h2>
              <Link href="/found" className="text-blue-600 hover:text-blue-800 font-medium">ดูทั้งหมด →</Link>
            </div>
            {foundNeedsLogin ? (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">🔐</div>
                <h3 className="font-bold text-blue-900 mb-2">ต้องเข้าสู่ระบบ</h3>
                <p className="text-blue-700 text-sm mb-4">เพื่อดูรายการพบของและติดต่อผู้แจ้ง</p>
                <div className="flex gap-2 justify-center">
                  <Link href="/signin" className="px-4 py-2 text-sm font-medium text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50">เข้าสู่ระบบ</Link>
                  <Link href="/signup" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">สมัครสมาชิก</Link>
                </div>
              </div>
            ) : loading ? (
              <div className="space-y-4">{Array.from({length: 3}).map((_, i) => <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />)}</div>
            ) : found.length === 0 ? (
              <EmptyState text="ยังไม่มีการแจ้งพบของ" icon="📢" />
            ) : (
              <div className="space-y-4">
                {found.slice(0, 4).map(item => <CompactItemCard key={`found-${item.id}`} item={item} kind="found" />)}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 rounded-3xl p-8 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-white blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-white blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
          </div>
          <div className="relative">
            <h3 className="text-3xl font-bold mb-4">พร้อมช่วยกันแล้วใช่ไหม? 🤝</h3>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
              เริ่มแจ้งพบของ หรือค้นหาของหาย ระบบแชทเรียลไทม์จะช่วยให้คุณติดต่อกันได้ทันที
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/found" className="px-8 py-4 bg-white text-blue-900 font-bold rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105">
                📢 แจ้งพบของทันที
              </Link>
              <Link href="/lost" className="px-8 py-4 bg-white/10 border border-white/30 text-white font-bold rounded-xl hover:bg-white/20 transition-all duration-200 hover:scale-105 backdrop-blur">
                🔍 ตรวจสอบของหาย
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ====== Components ====== */
function EmptyState({ text, icon = "🔎" }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-slate-600 font-medium">{text}</h3>
    </div>
  );
}

function CompactItemCard({ item, kind }) {
  const cover = item.images?.[0];
  const link = `/${kind}/${item.id}`;
  const reporterName =
    item.createdBy?.firstName || item.owner?.firstName || item.reporter?.firstName
      ? `${(item.createdBy?.firstName || item.owner?.firstName || item.reporter?.firstName) ?? ""} ${(item.createdBy?.lastName || item.owner?.lastName || item.reporter?.lastName) ?? ""}`.trim()
      : (item.reporterName || "ไม่ระบุ");

  const avatarUrl = item.createdBy?.avatarUrl || item.owner?.avatarUrl || item.reporter?.avatarUrl || null;
  const statusResolved = (item.status || "").toString().toUpperCase() === "RESOLVED";

  return (
    <Link href={link} className="block group">
      <div className="bg-white rounded-xl border border-slate-100 hover:border-blue-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className="flex gap-4">
          <div className="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
            {cover ? (
              <img src={cover} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl">
                {kind === "lost" ? "🔍" : "📢"}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-slate-900 line-clamp-1 group-hover:text-blue-900 transition-colors">
                {item.name}
              </h4>
              {kind === "found" && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                  statusResolved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {statusResolved ? "ส่งคืนแล้ว" : "รอเจ้าของ"}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 line-clamp-2 mb-3">{item.description}</p>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">📍 <span className="truncate max-w-[80px]">{item.place}</span></span>
                <span className="flex items-center gap-1">🕒 {fmt(item.datetime)}</span>
              </div>
              <div className="flex items-center gap-2">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={reporterName} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                    {initials(reporterName)}
                  </div>
                )}
                <span className="font-medium text-slate-700 truncate max-w-[60px]">{reporterName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
