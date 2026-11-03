"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getSql, textArrayLiteral } from "@/db/client"
import { requireAdmin } from "@/lib/auth/current"
import { parseMoneyToCents } from "@/lib/money"
import { cleanName, materialOptions, parseColours, parseMaterials, type ColourOption } from "@/lib/product-options"
import { syncProductOptions } from "@/lib/product-options-sync"

function back(params: Record<string, string>) {
  return `/admin/products?${new URLSearchParams(params)}`
}

export async function saveColours(formData: FormData) {
  await requireAdmin()
  const sql = getSql()
  const [row] = await sql<Array<{ colours: unknown }>>`select colours from store_settings where id = 'default'`
  const enabled = new Set(formData.getAll("colours").map((value) => String(value).toLowerCase()))
  const colours: ColourOption[] = parseColours(row?.colours).map((colour) => ({
    ...colour,
    enabled: enabled.has(colour.name.toLowerCase()),
  }))
  const name = cleanName(String(formData.get("newName") || ""))
  const hex = String(formData.get("newHex") || "").toLowerCase()
  if (name) {
    if (!/^#[0-9a-f]{6}$/.test(hex)) redirect(back({ colourError: "Pick a colour for the new swatch" }))
    const existing = colours.find((colour) => colour.name.toLowerCase() === name.toLowerCase())
    if (existing) Object.assign(existing, { hex, enabled: true })
    else colours.push({ name, hex, enabled: true })
  }
  if (!colours.some((colour) => colour.enabled)) redirect(back({ colourError: "Keep at least one colour switched on" }))
  await sql`update store_settings set colours = ${sql.json(colours)}, updated_at = now() where id = 'default'`
  const result = await syncProductOptions()
  revalidatePath("/", "layout")
  redirect(back({ colours: "saved", added: String(result.added) }))
}

export async function saveMaterials(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get("id") || "")
  const chosen = formData.getAll("materials").map(String)
  if (!chosen.length) redirect(`/admin/products/${id}?materialError=1`)
  const materials = parseMaterials(chosen)
  const extra = parseMoneyToCents(String(formData.get("extra") || "").trim())
  const extraCents: Record<string, number> = {}
  if (typeof extra === "number") {
    for (const material of materialOptions) {
      if (material.name !== "PETG") extraCents[material.name] = extra
    }
  }
  const sql = getSql()
  await sql`update products set materials = ${textArrayLiteral(materials)}::text[], updated_at = now() where id = ${id}`
  const result = await syncProductOptions([id], extraCents)
  revalidatePath("/", "layout")
  redirect(`/admin/products/${id}?materials=saved&added=${result.added}`)
}
