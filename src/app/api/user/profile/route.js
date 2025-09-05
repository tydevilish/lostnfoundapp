import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, TOKEN_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req) {
  try {
    const token = cookies().get(TOKEN_NAME)?.value;
    if (!token)
      return NextResponse.json(
        { success: false, message: "unauthorized" },
        { status: 401 }
      );

    const payload = await verifyToken(token);
    const { firstName = "", lastName = "", phone = "" } = await req.json();

    const f = (s) => String(s || "").trim();
    const _first = f(firstName);
    const _last = f(lastName);
    const _phone = f(phone).replace(/\s|-/g, "");
    if (!_first) return bad("กรุณากรอกชื่อ");
    if (!_last) return bad("กรุณากรอกนามสกุล");
    if (!/^[0-9]{9,12}$/.test(_phone)) return bad("กรอกเบอร์โทร 9–12 หลัก");

    const user = await prisma.user.update({
      where: { email: payload.email },
      data: { firstName: _first, lastName: _last, phone: _phone },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (e) {
    console.error("PROFILE_PATCH_ERR", e);
    return NextResponse.json(
      { success: false, message: "server error" },
      { status: 500 }
    );
  }
}

function bad(message) {
  return NextResponse.json({ success: false, message }, { status: 400 });
}
