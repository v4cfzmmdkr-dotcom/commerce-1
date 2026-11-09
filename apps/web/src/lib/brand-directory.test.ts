import { describe, expect, it } from "vitest"
import { brandDirectory } from "@/lib/catalog"

describe("brandDirectory", () => {
  it("lists the tool collections first, then every other brand", () => {
    const items = brandDirectory(
      [
        { handle: "ryobi-parts", title: "Ryobi Parts", imageUrl: "/ryobi.jpg" },
        { handle: "dewalt-parts", title: "DeWalt Parts", imageUrl: "/dewalt.jpg" },
        { handle: "coffee-acessories", title: "Coffee Acessories", imageUrl: null },
      ],
      [
        { slug: "dewalt", name: "DeWalt", count: 40 },
        { slug: "xbox", name: "Xbox", count: 4 },
        { slug: "asus", name: "Asus", count: 4 },
        { slug: "breville", name: "Breville", count: 1 },
      ],
    )
    expect(items.map((item) => item.name)).toEqual(["DeWalt Parts", "Ryobi Parts", "Asus", "Xbox", "Breville"])
    expect(items[0]).toMatchObject({ href: "/collections/dewalt-parts", imageUrl: "/dewalt.jpg", count: 40 })
    expect(items[2]).toMatchObject({ href: "/search?brand=asus", count: 4 })
  })
})