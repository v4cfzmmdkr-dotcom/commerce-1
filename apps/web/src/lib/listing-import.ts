import { getSql } from "@/db/client"
import { parseMoneyToCents } from "@/lib/money"
import { emptyReport, migrateRemoteImages, upsertProduct } from "@/lib/shopify/import"
import type { ParsedImage, ParsedProduct, ParsedVariant } from "@/lib/shopify/parse"
import { slugify } from "@/lib/slug"

export type ListingLink =
  | { kind: "shopify", url: string, productJsonUrl: string, handle: string }
  | { kind: "ebay", url: string, itemId: string | null }

export class ListingError extends Error {}

const maxImages = 12

export function parseListingLink(input: string): ListingLink {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new ListingError("Paste the full link, starting with https://")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ListingError("Paste a web link")
  const host = url.hostname.toLowerCase()
  if (host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) throw new ListingError("Paste a public listing link")
  if (/(^|\.)ebay\.[a-z.]+$/.test(host) || host === "ebay.io" || host === "ebay.us") {
    const itemId = url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/)?.[1] ?? url.searchParams.get("item")
    return { kind: "ebay", url: url.toString(), itemId: itemId && /^\d{9,15}$/.test(itemId) ? itemId : null }
  }
  const handle = url.pathname.match(/\/products\/([^/?#.]+)/)?.[1]
  if (!handle) throw new ListingError("Paste a Shopify product link (it contains /products/) or an eBay listing link")
  return {
    kind: "shopify",
    url: `${url.origin}/products/${handle}`,
    productJsonUrl: `${url.origin}/products/${handle}.json`,
    handle: decodeURIComponent(handle),
  }
}

type ShopifyJsonProduct = {
  title?: string
  handle?: string
  body_html?: string
  vendor?: string
  product_type?: string
  tags?: string | string[]
  options?: Array<{ name?: string, position?: number }>
  variants?: Array<{
    sku?: string | null
    price?: string | number
    compare_at_price?: string | number | null
    option1?: string | null
    option2?: string | null
    option3?: string | null
    grams?: number
    barcode?: string | null
  }>
  images?: Array<{ src?: string, position?: number, alt?: string | null }>
}

function cents(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = parseMoneyToCents(String(value))
  return typeof parsed === "number" ? parsed : null
}

function variant(fields: Partial<ParsedVariant> & { priceCents: number, position: number }): ParsedVariant {
  return {
    sku: "",
    option1Name: "",
    option1Value: "",
    option2Name: "",
    option2Value: "",
    option3Name: "",
    option3Value: "",
    compareAtCents: null,
    costCents: null,
    inventoryQty: 0,
    inventoryPolicy: "continue",
    weightGrams: 0,
    taxable: true,
    barcode: "",
    ...fields,
  }
}

function product(fields: Pick<ParsedProduct, "handle" | "title" | "descriptionHtml" | "variants" | "images"> & Partial<ParsedProduct>): ParsedProduct {
  return {
    vendor: "",
    productType: "",
    tags: [],
    status: "draft",
    seoTitle: "",
    seoDescription: "",
    metadata: {},
    ...fields,
  }
}

export function productFromShopify(json: { product?: ShopifyJsonProduct }, sourceUrl: string): ParsedProduct {
  const source = json.product
  if (!source?.title) throw new ListingError("That Shopify link did not return a product")
  const names = [...(source.options ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((option) => (option.name && option.name !== "Title" ? option.name : ""))
  const variants = (source.variants ?? []).flatMap((item, index) => {
    const priceCents = cents(item.price)
    if (priceCents === null) return []
    const values = [item.option1, item.option2, item.option3].map((value) => (value && value !== "Default Title" ? value : ""))
    return [variant({
      sku: item.sku ?? "",
      option1Name: values[0] ? names[0] ?? "" : "",
      option1Value: values[0],
      option2Name: values[1] ? names[1] ?? "" : "",
      option2Value: values[1],
      option3Name: values[2] ? names[2] ?? "" : "",
      option3Value: values[2],
      priceCents,
      compareAtCents: cents(item.compare_at_price),
      weightGrams: Math.max(0, Math.round(item.grams ?? 0)),
      barcode: item.barcode ?? "",
      position: index,
    })]
  })
  if (variants.length === 0) throw new ListingError("That Shopify product has no price")
  const tags = Array.isArray(source.tags) ? source.tags : (source.tags ?? "").split(",")
  return product({
    handle: slugify(source.handle || source.title),
    title: source.title.trim(),
    descriptionHtml: source.body_html ?? "",
    vendor: source.vendor ?? "",
    productType: source.product_type ?? "",
    tags: Array.from(new Set(tags.map((tag) => tag.trim()).filter((tag) => tag && !tag.includes("::")))),
    metadata: { sourceUrl },
    variants,
    images: images((source.images ?? []).map((image) => ({ src: image.src ?? "", alt: image.alt ?? "" }))),
  })
}

type EbayItem = {
  itemId?: string
  title?: string
  description?: string
  shortDescription?: string
  price?: { value?: string, currency?: string }
  image?: { imageUrl?: string }
  additionalImages?: Array<{ imageUrl?: string }>
  localizedAspects?: Array<{ name?: string, value?: string }>
}

function images(list: Array<{ src: string, alt: string }>): ParsedImage[] {
  const seen = new Set<string>()
  return list
    .filter((image) => /^https?:\/\//.test(image.src) && !seen.has(image.src) && seen.add(image.src))
    .slice(0, maxImages)
    .map((image, index) => ({ src: image.src, alt: image.alt, position: index + 1 }))
}

function ebayImages(items: EbayItem[]) {
  return images(items.flatMap((item) => [item.image, ...(item.additionalImages ?? [])])
    .map((image) => ({ src: image?.imageUrl ?? "", alt: "" })))
}

export function productFromEbay(items: EbayItem[], sourceUrl: string, commonDescription = ""): ParsedProduct {
  const first = items[0]
  if (!first?.title) throw new ListingError("That eBay link did not return a listing")
  const aspectValues = (item: EbayItem) => new Map((item.localizedAspects ?? []).map((aspect) => [aspect.name ?? "", aspect.value ?? ""]))
  const maps = items.map(aspectValues)
  const varying = items.length > 1
    ? [...maps[0].keys()].filter((name) => name && new Set(maps.map((map) => map.get(name) ?? "")).size > 1).slice(0, 3)
    : []
  const variants = items.flatMap((item, index) => {
    const priceCents = cents(item.price?.value)
    if (priceCents === null) return []
    const values = varying.map((name) => maps[index].get(name) ?? "")
    return [variant({
      option1Name: varying[0] ?? "",
      option1Value: values[0] ?? "",
      option2Name: varying[1] ?? "",
      option2Value: values[1] ?? "",
      option3Name: varying[2] ?? "",
      option3Value: values[2] ?? "",
      priceCents,
      position: index,
    })]
  })
  if (variants.length === 0) throw new ListingError("That eBay listing has no price")
  return product({
    handle: slugify(first.title),
    title: first.title.trim(),
    descriptionHtml: first.description || commonDescription || (first.shortDescription ? `<p>${first.shortDescription}</p>` : ""),
    metadata: { sourceUrl },
    variants,
    images: ebayImages(items),
  })
}

async function fetchShopify(link: Extract<ListingLink, { kind: "shopify" }>) {
  const response = await fetch(link.productJsonUrl, { headers: { Accept: "application/json" }, redirect: "follow" })
  if (response.status === 404) throw new ListingError("That product was not found. Check the link, or the store may not be on Shopify")
  if (!response.ok) throw new ListingError(`The store did not share the product (HTTP ${response.status})`)
  const type = response.headers.get("content-type") || ""
  if (!type.includes("json")) throw new ListingError("That store did not return Shopify product data")
  return productFromShopify(await response.json() as { product?: ShopifyJsonProduct }, link.url)
}

let ebayToken: { value: string, expires: number } | null = null

async function ebayAccessToken() {
  const id = process.env.EBAY_CLIENT_ID
  const secret = process.env.EBAY_CLIENT_SECRET
  if (!id || !secret) throw new ListingError("eBay links need eBay API keys. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET, then try again")
  if (ebayToken && ebayToken.expires > Date.now() + 60_000) return ebayToken.value
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }),
  })
  if (!response.ok) throw new ListingError(`eBay rejected the API keys (HTTP ${response.status})`)
  const data = await response.json() as { access_token: string, expires_in: number }
  ebayToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 }
  return ebayToken.value
}

async function ebayGet<T>(path: string) {
  const response = await fetch(`https://api.ebay.com/buy/browse/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${await ebayAccessToken()}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_AU",
      Accept: "application/json",
    },
  })
  const data = await response.json().catch(() => ({})) as T & { errors?: Array<{ errorId?: number, message?: string }> }
  return { ok: response.ok, status: response.status, data }
}

async function resolveEbayItemId(link: Extract<ListingLink, { kind: "ebay" }>) {
  if (link.itemId) return link.itemId
  const response = await fetch(link.url, { redirect: "follow" }).catch(() => null)
  const itemId = response?.url.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/)?.[1]
  if (!itemId) throw new ListingError("Open the listing on eBay and copy its link from the address bar (it contains /itm/)")
  return itemId
}

async function fetchEbay(link: Extract<ListingLink, { kind: "ebay" }>) {
  const itemId = await resolveEbayItemId(link)
  const single = await ebayGet<EbayItem>(`item/get_item_by_legacy_id?legacy_item_id=${itemId}&fieldgroups=PRODUCT`)
  if (single.ok) return productFromEbay([single.data], `https://www.ebay.com.au/itm/${itemId}`)
  if (single.data.errors?.some((error) => error.errorId === 11006)) {
    const group = await ebayGet<{ items?: EbayItem[], commonDescriptions?: Array<{ description?: string }> }>(
      `item/get_items_by_item_group?item_group_id=${itemId}`,
    )
    if (group.ok && group.data.items?.length) {
      return productFromEbay(group.data.items, `https://www.ebay.com.au/itm/${itemId}`, group.data.commonDescriptions?.[0]?.description ?? "")
    }
  }
  if (single.status === 404) throw new ListingError("eBay could not find that listing. It may have ended")
  throw new ListingError(single.data.errors?.[0]?.message || `eBay returned HTTP ${single.status}`)
}

async function placeProduct(parsed: ParsedProduct) {
  const sql = getSql()
  const rows = await sql<Array<{ handle: string, status: ParsedProduct["status"], sourceUrl: string | null }>>`
    select handle, status, metadata->>'sourceUrl' as "sourceUrl" from products
    where handle = ${parsed.handle} or handle like ${`${parsed.handle}-%`}
  `
  const same = rows.find((row) => row.sourceUrl === parsed.metadata.sourceUrl)
  if (same) return { handle: same.handle, status: same.status }
  const taken = new Set(rows.map((row) => row.handle))
  if (!taken.has(parsed.handle)) return { handle: parsed.handle, status: null }
  for (let n = 2; ; n += 1) {
    if (!taken.has(`${parsed.handle}-${n}`)) return { handle: `${parsed.handle}-${n}`, status: null }
  }
}

export async function importListing(input: string, options: { list: boolean }) {
  const link = parseListingLink(input)
  const parsed = link.kind === "shopify" ? await fetchShopify(link) : await fetchEbay(link)
  const place = await placeProduct(parsed)
  parsed.handle = place.handle
  parsed.status = options.list ? "active" : place.status ?? "draft"
  const id = await upsertProduct(parsed, emptyReport("listing"))
  const photos = await migrateRemoteImages({ limit: maxImages, concurrency: 4, productId: id })
  return { id, source: link.kind, photosCopied: photos.stored, photosFailed: photos.failed }
}
