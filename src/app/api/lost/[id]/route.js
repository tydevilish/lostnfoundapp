// app/api/lost/[id]/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public detail of a found item (ทุกคนเห็นได้)
 * Method: GET
 */
export async function GET(_req, ctx) {
  try {
    // Next 14: ต้อง await params ถ้าเป็น dynamic APIs บางกรณี
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Missing id" }, { status: 400 });
    }

    const item = await prisma.foundItem.findUnique({
      where: { id },
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
          select: { id: true, firstName: true, lastName: true, phone: true , email:true,   avatarUrl: true },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, item }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
