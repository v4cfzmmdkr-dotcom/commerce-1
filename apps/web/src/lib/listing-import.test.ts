import { describe, expect, it } from "vitest"
import { parseListingLink, productFromEbay, productFromShopify } from "@/lib/listing-import"

describe("parseListingLink", () => {
  it("reads Shopify product links, including ones inside a collection", () => {
    expect(parseListingLink("https://store.com/collections/mounts/products/wall-mount?variant=1")).toEqual({
      kind: "shopify",
      url: "https://store.com/products/wall-mount",
      productJsonUrl: "https://store.com/products/wall-mount.json",
      handle: "wall-mount",
    })
  })

  it("reads eBay item numbers from listing links", () => {
    expect(parseListingLink("https://www.ebay.com.au/itm/Some-Title/325912345678?hash=x")).toMatchObject({ kind: "ebay", itemId: "325912345678" })
    expect(parseListingLink("https://www.ebay.com.au/itm/325912345678")).toMatchObject({ kind: "ebay", itemId: "325912345678" })
    expect(parseListingLink("https://ebay.us/m/AbCdEf")).toMatchObject({ kind: "ebay", itemId: null })
  })

  it("rejects links that are not product listings", () => {
    expect(() => parseListingLink("not a link")).toThrow("full link")
    expect(() => parseListingLink("https://store.com/pages/about")).toThrow("/products/")
    expect(() => parseListingLink("http://127.0.0.1/products/x")).toThrow("public")
  })
})

describe("productFromShopify", () => {
  it("copies options, prices, and photos", () => {
    const product = productFromShopify({
      product: {
        title: "Wall Mount",
        handle: "wall-mount",
        body_html: "<p>Strong.</p>",
        tags: "mount, wall, app::internal => true",
        options: [{ name: "Colour", position: 1 }],
        variants: [
          { sku: "WM-B", price: "18.00", compare_at_price: "22.00", option1: "Black", grams: 40 },
          { sku: "WM-W", price: "18.50", option1: "White" },
        ],
        images: [{ src: "https://cdn.shopify.com/a.jpg", position: 1 }, { src: "https://cdn.shopify.com/a.jpg" }],
      },
    }, "https://store.com/products/wall-mount")
    expect(product.title).toBe("Wall Mount")
    expect(product.tags).toEqual(["mount", "wall"])
    expect(product.metadata.sourceUrl).toBe("https://store.com/products/wall-mount")
    expect(product.variants.map((v) => [v.option1Name, v.option1Value, v.priceCents, v.compareAtCents])).toEqual([
      ["Colour", "Black", 1800, 2200],
      ["Colour", "White", 1850, null],
    ])
    expect(product.images).toEqual([{ src: "https://cdn.shopify.com/a.jpg", alt: "", position: 1 }])
  })

  it("drops Shopify's placeholder option for single products", () => {
    const product = productFromShopify({
      product: { title: "Gear", options: [{ name: "Title" }], variants: [{ price: "9.95", option1: "Default Title" }] },
    }, "https://store.com/products/gear")
    expect(product.variants[0]).toMatchObject({ option1Name: "", option1Value: "", priceCents: 995 })
  })
})

describe("productFromEbay", () => {
  it("turns a single listing into one product", () => {
    const product = productFromEbay([{
      title: "Starlink Mount",
      description: "<p>Fits Gen 3.</p>",
      price: { value: "34.95", currency: "AUD" },
      image: { imageUrl: "https://i.ebayimg.com/1.jpg" },
      additionalImages: [{ imageUrl: "https://i.ebayimg.com/2.jpg" }],
    }], "https://www.ebay.com.au/itm/1")
    expect(product).toMatchObject({ title: "Starlink Mount", handle: "starlink-mount", descriptionHtml: "<p>Fits Gen 3.</p>" })
    expect(product.variants).toHaveLength(1)
    expect(product.variants[0].priceCents).toBe(3495)
    expect(product.images.map((image) => image.src)).toEqual(["https://i.ebayimg.com/1.jpg", "https://i.ebayimg.com/2.jpg"])
  })

  it("uses the aspects that differ across a variation listing as options", () => {
    const product = productFromEbay([
      { title: "Clip", price: { value: "5.00" }, localizedAspects: [{ name: "Colour", value: "Black" }, { name: "Brand", value: "Niche" }] },
      { title: "Clip", price: { value: "6.00" }, localizedAspects: [{ name: "Colour", value: "White" }, { name: "Brand", value: "Niche" }] },
    ], "https://www.ebay.com.au/itm/2")
    expect(product.variants.map((v) => [v.option1Name, v.option1Value, v.priceCents])).toEqual([
      ["Colour", "Black", 500],
      ["Colour", "White", 600],
    ])
  })
})
