import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { adminCookieName, readAdminSession } from "@/lib/auth/session"

export async function currentAdmin() {
  const jar = await cookies()
  const token = jar.get(adminCookieName)?.value
  if (!token) return null
  return readAdminSession(token)
}

export async function requireAdmin() {
  const admin = await currentAdmin()
  if (!admin) redirect("/admin/login")
  return admin
}
