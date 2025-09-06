// middleware.js
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const TOKEN_NAME = "lf_token";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev_secret_change_me"
);

async function hasValidToken(req) {
  const token = req.cookies.get(TOKEN_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req) {
  const { pathname, search } = req.nextUrl;

  // ห้ามเข้าถ้ามี token แล้ว
  const guestOnly = ["/signin", "/signup"];

  // ต้องมี token ถึงจะเข้าได้ (เพิ่ม /messages)
  const authOnly = [
    /^\/found(\/.*)?$/,
    /^\/profile(\/.*)?$/,
    /^\/messages(\/.*)?$/, // ← เพิ่มตรงนี้
  ];

  const isGuestOnly = guestOnly.includes(pathname);
  const needsAuth = authOnly.some((r) =>
    typeof r === "string" ? r === pathname : r.test(pathname)
  );

  const authed = await hasValidToken(req);

  if (isGuestOnly && authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (needsAuth && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    const returnTo = pathname + (search || "");
    url.search = `?from=${encodeURIComponent(returnTo)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // เพิ่ม matcher สำหรับ /messages ด้วย
  matcher: ["/signin", "/signup", "/found/:path*", "/profile/:path*", "/messages/:path*"],
};
