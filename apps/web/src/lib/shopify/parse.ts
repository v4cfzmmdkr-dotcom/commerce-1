import { parse } from "csv-parse/sync"
import { parseMoneyToCents } from "@/lib/money"
import type { ParseIssue, ProductMetadata } from "@/lib/types"

export type ShopifyRow = Record<string, string>

export type ParsedVariant = {
  sku: string
  option1Name: string
  option1Value: string
  option2Name: string
  option2Value: string
  option3Name: string
  option3Value: string
  priceCents: number
  compareAtCents: number | null
  costCents: number | null
  inventoryQty: number
  inventoryPolicy: "deny" | "continue"
  weightGrams: number
  taxable: boolean
  barcode: string
  position: number
}

export type ParsedImage = {
  src: string
  position: number
  alt: string
}

export type ParsedProduct = {
  handle: string
  title: string
  descriptionHtml: string
  vendor: string
  productType: string
  tags: string[]
  status: "active" | "draft" | "archived"
  seoTitle: string
  seoDescription: string
  metadata: ProductMetadata
  variants: ParsedVariant[]
  images: ParsedImage[]
}

export type ShopifyParseResult = {
  products: ParsedProduct[]
  issues: ParseIssue[]
}

export function decodeCsvBuffer(buffer: Buffer) {
  let offset = 0
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    offset = 3
  }
  const slice = buffer.subarray(offset)
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(slice),
      encoding: offset ? "utf-8-bom" : "utf-8",
    }
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(slice),
      encoding: "windows-1252",
    }
  }
}

function cell(row: ShopifyRow, name: string) {
  return (row[name] ?? "").trim()
}

function fieldIncluding(row: ShopifyRow, needle: string) {
  const key = Object.keys(row).find((item) => item.toLowerCase().includes(needle))
  return key ? (row[key] ?? "").trim() : ""
}

function mapStatus(status: string, published: string): ParsedProduct["status"] | null {
  const state = status.trim().toLowerCase()
  const visible = published.trim().toLowerCase()
  if (state === "archived") return "archived"
  if (state === "draft") return "draft"
  if (state === "active") return visible === "false" ? "draft" : "active"
  if (!state && visible === "true") return "active"
  if (!state && visible === "false") return "draft"
  return null
}

function variantTitleParts(variant: ParsedVariant) {
  return [variant.option1Value, variant.option2Value, variant.option3Value].filter(
    (value) => value && value.toLowerCase() !== "default title",
  )
}

export function variantLabel(variant: Pick<ParsedVariant, "option1Value" | "option2Value" | "option3Value">) {
  return variantTitleParts(variant as ParsedVariant).join(" / ")
}

export function parseShopifyCsv(text: string): ShopifyParseResult {
  const issues: ParseIssue[] = []
  let records: ShopifyRow[]
  try {
    records = parse(text, {
      columns: (headers: string[]) => {
        const names = headers.map((header) => header.trim())
        if (!names.includes("Handle") || !names.includes("Title") || !names.includes("Variant Price")) {
          throw new Error("Missing Handle, Title, or Variant Price column. Upload a Shopify product CSV.")
        }
        return names
      },
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      relax_quotes: true,
    }) as ShopifyRow[]
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the CSV"
    return {
      products: [],
      issues: [{ record: 0, handle: "", level: "error", message }],
    }
  }

  const groups = new Map<string, Array<{ record: number, data: ShopifyRow }>>()
  records.forEach((data, index) => {
    const record = index + 1
    const handle = cell(data, "Handle")
    if (!handle) {
      issues.push({ record, handle: "", level: "error", message: "Missing product handle" })
      return
    }
    const rows = groups.get(handle) ?? []
    rows.push({ record, data })
    groups.set(handle, rows)
  })

  const products: ParsedProduct[] = []
  for (const [handle, rows] of groups) {
    const built = buildProduct(handle, rows, issues)
    if (built) products.push(built)
  }
  return { products, issues }
}

function buildProduct(
  handle: string,
  rows: Array<{ record: number, data: ShopifyRow }>,
  issues: ParseIssue[],
) {
  if (rows.some((row) => cell(row.data, "Gift Card").toLowerCase() === "true")) {
    issues.push({
      record: rows[0].record,
      handle,
      level: "skipped",
      message: "Gift cards are not imported",
    })
    return null
  }

  const titled = rows.find((row) => cell(row.data, "Title"))
  if (!titled) {
    issues.push({ record: rows[0].record, handle, level: "skipped", message: "Product has no title" })
    return null
  }

  const statusRow = rows.find((row) => cell(row.data, "Status") || cell(row.data, "Published"))
  const status = mapStatus(
    statusRow ? cell(statusRow.data, "Status") : "",
    statusRow ? cell(statusRow.data, "Published") : cell(titled.data, "Published"),
  )
  if (!status) {
    issues.push({
      record: titled.record,
      handle,
      level: "skipped",
      message: "Missing product status",
    })
    return null
  }

  let option1Name = ""
  let option2Name = ""
  let option3Name = ""
  const variants: ParsedVariant[] = []
  const images: ParsedImage[] = []
  const seenImages = new Set<string>()

  rows.forEach((row, index) => {
    if (cell(row.data, "Option1 Name")) option1Name = cell(row.data, "Option1 Name")
    if (cell(row.data, "Option2 Name")) option2Name = cell(row.data, "Option2 Name")
    if (cell(row.data, "Option3 Name")) option3Name = cell(row.data, "Option3 Name")

    const imageSrc = cell(row.data, "Image Src")
    if (imageSrc && !seenImages.has(imageSrc)) {
      seenImages.add(imageSrc)
      const positionRaw = cell(row.data, "Image Position")
      const position = /^\d+$/.test(positionRaw) ? Number(positionRaw) : images.length + 1
      images.push({
        src: imageSrc,
        position,
        alt: cell(row.data, "Image Alt Text"),
      })
    }

    const priceRaw = cell(row.data, "Variant Price")
    const sku = cell(row.data, "Variant SKU")
    const option1Value = cell(row.data, "Option1 Value")
    const option2Value = cell(row.data, "Option2 Value")
    const option3Value = cell(row.data, "Option3 Value")
    const isVariant = Boolean(priceRaw || sku || option1Value || option2Value || option3Value)
    if (!isVariant) return

    const price = parseMoneyToCents(priceRaw)
    if (price === null || price === "invalid") {
      issues.push({
        record: row.record,
        handle,
        level: "error",
        message: price === "invalid" ? `Invalid price "${priceRaw}"` : "Variant is missing a price",
      })
      return
    }

    const compare = parseMoneyToCents(cell(row.data, "Variant Compare At Price"))
    const cost = parseMoneyToCents(cell(row.data, "Cost per item"))
    if (compare === "invalid") {
      issues.push({ record: row.record, handle, level: "warning", message: "Invalid compare-at price ignored" })
    }
    if (cost === "invalid") {
      issues.push({ record: row.record, handle, level: "warning", message: "Invalid cost ignored" })
    }

    const qtyRaw = cell(row.data, "Variant Inventory Qty")
    let inventoryQty = 0
    if (qtyRaw) {
      if (!/^-?\d+$/.test(qtyRaw)) {
        issues.push({ record: row.record, handle, level: "warning", message: `Invalid inventory quantity "${qtyRaw}" stored as 0` })
      } else {
        inventoryQty = Number(qtyRaw)
      }
    }

    const policy = cell(row.data, "Variant Inventory Policy").toLowerCase() === "continue" ? "continue" : "deny"
    const gramsRaw = cell(row.data, "Variant Grams")
    let weightGrams = 0
    if (gramsRaw) {
      const grams = Number(gramsRaw)
      if (Number.isFinite(grams)) weightGrams = Math.max(0, Math.round(grams))
    }

    variants.push({
      sku,
      option1Name,
      option1Value,
      option2Name,
      option2Value,
      option3Name,
      option3Value,
      priceCents: price,
      compareAtCents: compare === "invalid" ? null : compare,
      costCents: cost === "invalid" ? null : cost,
      inventoryQty,
      inventoryPolicy: policy,
      weightGrams,
      taxable: cell(row.data, "Variant Taxable").toLowerCase() !== "false",
      barcode: cell(row.data, "Variant Barcodes") || cell(row.data, "Variant Barcode"),
      position: index,
    })
  })

  if (variants.length === 0) {
    issues.push({ record: titled.record, handle, level: "skipped", message: "Product has no valid variants" })
    return null
  }

  const tags = Array.from(
    new Set(
      cell(titled.data, "Tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )

  const metadata: ProductMetadata = {}
  const material = fieldIncluding(titled.data, "shopify.material")
  const mountingType = fieldIncluding(titled.data, "mounting-type")
  const color = fieldIncluding(titled.data, "color-pattern")
  const compatibleVacuum = fieldIncluding(titled.data, "compatible-vacuum")
  const compatibleCoffee = fieldIncluding(titled.data, "compatible-coffee")
  if (material) metadata.material = material
  if (mountingType) metadata.mountingType = mountingType
  if (color) metadata.color = color
  if (compatibleVacuum) metadata.compatibleVacuum = compatibleVacuum
  if (compatibleCoffee) metadata.compatibleCoffee = compatibleCoffee

  images.sort((a, b) => a.position - b.position)

  return {
    handle,
    title: cell(titled.data, "Title"),
    descriptionHtml: rows.map((row) => row.data["Body (HTML)"] ?? "").find((value) => value.trim()) ?? "",
    vendor: cell(titled.data, "Vendor"),
    productType: cell(titled.data, "Type"),
    tags,
    status,
    seoTitle: rows.map((row) => cell(row.data, "SEO Title")).find(Boolean) ?? "",
    seoDescription: rows.map((row) => cell(row.data, "SEO Description")).find(Boolean) ?? "",
    metadata,
    variants,
    images,
  }
}
