"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getSql } from "@/db/client"
import { verifyPassword } from "@/lib/auth/password"
import { adminCookieName, adminCookieOptions, signAdminSession } from "@/lib/auth/session"

export async function login(_previous: { error?: string } | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")
  const next = String(formData.get("next") || "/admin")
  const destination = next.startsWith("/admin") ? next : "/admin"
  try {
    const sql = getSql()
    const rows = await sql<{ id: string, email: string, passwordHash: string }[]>`
      select id, email, password_hash as "passwordHash" from admin_users where email = ${email}
    `
    const user = rows[0]
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { error: "Those details do not match an admin account" }
    }
    const token = await signAdminSession({ sub: user.id, email: user.email })
    const jar = await cookies()
    jar.set(adminCookieName, token, adminCookieOptions())
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not sign in" }
  }
  redirect(destination)
}

export async function logout() {
  const jar = await cookies()
  jar.delete(adminCookieName)
  redirect("/admin/login")
}
