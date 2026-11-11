import { describe, expect, it } from "vitest"
import {
  materialColourRules,
  materialColours,
  materialSlot,
  offeredVariants,
  orderColours,
  parseColours,
  parseMaterialSettings,
  parseMaterials,
  planReprice,
  planVariants,
  shopMaterials,
  variantOffered,
  withDefaultMaterial,
  type ColourRules,
  type PlanVariant,
} from "@/lib/product-options"

function rules(petg: string[], overrides: ColourRules = {}): ColourRules {
  return { PETG: petg, ASA: ["Black", "White"], "PET CF": ["Black"], "PA6 CF": ["Black"], "PPS CF": ["Black"], ...overrides }
}

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

  it("keeps saved choices and custom colours, dropping bad entries and removed colours", () => {
    const colours = parseColours([
      { name: "Olive", hex: "#6B8E23", enabled: true },
      { name: "Black", hex: "#1d1d1f", enabled: false },
      { name: "Broken", hex: "red" },
    ])
    expect(colours[0]).toEqual({ name: "Olive", hex: "#6b8e23", enabled: true })
    expect(colours.find((colour) => colour.name === "Black")?.enabled).toBe(false)
    expect(colours.some((colour) => colour.name === "White")).toBe(false)
    expect(colours.some((colour) => colour.name === "Broken")).toBe(false)
  })

  it("rearranges colours, keeping ones missing from the new order at the end", () => {
    const colours = parseColours(null).slice(0, 4)
    expect(orderColours(colours, JSON.stringify(["red", "Black", "Nope"])).map((colour) => colour.name))
      .toEqual(["Red", "Black", "White", "Orange"])
    expect(orderColours(colours, "not json").map((colour) => colour.name)).toEqual(["Black", "White", "Orange", "Red"])
  })
})

describe("materials", () => {
  it("defaults to PETG and ignores unknown materials", () => {
    expect(parseMaterials(null)).toEqual(["PETG"])
    expect(parseMaterials(["pps cf", "Nylon"])).toEqual(["PPS CF"])
    expect(parseMaterials("{PETG,\"PPS CF\"}")).toEqual(["PETG", "PPS CF"])
  })

  it("knows PA6 CF and PET CF", () => {
    expect(parseMaterials(["pa6 cf", "PET CF"])).toEqual(["PET CF", "PA6 CF"])
  })

  it("starts ASA as black or white and the carbon fibres as black only", () => {
    const palette = parseColours(null).map((colour) => ({ ...colour, enabled: ["Black", "White", "Red"].includes(colour.name) }))
    const colours = materialColourRules(palette, parseMaterialSettings(null))
    expect(colours).toEqual({
      PETG: ["Black", "White", "Red"],
      ASA: ["Black", "White"],
      "PET CF": ["Black"],
      "PA6 CF": ["Black"],
      "PPS CF": ["Black"],
    })
    expect(materialColours("pps cf", colours)).toEqual(["Black"])
    expect(materialColours("Nylon", colours)).toEqual([])
  })

  it("uses each material's saved colours from the palette, even ones PETG doesn't offer", () => {
    const palette = parseColours(null)
    const settings = parseMaterialSettings([
      { name: "ASA", colours: ["red", "Black", "Removed"] },
      { name: "PA6 CF", colours: [] },
    ])
    const colours = materialColourRules(palette, settings)
    expect(colours.PETG).toEqual(["Black", "White"])
    expect(colours.ASA).toEqual(["Black", "Red"])
    expect(colours["PA6 CF"]).toEqual([])
    expect(colours["PET CF"]).toEqual(["Black"])
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
    expect(offeredVariants(variants, rules(["Black", "White"]), ["PETG"]).map((item) => item.id)).toEqual(["1", "2"])
    expect(offeredVariants(variants, rules(["Black", "White"]), ["PETG", "PPS CF"]).map((item) => item.id)).toEqual(["1", "2", "4"])
    expect(offeredVariants(variants, rules(["White"], { "PPS CF": [] }), ["PPS CF"])).toEqual([])
    expect(offeredVariants([
      ...variants,
      variant("6", "White", "ASA"),
      variant("7", "Red", "ASA"),
    ], rules(["Black", "White", "Red"]), ["ASA"]).map((item) => item.id)).toEqual(["6"])
  })

  it("offers a material in its own colours", () => {
    expect(offeredVariants([
      variant("1", "Red", "PETG"),
      variant("2", "Red", "ASA"),
      variant("3", "White", "ASA"),
    ], rules(["Black"], { ASA: ["Black", "Red"] }), ["PETG", "ASA"]).map((item) => item.id)).toEqual(["2"])
  })

  it("tidies names and titles", () => {
    const [white] = offeredVariants([variant("2", "white", "petg", { option1Name: "Primary colour" })], rules(["White"]), ["PETG"])
    expect(white).toMatchObject({ option1Name: "Colour", option1Value: "White", option2Value: "PETG", title: "White / PETG" })
  })

  it("checks a single variant for the cart", () => {
    expect(variantOffered(variants[3], rules(["Black"]), ["PETG", "PPS CF"])).toBe(true)
    expect(variantOffered(variants[4], rules(["Black", "White"]), ["PETG", "PPS CF"])).toBe(false)
    expect(variantOffered(variants[2], rules(["Black", "White"]), ["PETG"])).toBe(false)
    expect(variantOffered(variant("8", "Red"), rules(["Red"]), ["PETG"])).toBe(true)
  })
})

describe("planVariants", () => {
  it("adds the material to old variants and creates missing colours", () => {
    const plan = planVariants([variant("b", "Black"), variant("w", "White", "", { sku: "BH-W", position: 1 })], rules(["Black", "White", "Red"]), ["PETG"])
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
    ], rules(["Black", "White"]), ["PETG", "PPS CF"], { "PPS CF": 500 })
    expect(plan.updates).toEqual([])
    expect(plan.inserts.map((item) => [item.copiedFrom, item.title, item.priceCents, item.compareAtCents, item.sku])).toEqual([
      ["bs", "Black / PPS CF / Small", 2300, 2900, "BH-PPSCF"],
      ["bl", "Black / PPS CF / Large", 2300, null, "BH-PPSCF"],
    ])
  })

  it("does nothing when everything already exists", () => {
    const plan = planVariants([variant("b", "Black", "PETG"), variant("c", "Black", "PPS CF")], rules(["Black"]), ["PETG", "PPS CF"])
    expect(plan).toEqual({ updates: [], inserts: [] })
  })

  it("creates black and white ASA variants and skips other colours", () => {
    const plan = planVariants([
      variant("b", "Black", "PETG"),
      variant("w", "White", "PETG"),
      variant("r", "Red", "PETG"),
    ], rules(["Black", "White", "Red"]), ["PETG", "ASA"], { ASA: 200 })
    expect(plan.inserts.map((item) => [item.option1Value, item.option2Value, item.priceCents, item.sku])).toEqual([
      ["Black", "ASA", 2000, "BH-ASA"],
      ["White", "ASA", 2000, "BH-WHITE-ASA"],
    ])
  })

  it("creates only black PA6 CF and PET CF variants", () => {
    const plan = planVariants([
      variant("b", "Black", "PETG"),
      variant("w", "White", "PETG"),
    ], rules(["Black", "White"]), ["PETG", "PA6 CF", "PET CF"], { "PA6 CF": 700, "PET CF": 500 })
    expect(plan.inserts.map((item) => [item.option1Value, item.option2Value, item.priceCents, item.sku])).toEqual([
      ["Black", "PA6 CF", 2500, "BH-PA6CF"],
      ["Black", "PET CF", 2300, "BH-PETCF"],
    ])
  })

  it("creates variants for a material's own colours, copied from black PETG", () => {
    const plan = planVariants([variant("b", "Black", "PETG")], rules(["Black"], { "PA6 CF": ["Black", "Red"] }), ["PETG", "PA6 CF"], { "PA6 CF": 700 })
    expect(plan.inserts.map((item) => [item.copiedFrom, item.option1Value, item.option2Value, item.priceCents, item.sku])).toEqual([
      ["b", "Black", "PA6 CF", 2500, "BH-PA6CF"],
      ["b", "Red", "PA6 CF", 2500, "BH-RED-PA6CF"],
    ])
  })
})

describe("shop-wide material settings", () => {
  it("defaults to the original materials on, the new carbon fibres off, and no markup", () => {
    expect(parseMaterialSettings(null)).toEqual([
      { name: "PETG", enabled: true, markupCents: 0, colours: null },
      { name: "ASA", enabled: true, markupCents: 0, colours: ["Black", "White"] },
      { name: "PET CF", enabled: false, markupCents: 0, colours: ["Black"] },
      { name: "PA6 CF", enabled: false, markupCents: 0, colours: ["Black"] },
      { name: "PPS CF", enabled: true, markupCents: 0, colours: ["Black"] },
    ])
    expect(parseMaterialSettings([
      { name: "PETG", markupCents: 300, colours: ["Red"] },
      { name: "pps cf", enabled: false, markupCents: 450 },
      { name: "PA6 CF", enabled: true, markupCents: 600, colours: ["Black", " red ", "black", ""] },
    ])).toEqual([
      { name: "PETG", enabled: true, markupCents: 0, colours: null },
      { name: "ASA", enabled: true, markupCents: 0, colours: ["Black", "White"] },
      { name: "PET CF", enabled: false, markupCents: 0, colours: ["Black"] },
      { name: "PA6 CF", enabled: true, markupCents: 600, colours: ["Black", "red"] },
      { name: "PPS CF", enabled: false, markupCents: 450, colours: ["Black"] },
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
