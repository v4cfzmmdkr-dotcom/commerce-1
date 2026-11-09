import { describe, expect, it } from "vitest"
import { buildMerchantItems, renderMerchantFeed, type MerchantProduct } from "@/lib/merchant-feed"
import type { ShippingRate } from "@/lib/shipping"

const rates: ShippingRate[] = [
  { id: "standard", name: "Standard", priceCents: 995, countries: "AU", minSubtotalCents: null, maxSubtotalCents: 2499 },
  { id: "free", name: "Free", priceCents: 0, countries: "AU", minSubtotalCents: 2500, maxSubtotalCents: null },
  { id: "express", name: "Express", priceCents: 1495, countries: "AU", minSubtotalCents: null, maxSubtotalCents: null },
]

function product(overrides: Partial<MerchantProduct> = {}): MerchantProduct {
  return {
    id: "product-1",
    handle: "dyson-adapter",
    title: "Dyson V11 Filter Adapter",
    descriptionHtml: "<p>Cleans a Dyson V11 filter. Free shipping is not part of this sentence.</p>",
    tags: ["Vacuum"],
    images: [{ url: "/api/media/filter.jpg", alt: "Filter" }, { url: "https://cdn.example/side.jpg", alt: "" }],
    variants: [{
      id: "variant-white",
      sku: "DY-W",
      title: "White / PETG",
      option1Name: "Colour",
      option1Value: "White",
      option2Name: "Material",
      option2Value: "PETG",
      option3Name: "",
      option3Value: "",
      priceCents: 1425,
      compareAtCents: null,
      inventoryQty: 0,
      inventoryPolicy: "continue",
      available: true,
    }],
    ...overrides,
  }
}

const base = {
  storeName: "Niche Parts Australia",
  currency: "aud",
  siteUrl: "https://nicheparts.com.au",
  shippingRates: rates,
}

describe("buildMerchantItems", () => {
  it("lists a made-to-order part with the store as the brand", () => {
    const [item] = buildMerchantItems({ ...base, products: [product()] })
    expect(item.id).toBe("variant-white")
    expect(item.itemGroupId).toBe("")
    expect(item.brand).toBe("Niche Parts Australia")
    expect(item.identifierExists).toBe("no")
    expect(item.condition).toBe("new")
    expect(item.availability).toBe("in_stock")
    expect(item.price).toBe("14.25 AUD")
    expect(item.salePrice).toBe("")
    expect(item.color).toBe("White")
    expect(item.material).toBe("PETG")
    expect(item.title).toBe("Dyson V11 Filter Adapter - White / PETG")
    expect(item.link).toBe("https://nicheparts.com.au/products/dyson-adapter?variant=variant-white")
    expect(item.imageLink).toBe("https://nicheparts.com.au/api/media/filter.jpg")
    expect(item.additionalImageLinks).toEqual(["https://cdn.example/side.jpg"])
    expect(item.description).toBe("Cleans a Dyson V11 filter. Free shipping is not part of this sentence.")
    expect(item.productType).toBe("Parts > Vacuum")
    expect(item.shipping.map((rate) => rate.price)).toEqual(["9.95 AUD", "14.95 AUD"])
  })

  it("groups colour variants and marks one out of stock", () => {
    const items = buildMerchantItems({
      ...base,
      products: [product({
        variants: [
          product().variants[0],
          {
            ...product().variants[0],
            id: "variant-black",
            option1Value: "Black",
            available: false,
            priceCents: 3000,
            compareAtCents: 3500,
          },
        ],
      })],
    })
    expect(items.map((item) => item.id)).toEqual(["variant-white", "variant-black"])
    expect(items.every((item) => item.itemGroupId === "product-1")).toBe(true)
    expect(items[1].availability).toBe("out_of_stock")
    expect(items[1].price).toBe("35.00 AUD")
    expect(items[1].salePrice).toBe("30.00 AUD")
    expect(items[1].shipping.map((rate) => rate.service)).toEqual(["Free", "Express"])
  })

  it("skips a part with no photo and leaves the default title off the name", () => {
    const items = buildMerchantItems({
      ...base,
      products: [
        product({ images: [] }),
        product({
          id: "plain",
          handle: "clip",
          title: "Cable clip & mount",
          variants: [{
            ...product().variants[0],
            id: "plain-1",
            option1Name: "Title",
            option1Value: "Default Title",
            option2Name: "",
            option2Value: "",
          }],
        }),
      ],
    })
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe("Cable clip & mount")
    expect(items[0].color).toBe("")
  })
})

describe("renderMerchantFeed", () => {
  it("escapes text and writes a Google product RSS feed", () => {
    const [item] = buildMerchantItems({ ...base, products: [product({ title: "Cable clip & mount" })] })
    const xml = renderMerchantFeed({
      title: "Niche Parts Australia",
      link: "https://nicheparts.com.au",
      description: "Australian made parts",
      items: [item],
    })
    expect(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true)
    expect(xml).toContain("xmlns:g=\"http://base.google.com/ns/1.0\"")
    expect(xml).toContain("<g:title>Cable clip &amp; mount - White / PETG</g:title>")
    expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>")
    expect(xml).toContain("<g:brand>Niche Parts Australia</g:brand>")
    expect(xml).toContain("<g:country>AU</g:country>")
    expect(xml).not.toContain("Dyson</g:brand>")
  })
})
