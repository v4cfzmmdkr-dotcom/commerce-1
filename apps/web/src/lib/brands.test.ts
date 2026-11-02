import { existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { brandLogo, brands, countBrands } from "@/lib/brands"

describe("brandLogo", () => {
  it("points every logo at a file in public", () => {
    const logos = brands.map((brand) => brandLogo(brand.slug)).filter((logo): logo is string => Boolean(logo))
    expect(logos.length).toBeGreaterThan(30)
    for (const logo of logos) expect(existsSync(path.join(process.cwd(), "public", logo))).toBe(true)
  })

  it("returns null for brands without a logo", () => {
    expect(brandLogo("breville")).toBeNull()
  })
})

describe("countBrands", () => {
  it("counts titles that name a brand or one of its product lines", () => {
    const counts = countBrands([
      "Wall Mount Bracket Set Compatible with Packout Storage Boxes",
      "Milwaukee M18 battery holder",
      "Wall mount for PS4 (Playstation 4) Slim",
      "Holder for a Playstation 5 controller",
      "Clippable Toughsystem 2.0 tabletop mount",
    ])
    expect(counts).toEqual([
      { slug: "dewalt", name: "DeWalt", count: 1 },
      { slug: "milwaukee", name: "Milwaukee", count: 2 },
      { slug: "playstation", name: "PlayStation", count: 2 },
    ])
  })

  it("matches whole words only", () => {
    expect(countBrands(["Affordable gear", "Honest clip"])).toEqual([])
  })
})
