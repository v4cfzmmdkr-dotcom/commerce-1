import { describe, expect, it } from "vitest"
import {
  materialColours,
  materialSlot,
  offeredVariants,
  parseColours,
  parseMaterialSettings,
  parseMaterials,
  planReprice,
  planVariants,
  shopMaterials,
  variantOffered,
  withDefaultMaterial,
  type PlanVariant,
} from "@/lib/product-options"

function variant(id: string, colour: string, material = "", extra: Partial<PlanVariant> = {}): PlanVariant {
  return {
    id,
    title: "",
    sku: "BH",
    option1Name: "Colour",
    option1Value: colour,
    option2Name: material ? "Material" : "",
    option2Value: material,
    option3Name: "",
    option3Value: "",
    priceCents: 1800,
    compareAtCents: null,
    position: 0,
    ...extra,
  }
}

describe("parseColours", () => {
  it("starts with Black and White switched on", () => {
    const colours = parseColours(null)
    expect(colours.filter((colour) => colour.enabled).map((colour) => colour.name)).toEqual(["Black", "White"])
    expect(colours.some((colour) => colour.name === "Red" && !colour.enabled)).toBe(true)
  })

  it("keeps saved choices and custom colours, dropping bad entries", () => {
    const colours = parseColours([
      { name: "Olive", hex: "#6B8E23", enabled: true },
      { name: "Black", hex: "#1d1d1f", enabled: false },
      { name: "Broken", hex: "red" },
    ])
    expect(colours[0]).toEqual({ name: "Olive", hex: "#6b8e23", enabled: true })
    expect(colours.find((colour) => colour.name === "Black")?.enabled).toBe(false)
    expect(colours.find((colour) => colour.name === "White")?.enabled).toBe(false)
    expect(colours.some((colour) => colour.name === "Broken")).toBe(false)
  })
})

describe("materials", () => {
  it("defaults to PETG and ignores unknown materials", () => {
    expect(parseMaterials(null)).toEqual(["PETG"])
    expect(parseMaterials(["pps cf", "Nylon"])).toEqual(["PPS CF"])
    expect(parseMaterials("{PETG,\"PPS CF\"}")).toEqual(["PETG", "PPS CF"])
  })

  it("limits PPS CF to black", () => {
    expect(materialColours("PPS CF", ["Black", "White", "Red"])).toEqual(["Black"])
    expect(materialColours("PPS CF", ["White"])).toEqual([])
    expect(materialColours("PETG", ["Black", "White"])).toEqual(["Black", "White"])
  })

  it("puts the material in the first free slot", () => {
    expect(materialSlot([variant("a", "Black")])).toBe(2)
    expect(materialSlot([variant("a", "Black", "", { option2Name: "Size", option2Value: "Large" })])).toBe(3)
    expect(materialSlot([variant("a", "Black", "", {
      option2Name: "Size", option2Value: "Large", option3Name: "Fit", option3Value: "Snug",
    })])).toBe(0)
    expect(withDefaultMaterial([variant("a", "Black")])[0]).toMatchObject({ option2Name: "Material", option2Value: "PETG" })
  })
})

describe("offered variants", () => {
  const variants = [
    variant("1", "Black", "PETG"),
    variant("2", "white", "PETG"),
    variant("3", "Red", "PETG"),
    variant("4", "Black", "PPS CF"),
    variant("5", "White", "PPS CF"),
  ]

  it("hides switched-off colours, unticked materials, and non-black PPS CF", () => {
    expect(offeredVariants(variants, ["Black", "White"], ["PETG"]).map((item) => item.id)).toEqual(["1", "2"])
    expect(offeredVariants(variants, ["Black", "White"], ["PETG", "PPS CF"]).map((item) => item.id)).toEqual(["1", "2", "4"])
    expect(offeredVariants(variants, ["White"], ["PPS CF"])).toEqual([])
  })

  it("tidies names and titles", () => {
    const [white] = offeredVariants([variant("2", "white", "petg", { option1Name: "Primary colour" })], ["White"], ["PETG"])
    expect(white).toMatchObject({ option1Name: "Colour", option1Value: "White", option2Value: "PETG", title: "White / PETG" })
  })

  it("checks a single variant for the cart", () => {
    expect(variantOffered(variants[3], ["Black"], ["PETG", "PPS CF"])).toBe(true)
    expect(variantOffered(variants[4], ["Black", "White"], ["PETG", "PPS CF"])).toBe(false)
    expect(variantOffered(variants[2], ["Black", "White"], ["PETG"])).toBe(false)
  })
})

describe("planVariants", () => {
  it("adds the material to old variants and creates missing colours", () => {
    const plan = planVariants([variant("b", "Black"), variant("w", "White", "", { sku: "BH-W", position: 1 })], ["Black", "White", "Red"], ["PETG"])
    expect(plan.updates.map((item) => [item.id, item.title])).toEqual([["b", "Black / PETG"], ["w", "White / PETG"]])
    expect(plan.inserts).toHaveLength(1)
    expect(plan.inserts[0]).toMatchObject({
      copiedFrom: "b",
      option1Value: "Red",
      option2Name: "Material",
      option2Value: "PETG",
      title: "Red / PETG",
      sku: "BH-RED",
      priceCents: 1800,
      position: 2,
    })
  })

  it("creates one black PPS CF variant per option group with the extra charge", () => {
    const plan = planVariants([
      variant("bs", "Black", "PETG", { option3Name: "Size", option3Value: "Small", compareAtCents: 2400 }),
      variant("ws", "White", "PETG", { option3Name: "Size", option3Value: "Small" }),
      variant("bl", "Black", "PETG", { option3Name: "Size", option3Value: "Large" }),
      variant("wl", "White", "PETG", { option3Name: "Size", option3Value: "Large" }),
    ], ["Black", "White"], ["PETG", "PPS CF"], { "PPS CF": 500 })
    expect(plan.updates).toEqual([])
    expect(plan.inserts.map((item) => [item.copiedFrom, item.title, item.priceCents, item.compareAtCents, item.sku])).toEqual([
      ["bs", "Black / PPS CF / Small", 2300, 2900, "BH-PPSCF"],
      ["bl", "Black / PPS CF / Large", 2300, null, "BH-PPSCF"],
    ])
  })

  it("does nothing when everything already exists", () => {
    const plan = planVariants([variant("b", "Black", "PETG"), variant("c", "Black", "PPS CF")], ["Black"], ["PETG", "PPS CF"])
    expect(plan).toEqual({ updates: [], inserts: [] })
  })
})

describe("shop-wide material settings", () => {
  it("defaults to every material on with no markup", () => {
    expect(parseMaterialSettings(null)).toEqual([
      { name: "PETG", enabled: true, markupCents: 0 },
      { name: "PPS CF", enabled: true, markupCents: 0 },
    ])
    expect(parseMaterialSettings([{ name: "PETG", markupCents: 300 }, { name: "pps cf", enabled: false, markupCents: 450 }])).toEqual([
      { name: "PETG", enabled: true, markupCents: 0 },
      { name: "PPS CF", enabled: false, markupCents: 450 },
    ])
  })

  it("hides materials switched off for the whole shop", () => {
    const settings = parseMaterialSettings([{ name: "PPS CF", enabled: false }])
    expect(shopMaterials(["PETG", "PPS CF"], settings)).toEqual(["PETG"])
    expect(shopMaterials(["PPS CF"], settings)).toEqual([])
  })

  it("reprices PPS CF from the matching PETG variant", () => {
    const updates = planReprice([
      variant("ps", "Black", "PETG", { option3Name: "Size", option3Value: "Small", compareAtCents: 2400 }),
      variant("pl", "Black", "PETG", { option3Name: "Size", option3Value: "Large", priceCents: 2200 }),
      variant("cs", "Black", "PPS CF", { option3Name: "Size", option3Value: "Small", priceCents: 1800 }),
      variant("cl", "Black", "PPS CF", { option3Name: "Size", option3Value: "Large", priceCents: 2650 }),
    ], { "PPS CF": 450 })
    expect(updates).toEqual([{ id: "cs", priceCents: 2250, compareAtCents: 2850 }])
  })
})
