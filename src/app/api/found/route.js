import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { TOKEN_NAME, verifyToken } from "@/lib/auth";
import path from "path";
import { promises as fs } from "fs";
import crypto from "crypto";

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

/** บันทึกรูปลง /public/uploads/found และคืน URL (เช่น /uploads/found/xxx.jpg) */
async function saveImagesFromFormData(formData) {
  const files = formData.getAll("images");
  if (!files?.length) return [];
  const saved = [];

  const uploadDir = path.join(process.cwd(), "public", "uploads", "found");
  await fs.mkdir(uploadDir, { recursive: true });

  for (const file of files) {
    if (typeof file === "string") continue; // ป้องกัน edge case
    // size limit ตัวอย่าง: 5MB
    const MAX = 5 * 1024 * 1024;
    if (file.size > MAX) throw new Error("ขนาดรูปต้องไม่เกิน 5MB ต่อรูป");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
    const name = `${crypto.randomUUID()}.${ext}`;
    const fullPath = path.join(uploadDir, name);
    await fs.writeFile(fullPath, buffer);
    saved.push(`/uploads/found/${name}`);
  }
  return saved;
}

/* ---------- GET /api/found ---------- */
/**
 * รองรับ query:
 * - mine=1 (ปริยาย) ให้ดึงเฉพาะของผู้ใช้คนนี้
 * - q, category, place, status=open|resolved
 * - from=YYYY-MM-DD, to=YYYY-MM-DD (เทียบกับ datetime)
 * (สามารถเพิ่ม paginate ภายหลังได้)
 */
export async function GET(req) {
  try {
    const user = await getAuthedUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);

    const mine = toBool(searchParams.get("mine"), true); // ปริยายเป็น true (หน้าของฉัน)
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category") || "";
    const place = searchParams.get("place") || "";
    const status = searchParams.get("status") || "";
    const from = toDateOrNull(searchParams.get("from"));
    const to = toDateOrNull(searchParams.get("to"));

    const where = {};

    // บังคับ “เฉพาะของฉัน” เมื่อ mine=true
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
        // รวมทั้งวัน
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
          images: true,
          status: true,
          createdAt: true,
          createdBy: {
            select: { firstName: true, lastName: true, avatarUrl: true },
          },
        },
      }),
      // นับทั้งหมดของฉัน (ไม่ใส่ฟิลเตอร์อื่น เพื่อแสดง total ในหัว)
      prisma.foundItem.count({ where: { createdById: user.id } }),
    ]);

    // จัดรูปให้แนบ "reporter" เพื่อสื่อสารกับ UI ได้สะดวก
    const shaped = items.map((it) => ({
      ...it,
      reporter: it.createdBy,
    }));

    return NextResponse.json({ items: shaped, mineCount });
  } catch (e) {
    console.error("GET /api/found error:", e);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

/* ---------- POST /api/found ---------- */
/**
 * รับ multipart/form-data:
 *  - name, category, description?, datetime (ISO), place, color?, brand?, images[]
 * สร้าง FoundItem โดย owner = ผู้ใช้งานจาก cookie
 */
export async function POST(req) {
  try {
    const user = await getAuthedUser();
    if (!user)
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );

    const form = await req.formData();

    const name = (form.get("name") || "").toString().trim();
    const category = (form.get("category") || "").toString().trim();
    const description = (form.get("description") || "").toString().trim();
    const datetimeRaw = (form.get("datetime") || "").toString().trim();
    const place = (form.get("place") || "").toString().trim();
    const color = (form.get("color") || "").toString().trim();
    const brand = (form.get("brand") || "").toString().trim();

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

    const imageUrls = await saveImagesFromFormData(form);

    const created = await prisma.foundItem.create({
      data: {
        createdById: user.id,
        name,
        category,
        description: description || null,
        datetime: dt,
        place,
        color: color || null,
        brand: brand || null,
        images: imageUrls,
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
        createdBy: {
          select: { firstName: true, lastName: true, avatarUrl: true },
        },
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
      { success: false, message: e.message || "Server error" },
      { status: 500 }
    );
  }
}
