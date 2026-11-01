import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export async function currentAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const user = await currentUser()
  if (!user) return null
  const allowed = adminEmails()
  const email = user.emailAddresses
    .filter((address) => address.verification?.status === "verified")
    .map((address) => address.emailAddress.toLowerCase())
    .find((address) => allowed.includes(address))
  return email ? { id: user.id, email } : null
}

export async function requireAdmin() {
  const admin = await currentAdmin()
  if (!admin) redirect("/admin/login")
  return admin
}
