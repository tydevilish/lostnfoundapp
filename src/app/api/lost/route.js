// app/api/lost/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public list of found items (ทุกคนเห็นได้)
 * Query params:
 *  - q: string (ค้นหาใน name/description/place/category/brand/color)
 *  - category: string (ถ้าไม่ได้ส่ง จะไม่กรอง)
 *  - place: string
 *  - status: "open" | "resolved" (ไม่สนตัวพิมพ์)
 *  - from: "YYYY-MM-DD"  (กรอง datetime >= startOfDay)
 *  - to:   "YYYY-MM-DD"  (กรอง datetime < nextDay ของ to)
 *  - page: number (เริ่มที่ 1)
 *  - limit: number (default 24)
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const place = searchParams.get("place")?.trim() || "";
    const statusRaw = searchParams.get("status")?.trim() || "";
    const from = searchParams.get("from")?.trim() || "";
    const to = searchParams.get("to")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "24", 10)));
    const skip = (page - 1) * limit;

    // map status -> enum
    const status = ["OPEN", "RESOLVED"].includes(statusRaw.toUpperCase())
      ? statusRaw.toUpperCase()
      : statusRaw
      ? (statusRaw.toLowerCase() === "resolved" ? "RESOLVED" :
         statusRaw.toLowerCase() === "open" ? "OPEN" : undefined)
      : undefined;

    // date range on "datetime"
    const dateFilter = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d)) dateFilter.gte = d; // start of day local ok
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d)) {
        // < next day เพื่อครอบคลุมทั้งวันของ to
        const next = new Date(d.getTime());
        next.setDate(next.getDate() + 1);
        dateFilter.lt = next;
      }
    }

    const where = {
      ...(q
        ? {
            OR: [
              { name:       { contains: q, mode: "insensitive" } },
              { description:{ contains: q, mode: "insensitive" } },
              { place:      { contains: q, mode: "insensitive" } },
              { category:   { contains: q, mode: "insensitive" } },
              { brand:      { contains: q, mode: "insensitive" } },
              { color:      { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(category ? { category: { equals: category } } : {}),
      ...(place ? { place: { equals: place } } : {}),
      ...(status ? { status } : {}),
      ...(Object.keys(dateFilter).length ? { datetime: dateFilter } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.foundItem.findMany({
        where,
        orderBy: { datetime: "desc" },
        skip,
        take: limit,
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
          updatedAt: true,
          createdById: true,
          createdBy: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      }),
      prisma.foundItem.count({ where }),
    ]);

    return NextResponse.json({ success: true, items, total, page, limit }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
