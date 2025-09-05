import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signUserToken, TOKEN_NAME, TOKEN_MAX_AGE } from "@/lib/auth";

export async function POST(req) {
  try {
    const { email = "", password = "", remember = false } = await req.json();
    const _email = String(email).trim().toLowerCase();
    const _password = String(password);

    if (!/^\S+@\S+\.\S+$/.test(_email) || _password.length < 6) {
      return bad("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    const user = await prisma.user.findUnique({ where: { email: _email } });
    if (!user) return bad("อีเมลหรือรหัสผ่านไม่ถูกต้อง");

    const ok = await bcrypt.compare(_password, user.passwordHash);
    if (!ok) return bad("อีเมลหรือรหัสผ่านไม่ถูกต้อง");

    // ออก token: ถ้า remember → อายุ 7 วัน, ไม่งั้น 4 ชั่วโมง (ใน JWT)
    const seconds = remember ? TOKEN_MAX_AGE : 60 * 60 * 4;
    const token = await signUserToken(user, { seconds });

    // เซ็ต HttpOnly Cookie
    const cookieStore = await cookies();
    const c = cookieStore;
    c.set(TOKEN_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(remember ? { maxAge: TOKEN_MAX_AGE } : {}), // ถ้าไม่ remember จะเป็น session cookie
    });

    const { passwordHash, ...safeUser } = user;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (err) {
    console.error("SIGNIN_ERROR:", err);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}

function bad(message) {
  return NextResponse.json({ success: false, message }, { status: 400 });
}
