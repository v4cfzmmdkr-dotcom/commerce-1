import { describe, expect, it } from "vitest"
import { buildModel, categorise, tokens, type CollectionProfile } from "@/lib/bulk-import/categorise"

const product = (title: string, tags: string[] = []) => ({ title, tags, productType: "" })

const profiles: CollectionProfile[] = [
  {
    id: "dewalt",
    handle: "dewalt-parts",
    title: "DeWalt Parts",
    products: [
      product("Wall mount for Dewalt Toughsystem"),
      product("Dewalt tstak foot adapter"),
      product("Dewalt battery holder", ["dewalt", "battery"]),
      product("Dewalt rail limit stops"),
    ],
  },
  {
    id: "milwaukee",
    handle: "milwaukee",
    title: "Milwaukee",
    products: [
      product("Milwaukee packout rail mount"),
      product("Milwaukee M18 battery holder"),
      product("Milwaukee guide rail stops"),
    ],
  },
  {
    id: "gears",
    handle: "various-gears",
    title: "Gears",
    products: [product("Bosch ixo gears 3 pieces"), product("Shredder gear for Fellowes"), product("Mixer drive gear")],
  },
  {
    id: "yamaha",
    handle: "yamaha",
    title: "Yamaha Gears",
    products: [
      product("Yamaha tt600 speedometer gear"),
      product("Yamaha xt500 speedometer gear"),
      product("Yamaha it175 speedometer drive gear"),
    ],
  },
  {
    id: "wall",
    handle: "wall-mounts",
    title: "Wall Mounts",
    products: [product("Skateboard wall mount"), product("Headset wall mount"), product("Router wall bracket")],
  },
]

const model = buildModel(profiles)

describe("tokens", () => {
  it("lowercases, strips accents and filler words, and folds plurals", () => {
    expect(tokens("Holder for IKEA Skådis – 3 Bottles, 3D printed in PETG")).toEqual(["holder", "ikea", "skadi", "bottle"])
  })
})

describe("categorise", () => {
  it("uses the package category when it names a collection", () => {
    expect(categorise(model, { title: "Anything", category: "wall mounts" })).toEqual({
      method: "category",
      collections: [{ id: "wall", title: "Wall Mounts", score: 1 }],
    })
  })

  it("files a product by brand when the category is not a collection", () => {
    const result = categorise(model, { title: "Milwaukee battery wall holder", category: "Tool Storage" })
    expect(result.method).toBe("auto")
    expect(result.collections[0].id).toBe("milwaukee")
  })

  it("keeps brand collections for products that name the brand", () => {
    const result = categorise(model, { title: "Ducati 750 speedometer gear" })
    expect(result.collections.map((collection) => collection.id)).not.toContain("yamaha")
    expect(result.collections[0].id).toBe("gears")
    expect(categorise(model, { title: "Yamaha xj650 speedometer gear" }).collections[0].id).toBe("yamaha")
  })

  it("can file a product in two collections when both fit", () => {
    const result = categorise(model, { title: "Dewalt planer drive gear", tags: ["gear"] })
    expect(result.collections.map((collection) => collection.id).sort()).toEqual(["dewalt", "gears"])
  })

  it("leaves unrelated products uncategorised", () => {
    expect(categorise(model, { title: "Knitted tea cosy" })).toEqual({ method: "none", collections: [] })
  })
})
