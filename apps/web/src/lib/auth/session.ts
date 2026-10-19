import { SignJWT, jwtVerify } from "jose"

export const adminCookieName = "np_admin"

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET must be at least 16 characters")
  }
  return new TextEncoder().encode(value)
}

export async function signAdminSession(payload: { sub: string, email: string }) {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret())
}

export async function readAdminSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null
    return { sub: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  }
}
