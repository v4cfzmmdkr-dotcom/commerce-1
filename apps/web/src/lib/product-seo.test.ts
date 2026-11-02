import { describe, expect, it } from "vitest"
import { freeShippingFrom, pageTitle, searchDescription, shippingCentsFor } from "@/lib/product-seo"

const rates = [
  { id: "standard", name: "Standard", priceCents: 995, countries: "AU", minSubtotalCents: null, maxSubtotalCents: 2499 },
  { id: "free", name: "Free", priceCents: 0, countries: "AU", minSubtotalCents: 2500, maxSubtotalCents: null },
]

describe("searchDescription", () => {
  it("skips generic eBay wording and adds price and selling points", () => {
    const text = searchDescription({
      title: "Fellowes Powershred PS 55 shredder gear",
      descriptionHtml: "New item. 3d printed replacement\nIf you are looking for other similar items contact me",
      seoDescription: "",
      prices: [1500],
      freeShippingFromCents: 2500,
    })
    expect(text).toBe("Fellowes Powershred PS 55 shredder gear. $15.00, free shipping over $25. Australian made, dispatched within 48 hours.")
  })

  it("uses the first useful sentence and stays within 155 characters", () => {
    const text = searchDescription({
      title: "Aurora AS1002X Shredder Gear",
      descriptionHtml: "<p>Replace a worn or stripped gear in your shredder with this replacement drive gear for the Aurora AS1002X paper shredder. It restores smooth operation.</p>",
      seoDescription: "",
      prices: [2800, 3200],
      freeShippingFromCents: 2500,
    })
    expect(text.length).toBeLessThanOrEqual(155)
    expect(text.startsWith("Replace a worn or stripped gear")).toBe(true)
    expect(text.endsWith("From $28.00 with free shipping. Australian made, dispatched within 48 hours.")).toBe(true)
  })

  it("falls back to the title when the copy is instructions or a sales note", () => {
    const install = "3d printed\n\nHow to install:\nPut the adapter onto your half case first and then lock the original clip."
    const reuse = "New item. 3d printed replacement\nIf you are looking for other similar items contact me\n\nYou will have to reuse your old metal gear."
    const note = "Let me know if you are looking for other plastic spares"
    for (const descriptionHtml of [install, reuse, note]) {
      const text = searchDescription({ title: "Part name", descriptionHtml, seoDescription: "", prices: [3300], freeShippingFromCents: 2500 })
      expect(text).toBe("Part name. $33.00 with free shipping. Australian made, dispatched within 48 hours.")
    }
  })

  it("keeps a description written in the admin", () => {
    expect(searchDescription({ title: "A", descriptionHtml: "", seoDescription: "Custom text", prices: [100], freeShippingFromCents: null })).toBe("Custom text")
  })
})

describe("pageTitle", () => {
  it("drops the store name from long titles", () => {
    expect(pageTitle("Bonsaii C261-D shredder gear", "Niche Parts")).toBe("Bonsaii C261-D shredder gear")
    expect(pageTitle("Radius Measuring Gauge 0-50mm | Plastic Fillet & Corner Radius Tool", "Niche Parts"))
      .toEqual({ absolute: "Radius Measuring Gauge 0-50mm | Plastic Fillet & Corner Radius Tool" })
  })
})

describe("shipping", () => {
  it("finds the free shipping threshold and the cost for one item", () => {
    expect(freeShippingFrom(rates)).toBe(2500)
    expect(shippingCentsFor(rates, 1500)).toBe(995)
    expect(shippingCentsFor(rates, 2500)).toBe(0)
  })
})
