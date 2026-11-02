import { describe, expect, it } from "vitest"
import { countBrands } from "@/lib/brands"

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
