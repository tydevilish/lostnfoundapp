import { SignJWT, jwtVerify } from "jose";

export const TOKEN_NAME = "lf_token";
// อายุคุกกี้เมื่อกด "จำฉันไว้" = 7 วัน (วินาที)
export const TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

function getSecret() {
  const s = process.env.JWT_SECRET || "dev_secret_change_me";
  return new TextEncoder().encode(s);
}

/** สร้าง JWT จากข้อมูลผู้ใช้ */
export async function signUserToken(user, { seconds } = {}) {
  const exp = seconds ?? 60 * 60 * 4; // ถ้าไม่ remember → 4 ชั่วโมง
  return await new SignJWT({
    sub: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${exp}s`)
    .sign(getSecret());
}

/** ตรวจสอบและถอดรหัส JWT */
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload; // {sub, email, name, iat, exp}
}
