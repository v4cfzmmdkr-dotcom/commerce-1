import { describe, expect, it } from "vitest"
import { includedTaxCents, parseMoneyToCents } from "@/lib/money"
import { quoteOrder } from "@/lib/pricing"
import { decodeCsvBuffer, parseShopifyCsv } from "@/lib/shopify/parse"
import { assertPublicHttps } from "@/lib/shopify/collections"
import { darkTheme, defaultTheme, parseTheme } from "@/lib/theme"

const headers = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value",
  "Variant SKU", "Variant Grams", "Variant Inventory Qty", "Variant Inventory Policy", "Variant Price",
  "Variant Compare At Price", "Variant Taxable", "Image Src", "Image Position", "Image Alt Text",
  "Gift Card", "SEO Title", "SEO Description", "Status", "Cost per item",
]

function csvRow(values: Record<string, string>) {
  return headers.map((header) => {
    const value = values[header] ?? ""
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value
  }).join(",")
}

const csv = [
  headers.join(","),
  csvRow({
    Handle: "peg",
    Title: "Sun pegs",
    "Body (HTML)": "<p>Line one</p>\n<p>Line two</p>",
    Vendor: "Niche Parts",
    Type: "Parts",
    Tags: "imported, workshop",
    Published: "true",
    "Option1 Name": "Title",
    "Option1 Value": "Default Title",
    "Variant SKU": "SKU1",
    "Variant Grams": "12",
    "Variant Inventory Qty": "5",
    "Variant Inventory Policy": "deny",
    "Variant Price": "15.00",
    "Variant Compare At Price": "20.00",
    "Variant Taxable": "true",
    "Image Src": "https://cdn.shopify.com/peg.jpg",
    "Image Position": "1",
    "Image Alt Text": "Front",
    "Gift Card": "false",
    "SEO Title": "Sun pegs",
    "SEO Description": "A peg",
    Status: "active",
    "Cost per item": "4.50",
  }),
  csvRow({
    Handle: "peg",
    "Image Src": "https://cdn.shopify.com/peg-2.jpg",
    "Image Position": "2",
    "Image Alt Text": "Side",
  }),
  csvRow({
    Handle: "saw",
    Title: "Table extension",
    "Body (HTML)": "<p>Fits the saw</p>",
    Vendor: "Niche Parts",
    Tags: "imported",
    Published: "true",
    "Option1 Name": "Size",
    "Option1 Value": "Large",
    "Option2 Name": "Colour",
    "Option2 Value": "Black",
    "Variant Grams": "80",
    "Variant Inventory Qty": "0",
    "Variant Inventory Policy": "deny",
    "Variant Price": "66.00",
    "Variant Taxable": "true",
    "Image Src": "https://cdn.shopify.com/saw.jpg",
    "Image Position": "1",
    "Gift Card": "false",
    Status: "active",
  }),
  csvRow({
    Handle: "saw",
    "Option1 Value": "Small",
    "Option2 Value": "White",
    "Variant Grams": "80",
    "Variant Inventory Qty": "0",
    "Variant Inventory Policy": "continue",
    "Variant Price": "66.00",
    "Variant Taxable": "false",
    "Image Position": "2",
    "Gift Card": "false",
  }),
  csvRow({
    Handle: "bad",
    Title: "Broken",
    Published: "true",
    "Option1 Name": "Title",
    "Option1 Value": "Default Title",
    "Variant Price": "abc",
    "Variant Inventory Policy": "deny",
    "Gift Card": "false",
    Status: "active",
  }),
  csvRow({
    Handle: "card",
    Title: "Gift",
    Published: "true",
    "Option1 Value": "Default Title",
    "Variant Price": "10.00",
    "Gift Card": "true",
    Status: "active",
  }),
  csvRow({
    Title: "No handle",
    "Variant Price": "10.00",
    Status: "active",
  }),
].join("\n")

describe("shopify csv", () => {
  it("decodes a utf-8 bom", () => {
    const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Handle,Title\n", "utf8")])
    expect(decodeCsvBuffer(buffer).encoding).toBe("utf-8-bom")
  })

  it("groups variants and images without duplicating a handle", () => {
    const result = parseShopifyCsv(csv)
    const peg = result.products.find((product) => product.handle === "peg")
    const saw = result.products.find((product) => product.handle === "saw")
    expect(peg?.variants).toHaveLength(1)
    expect(peg?.images).toHaveLength(2)
    expect(peg?.variants[0].priceCents).toBe(1500)
    expect(peg?.variants[0].compareAtCents).toBe(2000)
    expect(peg?.variants[0].costCents).toBe(450)
    expect(peg?.tags).toEqual(["imported", "workshop"])
    expect(peg?.descriptionHtml).toContain("Line two")
    expect(saw?.variants).toHaveLength(2)
    expect(saw?.variants[1].option1Name).toBe("Size")
    expect(saw?.variants[1].option2Value).toBe("White")
    expect(saw?.variants[1].inventoryPolicy).toBe("continue")
    expect(saw?.variants[1].taxable).toBe(false)
    expect(result.products.find((product) => product.handle === "bad")).toBeUndefined()
    expect(result.products.find((product) => product.handle === "card")).toBeUndefined()
    expect(result.issues.some((issue) => issue.message.includes("Invalid price"))).toBe(true)
    expect(result.issues.some((issue) => issue.message.includes("Gift cards"))).toBe(true)
    expect(result.issues.some((issue) => issue.message.includes("Missing product handle"))).toBe(true)
  })
})

describe("money", () => {
  it("parses dollars and included gst", () => {
    expect(parseMoneyToCents("10")).toBe(1000)
    expect(parseMoneyToCents("10.5")).toBe(1050)
    expect(parseMoneyToCents("")).toBeNull()
    expect(parseMoneyToCents("10.999")).toBe("invalid")
    expect(includedTaxCents(10000, 1000)).toBe(909)
    expect(quoteOrder({
      lines: [{ unitPriceCents: 1500, quantity: 2, taxable: true }],
      shippingCents: 900,
      gstRateBps: 1000,
      pricesIncludeTax: true,
    }).total).toBe(3900)
  })
})

describe("theme and store url", () => {
  it("keeps valid colours and rejects a private store url", () => {
    expect(parseTheme({ background: "#000000", font: "nope" }).font).toBe("system")
    expect(parseTheme({ background: "#000000", font: "nope" }).background).toBe("#000000")
    expect(parseTheme({ background: "red" }).background).toBe("#ffffff")
    expect(defaultTheme.font).toBe("system")
    expect(darkTheme(defaultTheme).background).toBe("#000000")
    expect(darkTheme(defaultTheme).foreground).toBe("#f5f5f7")
    expect(darkTheme({ ...defaultTheme, background: "#000000", foreground: "#ffffff" }).background).toBe("#000000")
    expect(assertPublicHttps("https://nicheparts.com.au/collections")).toBe("https://nicheparts.com.au")
    expect(() => assertPublicHttps("http://nicheparts.com.au")).toThrow()
    expect(() => assertPublicHttps("https://127.0.0.1")).toThrow()
  })
})
