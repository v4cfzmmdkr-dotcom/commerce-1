import { describe, expect, it } from "vitest"
import { collectionNavItems } from "@/lib/nav-groups"

const collections = [
  { handle: "adapters", title: "Adapters" },
  { handle: "accessibility", title: "Assistive Parts & Products" },
  { handle: "beko-parts", title: "Beko Parts" },
  { handle: "car-parts", title: "Car Parts" },
  { handle: "coffee-acessories", title: "Coffee Acessories" },
  { handle: "dewalt-parts", title: "DeWalt Parts" },
  { handle: "gaming-accessories", title: "Gaming Accessories" },
  { handle: "various-gears", title: "Gears" },
  { handle: "home-networking", title: "Home Networking" },
  { handle: "home-tools", title: "Home Tools" },
  { handle: "inserts", title: "Inserts" },
  { handle: "jigs", title: "Jigs" },
  { handle: "lego-accessories", title: "Lego Accessories" },
  { handle: "makita-accessories", title: "Makita Parts" },
  { handle: "milwaukee", title: "Milwaukee" },
  { handle: "ryobi-parts", title: "Ryobi Parts" },
  { handle: "starlink-accessories", title: "Starlink Accessories" },
  { handle: "vacuum-cleaner-parts", title: "Vacuum Cleaner Parts" },
  { handle: "wall-mounts", title: "Wall Mounts" },
  { handle: "yamaha", title: "Yamaha Gears" },
  { handle: "future-parts", title: "Future Parts" },
]

describe("collectionNavItems", () => {
  it("groups the shop collections and keeps a single collection as a link", () => {
    const items = collectionNavItems(collections)
    expect(items.map((item) => item.label)).toEqual([
      "All parts",
      "Tools",
      "Home",
      "Gaming",
      "Electronics",
      "Hobby",
      "Car Parts",
      "Future Parts",
    ])
    const tools = items.find((item) => item.kind === "menu" && item.id === "tools")
    expect(tools?.kind === "menu" ? tools.links.map((link) => link.label) : []).toEqual([
      "DeWalt Parts",
      "Makita Parts",
      "Milwaukee",
      "Ryobi Parts",
      "Home Tools",
      "Inserts",
      "Jigs",
    ])
    const gaming = items.find((item) => item.kind === "menu" && item.id === "gaming")
    expect(gaming?.kind === "menu" ? gaming.links.map((link) => link.href) : []).toEqual([
      "/collections/gaming-accessories",
      "/collections/gaming-accessories?brand=playstation",
      "/collections/gaming-accessories?brand=xbox",
      "/collections/gaming-accessories?brand=nintendo",
    ])
    expect(items.find((item) => item.label === "All parts")).toMatchObject({
      kind: "link",
      href: "/brands",
    })
    expect(items.find((item) => item.label === "Car Parts")).toMatchObject({
      kind: "link",
      href: "/collections/car-parts",
    })
  })
})
