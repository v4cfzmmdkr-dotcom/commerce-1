export type NavLink = { href: string, label: string }

export type NavIcon = "brands" | "tools" | "home" | "gaming" | "electronics" | "hobby" | "car"

export type NavItem =
  | ({ kind: "link", icon?: NavIcon } & NavLink)
  | { kind: "menu", id: string, label: string, icon?: NavIcon, links: NavLink[] }

type Collection = { handle: string, title: string }

type Group = {
  id: NavIcon
  label: string
  handles: string[]
  hideCollection?: boolean
  extras?: (collection: Collection) => NavLink[]
}

const groups: Group[] = [
  {
    id: "tools",
    label: "Tools",
    handles: ["dewalt-parts", "makita-accessories", "milwaukee", "ryobi-parts", "home-tools", "inserts", "jigs"],
  },
  {
    id: "home",
    label: "Home",
    handles: ["wall-mounts", "adapters", "vacuum-cleaner-parts", "coffee-acessories", "beko-parts", "accessibility"],
  },
  {
    id: "gaming",
    label: "Gaming",
    handles: ["gaming-accessories"],
    hideCollection: true,
    extras: (collection) => [
      { href: `/collections/${collection.handle}?brand=playstation`, label: "PlayStation" },
      { href: `/collections/${collection.handle}?brand=xbox`, label: "Xbox" },
      { href: `/collections/${collection.handle}?brand=nintendo`, label: "Nintendo" },
    ],
  },
  {
    id: "electronics",
    label: "Electronics",
    handles: ["home-networking", "starlink-accessories"],
  },
  {
    id: "hobby",
    label: "Hobby",
    handles: ["lego-accessories", "various-gears", "yamaha"],
  },
  {
    id: "car",
    label: "Car",
    handles: ["car-parts"],
  },
]

export function collectionNavItems(collections: Collection[]): NavItem[] {
  const byHandle = new Map(collections.map((collection) => [collection.handle, collection]))
  const used = new Set<string>()
  const items: NavItem[] = [{ kind: "link", href: "/brands", label: "All Brands", icon: "brands" }]

  for (const group of groups) {
    const links: NavLink[] = []
    for (const handle of group.handles) {
      const collection = byHandle.get(handle)
      if (!collection) continue
      used.add(handle)
      if (!group.hideCollection) links.push({ href: `/collections/${collection.handle}`, label: collection.title })
      if (group.extras) links.push(...group.extras(collection))
    }
    if (links.length === 0) continue
    if (links.length === 1) items.push({ kind: "link", href: links[0].href, label: links[0].label, icon: group.id })
    else items.push({ kind: "menu", id: group.id, label: group.label, icon: group.id, links })
  }

  for (const collection of collections) {
    if (used.has(collection.handle)) continue
    items.push({ kind: "link", href: `/collections/${collection.handle}`, label: collection.title })
  }

  return items
}
