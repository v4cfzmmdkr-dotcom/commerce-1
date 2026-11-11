import { getSql, databaseConfigured } from "@/db/client"
import { parseColours, parseMaterialSettings, type ColourOption, type MaterialSetting } from "@/lib/product-options"
import { dataApiEnabled } from "@/lib/supabase-rest"
import { defaultTheme, parseTheme } from "@/lib/theme"
import type { ThemeSettings } from "@/lib/types"

export type StoreSettings = {
  name: string
  tagline: string
  announcement: string
  supportEmail: string
  orderAlertEmail: string
  abn: string
  invoiceName: string
  currency: string
  gstRateBps: number
  pricesIncludeTax: boolean
  theme: ThemeSettings
  aboutHtml: string
  shippingHtml: string
  logoUrl: string | null
  bannerUrl: string | null
  bannerKind: "" | "image" | "video"
  colours: ColourOption[]
  materials: MaterialSetting[]
}

export function defaultSettings(): StoreSettings {
  return {
    name: "Niche Parts Australia",
    tagline: "Australian made parts",
    announcement: "Stocked domestically, dispatched within 48 hours with Australia Post.",
    supportEmail: "",
    orderAlertEmail: "",
    abn: "",
    invoiceName: "",
    currency: "aud",
    gstRateBps: 1000,
    pricesIncludeTax: true,
    theme: defaultTheme,
    aboutHtml:
      "<p>Niche Parts Australia makes small-run parts and accessories in Australia, including power-tool fittings, mounts, jigs, and inserts.</p>",
    shippingHtml:
      "<p>All orders are sent with Australia Post. Delivery options and prices are confirmed at checkout. Paid orders are dispatched within 48 hours, and you will get a tracking number by email.</p>",
    logoUrl: null,
    bannerUrl: "/brand/hero.jpg",
    bannerKind: "image",
    colours: parseColours([]),
    materials: parseMaterialSettings([]),
  }
}

function mapSettings(row: Record<string, unknown>): StoreSettings {
  return {
    name: String(row.name || defaultSettings().name),
    tagline: String(row.tagline || ""),
    announcement: String(row.announcement || ""),
    supportEmail: String(row.support_email || ""),
    orderAlertEmail: String(row.order_alert_email || ""),
    abn: String(row.abn || ""),
    invoiceName: String(row.invoice_name || ""),
    currency: String(row.currency || "aud"),
    gstRateBps: Number(row.gst_rate_bps ?? 1000),
    pricesIncludeTax: Boolean(row.prices_include_tax),
    theme: parseTheme(row.theme),
    aboutHtml: String(row.about_html || ""),
    shippingHtml: String(row.shipping_html || ""),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    bannerUrl: row.banner_url ? String(row.banner_url) : null,
    bannerKind: row.banner_kind === "video" ? "video" : row.banner_kind === "image" ? "image" : "",
    colours: parseColours(row.colours),
    materials: parseMaterialSettings(row.materials),
  }
}

export async function databaseReady() {
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (base && key && dataApiEnabled()) {
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/products?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      })
      return response.ok
    } catch {
      return false
    }
  }
  if (!databaseConfigured()) return Boolean(base && key)
  try {
    const sql = getSql()
    await sql`select 1 from store_settings limit 1`
    return true
  } catch {
    if (!base || !key) return false
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/products?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      })
      return response.ok
    } catch {
      return false
    }
  }
}

export async function getSettings() {
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (base && key && dataApiEnabled()) {
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/store_settings?id=eq.default&select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      })
      if (!response.ok) return defaultSettings()
      const rows = await response.json() as Record<string, unknown>[]
      if (!rows[0]) return defaultSettings()
      return mapSettings(rows[0])
    } catch {
      return defaultSettings()
    }
  }
  if (!databaseConfigured()) return defaultSettings()
  try {
    const sql = getSql()
    const rows = await sql`select * from store_settings where id = 'default' limit 1`
    if (!rows[0]) return defaultSettings()
    return mapSettings(rows[0] as Record<string, unknown>)
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : ""
    const detail = error instanceof Error && error.message ? error.message : "connection failed"
    console.error(`Database unavailable${code ? ` (${code})` : ""}: ${detail}`)
    return defaultSettings()
  }
}
