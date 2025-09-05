import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { TOKEN_NAME } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const c = cookieStore;
  c.set(TOKEN_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ success: true });
}
