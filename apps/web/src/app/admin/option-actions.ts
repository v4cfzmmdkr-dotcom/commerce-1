"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getSql, textArrayLiteral } from "@/db/client"
import { requireAdmin } from "@/lib/auth/current"
import { parseMoneyToCents } from "@/lib/money"
import {
  cleanName,
  defaultMaterial,
  materialOptions,
  orderColours,
  parseColours,
  parseMaterialSettings,
  parseMaterials,
  type ColourOption,
  type MaterialSetting,
} from "@/lib/product-options"
import { repriceMaterials, syncProductOptions } from "@/lib/product-options-sync"

function back(params: Record<string, string>) {
  return `/admin/materials?${new URLSearchParams(params)}`
}

export async function removeColour(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") || "").toLowerCase()
  const sql = getSql()
  const [row] = await sql<Array<{ colours: unknown }>>`select colours from store_settings where id = 'default'`
  const colours = parseColours(row?.colours).filter((colour) => colour.name.toLowerCase() !== name)
  if (!colours.some((colour) => colour.enabled)) redirect(back({ materialError: "Keep at least one PETG colour switched on" }))
  await sql`update store_settings set colours = ${sql.json(colours)}, updated_at = now() where id = 'default'`
  revalidatePath("/", "layout")
  redirect(back({ colours: "removed" }))
}

export async function saveMaterialsAndColours(formData: FormData) {
  await requireAdmin()
  const enabled = new Set(formData.getAll("materials").map(String))
  if (!enabled.size) redirect(back({ materialError: "Keep at least one material switched on" }))
  const sql = getSql()
  const [row] = await sql<Array<{ colours: unknown, materials: unknown }>>`select colours, materials from store_settings where id = 'default'`
  const petgColours = new Set(formData.getAll(`colours_${defaultMaterial}`).map((value) => String(value).toLowerCase()))
  const palette: ColourOption[] = orderColours(parseColours(row?.colours), formData.get("colourOrder")).map((colour) => ({
    ...colour,
    enabled: petgColours.has(colour.name.toLowerCase()),
  }))
  const newName = cleanName(String(formData.get("newName") || ""))
  const newHex = String(formData.get("newHex") || "").toLowerCase()
  if (newName) {
    if (!/^#[0-9a-f]{6}$/.test(newHex)) redirect(back({ materialError: "Pick a colour for the new swatch" }))
    const existing = palette.find((colour) => colour.name.toLowerCase() === newName.toLowerCase())
    if (existing) Object.assign(existing, { hex: newHex, enabled: true })
    else palette.push({ name: newName, hex: newHex, enabled: true })
  }
  if (!palette.some((colour) => colour.enabled)) redirect(back({ materialError: "Keep at least one PETG colour switched on" }))
  const wasOn = new Set(parseMaterialSettings(row?.materials).filter((setting) => setting.enabled).map((setting) => setting.name))
  const settings: MaterialSetting[] = []
  for (const material of materialOptions) {
    let markupCents = 0
    let colours: string[] | null = null
    if (material.name !== defaultMaterial) {
      const markup = parseMoneyToCents(String(formData.get(`markup_${material.name}`) || ""))
      if (markup === "invalid") redirect(back({ materialError: `Enter the ${material.name} markup like 4.00` }))
      markupCents = markup ?? 0
      const ticked = new Set(formData.getAll(`colours_${material.name}`).map((value) => String(value).toLowerCase()))
      colours = palette.filter((colour) => ticked.has(colour.name.toLowerCase())).map((colour) => colour.name)
      if (enabled.has(material.name) && !colours.length) {
        redirect(back({ materialError: `Pick at least one colour for ${material.name}, or switch it off` }))
      }
    }
    settings.push({ name: material.name, enabled: enabled.has(material.name), markupCents, colours })
  }
  await sql.begin(async (tx) => {
    await tx`
      update store_settings set colours = ${sql.json(palette)}, materials = ${sql.json(settings)}, updated_at = now()
      where id = 'default'
    `
    for (const setting of settings) {
      if (!setting.enabled || wasOn.has(setting.name)) continue
      await tx`
        update products set materials = array_append(materials, ${setting.name}), updated_at = now()
        where not (${setting.name} = any(materials))
      `
    }
  })
  const { added } = await syncProductOptions()
  const repriced = await repriceMaterials()
  revalidatePath("/", "layout")
  redirect(back({ materials: "saved", added: String(added), repriced: String(repriced) }))
}

export async function saveMaterials(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get("id") || "")
  const chosen = formData.getAll("materials").map(String)
  if (!chosen.length) redirect(`/admin/products/${id}?materialError=1`)
  const sql = getSql()
  await sql`update products set materials = ${textArrayLiteral(parseMaterials(chosen))}::text[], updated_at = now() where id = ${id}`
  const result = await syncProductOptions([id])
  revalidatePath("/", "layout")
  redirect(`/admin/products/${id}?materials=saved&added=${result.added}`)
}
