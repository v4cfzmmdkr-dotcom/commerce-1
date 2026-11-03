"use server"

import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth/current"
import { sendOrderToKhayt } from "@/lib/khayt"

export async function resendToKhayt(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get("id") || "")
  const status = await sendOrderToKhayt(id)
  redirect(`/admin/orders/${encodeURIComponent(id)}?khayt=${status}`)
}
