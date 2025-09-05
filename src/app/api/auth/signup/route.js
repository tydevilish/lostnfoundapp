// app/api/auth/signup/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";


export async function POST(req) {
  try {
    const body = await req.json();
    const {
      firstName = "",
      lastName = "",
      phone = "",
      email = "",
      password = "",
    } = body || {};

    // --- validate แบบเบื้องต้น ---
    const f = (s) => String(s || "").trim();
    const _firstName = f(firstName);
    const _lastName = f(lastName);
    const _phone = f(phone).replace(/\s|-/g, ""); // ลบช่องว่าง/ขีด
    const _email = f(email).toLowerCase();
    const _password = String(password || "");

    if (!_firstName) return bad("กรุณากรอกชื่อ");
    if (!_lastName) return bad("กรุณากรอกนามสกุล");
    if (!/^[0-9]{9,12}$/.test(_phone)) return bad("กรอกเบอร์โทร 9–12 หลัก");
    if (!/^\S+@\S+\.\S+$/.test(_email)) return bad("อีเมลไม่ถูกต้อง");
    if (_password.length < 6) return bad("รหัสผ่านอย่างน้อย 6 ตัวอักษร");

    // --- เช็ค email ซ้ำ ---
    const exists = await prisma.user.findUnique({ where: { email: _email } });
    if (exists) return bad("อีเมลนี้ถูกใช้แล้ว");

    // --- แฮชรหัสผ่าน ---
    const passwordHash = await bcrypt.hash(_password, 10);

    // --- บันทึกผู้ใช้ใหม่ ---
    await prisma.user.create({
      data: {
        firstName: _firstName,
        lastName: _lastName,
        phone: _phone,
        email: _email,
        passwordHash,
      },
    });

    return NextResponse.json(
      { success: true, message: "สมัครสมาชิกสำเร็จ" },
      { status: 201 }
    );
  } catch (err) {
    console.error("SIGNUP_ERROR:", err);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }
}

function bad(message) {
  return NextResponse.json({ success: false, message }, { status: 400 });
}
