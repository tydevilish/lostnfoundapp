import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { TOKEN_NAME, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------- utils ---------- */

async function getAuthedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token).catch(() => null);
  if (!payload?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      email: true,
    },
  });
  return user;
}

function toBool(v, def = false) {
  if (v === undefined || v === null) return def;
  return v === "1" || v === "true";
}

function toDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function normalizeImages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
}

async function fileToDataUrl(file) {
  // แปลงไฟล์ (จาก form-data) เป็น Data URL base64 เพื่อเก็บลง DB (เหมือนวิธีแชท)
  const MAX = 5 * 1024 * 1024; // 5MB ต่อไฟล์
  if (file.size > MAX) throw new Error("ขนาดรูปต้องไม่เกิน 5MB ต่อรูป");
  const arrayBuffer = await file.arrayBuffer();
  const b64 = Buffer.from(arrayBuffer).toString("base64");
  const mime = file.type || "application/octet-stream";
  return `data:${mime};base64,${b64}`;
}

/* ---------- GET /api/found ---------- */
export async function GET(req) {
  try {
    const user = await getAuthedUser();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);

    const mine = toBool(searchParams.get("mine"), true);
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category") || "";
    const place = searchParams.get("place") || "";
    const status = searchParams.get("status") || "";
    const from = toDateOrNull(searchParams.get("from"));
    const to = toDateOrNull(searchParams.get("to"));

    const where = {};
    if (mine) where.createdById = user.id;

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { place: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ];
    }
    if (category) where.category = category;
    if (place) where.place = place;
    if (status === "open") where.status = "OPEN";
    if (status === "resolved") where.status = "RESOLVED";

    if (from || to) {
      where.datetime = {};
      if (from) where.datetime.gte = from;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.datetime.lte = end;
      }
    }

    const [items, mineCount] = await Promise.all([
      prisma.foundItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          datetime: true,
          place: true,
          color: true,
          brand: true,
          images: true, // string[]
          status: true,
          createdAt: true,
          createdBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      prisma.foundItem.count({ where: { createdById: user.id } }),
    ]);

    const shaped = items.map((it) => ({ ...it, reporter: it.createdBy }));
    return NextResponse.json({ items: shaped, mineCount });
  } catch (e) {
    console.error("GET /api/found error:", e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

/* ---------- POST /api/found ---------- */
/**
 * รองรับ 2 แบบ:
 * 1) multipart/form-data  -> fields + images (File[])
 * 2) application/json     -> { name, category, ..., images: string[] }
 * บันทึกรูปเป็น Data URL (base64) ลง DB แบบเดียวกับแชท
 */
export async function POST(req) {
  try {
    const user = await getAuthedUser();
    if (!user)
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const contentType = (req.headers.get("content-type") || "").toLowerCase();

    let name, category, description, datetimeRaw, place, color, brand, images = [];

    if (contentType.includes("multipart/form-data")) {
      // ----- รับแบบ FormData (รองรับโค้ดหน้าเว็บปัจจุบัน) -----
      const form = await req.formData();
      name = String(form.get("name") || "").trim();
      category = String(form.get("category") || "").trim();
      description = String(form.get("description") || "").trim();
      datetimeRaw = String(form.get("datetime") || "").trim();
      place = String(form.get("place") || "").trim();
      color = form.get("color") ? String(form.get("color")).trim() : null;
      brand = form.get("brand") ? String(form.get("brand")).trim() : null;

      const files = form.getAll("images").filter((f) => typeof f !== "string");
      images = [];
      for (const f of files) {
        images.push(await fileToDataUrl(f));
      }
    } else if (contentType.includes("application/json")) {
      // ----- รับแบบ JSON (เหมือนแชท) -----
      const body = await req.json().catch(() => ({}));
      name = String(body.name || "").trim();
      category = String(body.category || "").trim();
      description = String(body.description || "").trim();
      datetimeRaw = String(body.datetime || "").trim();
      place = String(body.place || "").trim();
      color = body.color ? String(body.color).trim() : null;
      brand = body.brand ? String(body.brand).trim() : null;
      images = normalizeImages(body.images);
    } else {
      // ชนิดอื่น ๆ ไม่รองรับ
      return NextResponse.json(
        { success: false, message: "กรุณาส่งเป็น multipart/form-data หรือ JSON" },
        { status: 400 }
      );
    }

    if (!name || !category || !datetimeRaw || !place) {
      return NextResponse.json(
        { success: false, message: "กรอกข้อมูลที่จำเป็นให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const dt = new Date(datetimeRaw);
    if (isNaN(dt)) {
      return NextResponse.json(
        { success: false, message: "รูปแบบวัน–เวลาไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const created = await prisma.foundItem.create({
      data: {
        createdById: user.id,
        name,
        category,
        description: description || null,
        datetime: dt,
        place,
        color,
        brand,
        images, // เก็บ data URLs ตรง ๆ
        status: "OPEN",
      },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        datetime: true,
        place: true,
        color: true,
        brand: true,
        images: true,
        status: true,
        createdBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      success: true,
      item: { ...created, reporter: created.createdBy },
      message: "บันทึกสำเร็จ",
    });
  } catch (e) {
    console.error("POST /api/found error:", e);
    return NextResponse.json(
      { success: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
