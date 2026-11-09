import { getSql, databaseConfigured, textArray } from "@/db/client"
import { summaryText } from "@/lib/html"
import { isPurchasable } from "@/lib/money"
import { listActiveShippingRates } from "@/lib/orders"
import { enabledColourNames, offeredVariants, shopMaterials, type MaterialSetting } from "@/lib/product-options"
import { getSettings } from "@/lib/settings"
import { SHIPPING_COUNTRY, shippingRateApplies, type ShippingRate } from "@/lib/shipping"
import { siteUrl } from "@/lib/site"
import { dataApiEnabled, supabaseRest } from "@/lib/supabase-rest"

export type MerchantVariant = {
  id: string
  sku: string
  title: string
  option1Name: string
  option1Value: string
  option2Name: string
  option2Value: string
  option3Name: string
  option3Value: string
  priceCents: number
  compareAtCents: number | null
  inventoryQty: number
  inventoryPolicy: string
  available: boolean
}

export type MerchantProduct = {
  id: string
  handle: string
  title: string
  descriptionHtml: string
  tags: string[]
  images: Array<{ url: string, alt: string }>
  variants: MerchantVariant[]
}

export type MerchantItem = {
  id: string
  itemGroupId: string
  title: string
  description: string
  link: string
  imageLink: string
  additionalImageLinks: string[]
  availability: "in_stock" | "out_of_stock"
  price: string
  salePrice: string
  brand: string
  condition: "new"
  identifierExists: "no"
  color: string
  material: string
  size: string
  productType: string
  shipping: Array<{ country: string, service: string, price: string }>
}

const titleLimit = 150
const descriptionLimit = 5000
const brandLimit = 70

function clip(value: string, max: number) {
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim()
}

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function tag(name: string, value: string) {
  if (!value) return ""
  return `<${name}>${escapeXml(value)}</${name}>`
}

function money(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
}

function absoluteUrl(site: string, url: string) {
  const value = url.trim()
  if (!value) return ""
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("//")) return `https:${value}`
  const origin = site.replace(/\/$/, "")
  return `${origin}${value.startsWith("/") ? value : `/${value}`}`
}

function meaningful(value: string) {
  const trimmed = value.trim()
  if (!trimmed || /^(default title|default)$/i.test(trimmed)) return ""
  return trimmed
}

function optionKind(name: string) {
  const lower = name.trim().toLowerCase()
  if (lower === "colour" || lower === "color") return "color" as const
  if (lower === "material") return "material" as const
  if (lower === "size") return "size" as const
  return "detail" as const
}

function optionsOf(variant: MerchantVariant) {
  return [
    [variant.option1Name, variant.option1Value],
    [variant.option2Name, variant.option2Value],
    [variant.option3Name, variant.option3Value],
  ].flatMap(([name, value]) => {
    const detail = meaningful(value)
    return detail ? [{ kind: optionKind(name), value: detail }] : []
  })
}

function productType(tags: string[]) {
  const clean: string[] = []
  for (const tag of tags) {
    const value = tag.replace(/\s+/g, " ").trim()
    if (!value || value.length > 50) continue
    if (clean.some((item) => item.toLowerCase() === value.toLowerCase())) continue
    clean.push(value)
    if (clean.length === 3) break
  }
  return ["Parts", ...clean].join(" > ")
}

export function buildMerchantItems(input: {
  products: MerchantProduct[]
  storeName: string
  currency: string
  siteUrl: string
  shippingRates: ShippingRate[]
}): MerchantItem[] {
  const origin = input.siteUrl.replace(/\/$/, "")
  const brand = clip(input.storeName || "Niche Parts Australia", brandLimit)
  const items: MerchantItem[] = []
  for (const product of input.products) {
    const images = product.images
      .map((image) => absoluteUrl(origin, image.url))
      .filter((url, index, all) => url.startsWith("http") && all.indexOf(url) === index)
    if (!images.length || !product.handle || !product.title.trim()) continue
    const variants = product.variants.filter((variant) => variant.id && variant.priceCents > 0)
    const grouped = variants.length > 1
    for (const variant of variants) {
      const options = optionsOf(variant)
      const details = options.map((option) => option.value)
      const extra = details.filter((detail) => !product.title.toLowerCase().includes(detail.toLowerCase()))
      const title = clip(extra.length ? `${product.title} - ${extra.join(" / ")}` : product.title, titleLimit)
      const description = clip(summaryText(product.descriptionHtml, descriptionLimit) || title, descriptionLimit)
      const regular = variant.compareAtCents != null && variant.compareAtCents > variant.priceCents
        ? variant.compareAtCents
        : variant.priceCents
      const shipping = input.shippingRates
        .filter((rate) => shippingRateApplies(rate, variant.priceCents, SHIPPING_COUNTRY))
        .slice(0, 4)
        .map((rate) => ({
          country: SHIPPING_COUNTRY,
          service: clip(rate.name || "Standard", 50) || "Standard",
          price: money(rate.priceCents, input.currency),
        }))
      items.push({
        id: variant.id,
        itemGroupId: grouped ? product.id : "",
        title,
        description,
        link: `${origin}/products/${encodeURIComponent(product.handle)}?variant=${encodeURIComponent(variant.id)}`,
        imageLink: images[0],
        additionalImageLinks: images.slice(1, 11),
        availability: isPurchasable(variant) ? "in_stock" : "out_of_stock",
        price: money(regular, input.currency),
        salePrice: regular === variant.priceCents ? "" : money(variant.priceCents, input.currency),
        brand,
        condition: "new",
        identifierExists: "no",
        color: options.find((option) => option.kind === "color")?.value ?? "",
        material: options.find((option) => option.kind === "material")?.value ?? "",
        size: options.find((option) => option.kind === "size")?.value ?? "",
        productType: productType(product.tags),
        shipping,
      })
    }
  }
  return items
}

export function renderMerchantFeed(input: { title: string, link: string, description: string, items: MerchantItem[] }) {
  const items = input.items.map((item) => {
    const shipping = item.shipping.map((rate) => [
      "<g:shipping>",
      tag("g:country", rate.country),
      tag("g:service", rate.service),
      tag("g:price", rate.price),
      "</g:shipping>",
    ].join("")).join("")
    return [
      "<item>",
      tag("g:id", item.id),
      tag("g:item_group_id", item.itemGroupId),
      tag("g:title", item.title),
      tag("g:description", item.description),
      tag("g:link", item.link),
      tag("g:image_link", item.imageLink),
      ...item.additionalImageLinks.map((url) => tag("g:additional_image_link", url)),
      tag("g:availability", item.availability),
      tag("g:price", item.price),
      tag("g:sale_price", item.salePrice),
      tag("g:brand", item.brand),
      tag("g:condition", item.condition),
      tag("g:identifier_exists", item.identifierExists),
      tag("g:color", item.color),
      tag("g:material", item.material),
      tag("g:size", item.size),
      tag("g:product_type", item.productType),
      shipping,
      "</item>",
    ].join("")
  }).join("")
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<rss version=\"2.0\" xmlns:g=\"http://base.google.com/ns/1.0\">",
    "<channel>",
    tag("title", clip(input.title, 150)),
    tag("link", input.link),
    tag("description", clip(input.description, 500)),
    items,
    "</channel>",
    "</rss>",
  ].join("")
}

type RawImage = { url?: string, alt?: string | null, position?: number }
type RawVariant = {
  id?: string
  title?: string
  sku?: string
  option1Name?: string
  option1Value?: string
  option2Name?: string
  option2Value?: string
  option3Name?: string
  option3Value?: string
  priceCents?: number
  compareAtCents?: number | null
  inventoryQty?: number
  inventoryPolicy?: string
  available?: boolean
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value !== "string" || !value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function toVariant(row: RawVariant): MerchantVariant {
  return {
    id: String(row.id ?? ""),
    sku: String(row.sku ?? ""),
    title: String(row.title ?? ""),
    option1Name: String(row.option1Name ?? ""),
    option1Value: String(row.option1Value ?? ""),
    option2Name: String(row.option2Name ?? ""),
    option2Value: String(row.option2Value ?? ""),
    option3Name: String(row.option3Name ?? ""),
    option3Value: String(row.option3Value ?? ""),
    priceCents: Number(row.priceCents ?? 0),
    compareAtCents: row.compareAtCents == null ? null : Number(row.compareAtCents),
    inventoryQty: Number(row.inventoryQty ?? 0),
    inventoryPolicy: String(row.inventoryPolicy ?? ""),
    available: Boolean(row.available),
  }
}

function publishableProducts(
  rows: Array<{
    id: string
    handle: string
    title: string
    descriptionHtml: string
    tags: unknown
    materials: unknown
    images: RawImage[]
    variants: RawVariant[]
  }>,
  colours: string[],
  materials: MaterialSetting[],
) {
  return rows.flatMap((row) => {
    const variants = offeredVariants(row.variants.map(toVariant), colours, shopMaterials(row.materials, materials))
    if (!variants.length) return []
    const images = [...row.images]
      .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
      .flatMap((image) => image.url ? [{ url: image.url, alt: image.alt ?? "" }] : [])
    return [{
      id: row.id,
      handle: row.handle,
      title: row.title,
      descriptionHtml: row.descriptionHtml ?? "",
      tags: textArray(row.tags),
      images,
      variants,
    }]
  })
}

async function loadFromSql(colours: string[], materials: MaterialSetting[]) {
  const sql = getSql()
  const rows = await sql<Array<{
    id: string
    handle: string
    title: string
    descriptionHtml: string
    tags: unknown
    materials: unknown
    images: unknown
    variants: unknown
  }>>`
    select
      p.id,
      p.handle,
      p.title,
      p.description_html as "descriptionHtml",
      p.tags,
      p.materials,
      coalesce((
        select json_agg(json_build_object('url', i.url, 'alt', coalesce(i.alt, ''), 'position', i.position) order by i.position)
        from product_images i
        where i.product_id = p.id
      ), '[]'::json) as images,
      coalesce((
        select json_agg(json_build_object(
          'id', v.id,
          'title', v.title,
          'sku', coalesce(v.sku, ''),
          'option1Name', coalesce(v.option1_name, ''),
          'option1Value', coalesce(v.option1_value, ''),
          'option2Name', coalesce(v.option2_name, ''),
          'option2Value', coalesce(v.option2_value, ''),
          'option3Name', coalesce(v.option3_name, ''),
          'option3Value', coalesce(v.option3_value, ''),
          'priceCents', v.price_cents,
          'compareAtCents', v.compare_at_cents,
          'inventoryQty', v.inventory_qty,
          'inventoryPolicy', coalesce(v.inventory_policy, ''),
          'available', v.available
        ) order by v.position)
        from variants v
        where v.product_id = p.id
      ), '[]'::json) as variants
    from products p
    where p.status = 'active'
    order by p.title asc
  `
  return publishableProducts(rows.map((row) => ({
    ...row,
    images: asArray<RawImage>(row.images),
    variants: asArray<RawVariant>(row.variants),
  })), colours, materials)
}

type RestProduct = {
  id: string
  handle: string
  title: string
  description_html: string | null
  tags: string[] | null
  materials: string[] | null
  product_images?: RawImage[]
  variants?: Array<{
    id: string
    title: string | null
    sku: string | null
    option1_name: string | null
    option1_value: string | null
    option2_name: string | null
    option2_value: string | null
    option3_name: string | null
    option3_value: string | null
    price_cents: number
    compare_at_cents: number | null
    inventory_qty: number
    inventory_policy: string | null
    available: boolean
    position: number
  }>
}

async function loadFromRest(colours: string[], materials: MaterialSetting[]) {
  const pageSize = 500
  const rows: RestProduct[] = []
  const seen = new Set<string>()
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const params = new URLSearchParams()
    params.set("status", "eq.active")
    params.set("select", "id,handle,title,description_html,tags,materials,product_images(url,alt,position),variants(id,title,sku,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value,price_cents,compare_at_cents,inventory_qty,inventory_policy,available,position)")
    params.set("order", "title.asc")
    const result = await supabaseRest<RestProduct[]>(`products?${params.toString()}`, {
      Range: `${offset}-${offset + pageSize - 1}`,
    })
    if (!result) return null
    const first = result.data[0]?.id
    if (!result.data.length || (first && seen.has(first))) break
    for (const row of result.data) seen.add(row.id)
    rows.push(...result.data)
    if (result.data.length < pageSize) break
  }
  return publishableProducts(rows.map((row) => ({
    id: row.id,
    handle: row.handle,
    title: row.title,
    descriptionHtml: row.description_html ?? "",
    tags: row.tags ?? [],
    materials: row.materials,
    images: row.product_images ?? [],
    variants: (row.variants ?? []).map((variant) => ({
      id: variant.id,
      title: variant.title ?? "",
      sku: variant.sku ?? "",
      option1Name: variant.option1_name ?? "",
      option1Value: variant.option1_value ?? "",
      option2Name: variant.option2_name ?? "",
      option2Value: variant.option2_value ?? "",
      option3Name: variant.option3_name ?? "",
      option3Value: variant.option3_value ?? "",
      priceCents: Number(variant.price_cents),
      compareAtCents: variant.compare_at_cents == null ? null : Number(variant.compare_at_cents),
      inventoryQty: Number(variant.inventory_qty),
      inventoryPolicy: variant.inventory_policy ?? "",
      available: Boolean(variant.available),
    })),
  })), colours, materials)
}

export async function loadMerchantFeed() {
  try {
    const settings = await getSettings()
    const colours = enabledColourNames(settings.colours)
    const products = dataApiEnabled()
      ? await loadFromRest(colours, settings.materials)
      : databaseConfigured()
        ? await loadFromSql(colours, settings.materials)
        : []
    if (!products) return null
    const shippingRates = await listActiveShippingRates().catch(() => [])
    const origin = siteUrl()
    return renderMerchantFeed({
      title: settings.name,
      link: origin,
      description: settings.tagline || "Australian made parts, dispatched within 48 hours.",
      items: buildMerchantItems({
        products,
        storeName: settings.name,
        currency: settings.currency,
        siteUrl: origin,
        shippingRates,
      }),
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "query failed"
    console.error(`Google Merchant feed failed: ${detail}`)
    return null
  }
}
