import { colourSlot, type ColourVariant } from "@/lib/product-colours"

export type ColourOption = { name: string, hex: string, enabled: boolean }

export const presetColours: Array<{ name: string, hex: string }> = [
  { name: "Black", hex: "#1d1d1f" },
  { name: "White", hex: "#f5f5f7" },
  { name: "Orange", hex: "#ff671f" },
  { name: "Red", hex: "#d6001c" },
  { name: "Green", hex: "#009639" },
  { name: "Navy Blue", hex: "#0086d6" },
  { name: "Pine Green", hex: "#034638" },
  { name: "Dark Brown", hex: "#4f2c1d" },
  { name: "Lemon Yellow", hex: "#f7d959" },
  { name: "Lime", hex: "#c0df16" },
  { name: "Reflex Blue", hex: "#001489" },
]

export const defaultColours = ["Black", "White"]

export const materialOptions = [
  { name: "PETG", note: "Tough, everyday plastic", defaultColours: null, onByDefault: true },
  { name: "ASA", note: "UV stable outdoor plastic.", defaultColours: ["Black", "White"], onByDefault: true },
  { name: "PET CF", note: "Carbon fibre reinforced PET, stiff and dimensionally stable.", defaultColours: ["Black"], onByDefault: false },
  { name: "PA6 CF", note: "Carbon fibre reinforced nylon, strong and heat resistant.", defaultColours: ["Black"], onByDefault: false },
  { name: "PPS CF", note: "Carbon fibre reinforced, heat resistant.", defaultColours: ["Black"], onByDefault: true },
] as const satisfies ReadonlyArray<{ name: string, note: string, defaultColours: readonly string[] | null, onByDefault: boolean }>

export const defaultMaterial = "PETG"

type Slot = 1 | 2 | 3
type Options = Pick<ColourVariant, "option1Name" | "option1Value" | "option2Name" | "option2Value" | "option3Name" | "option3Value">

const HEX = /^#[0-9a-f]{6}$/i

export function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 30)
}

function same(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function fromJson(value: unknown) {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

export function parseColours(value: unknown): ColourOption[] {
  const parsed = fromJson(value)
  const saved = Array.isArray(parsed) ? parsed : []
  const colours: ColourOption[] = []
  for (const item of saved) {
    if (!item || typeof item !== "object") continue
    const name = cleanName(String((item as { name?: unknown }).name ?? ""))
    const hex = String((item as { hex?: unknown }).hex ?? "")
    if (!name || !HEX.test(hex) || colours.some((colour) => same(colour.name, name))) continue
    colours.push({ name, hex: hex.toLowerCase(), enabled: (item as { enabled?: unknown }).enabled !== false })
  }
  if (colours.length) return colours
  return presetColours.map((preset) => ({ ...preset, enabled: defaultColours.includes(preset.name) }))
}

export function enabledColourNames(colours: ColourOption[]) {
  return colours.filter((colour) => colour.enabled).map((colour) => colour.name)
}

export function parseMaterials(value: unknown) {
  const list = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.replace(/^\{|\}$/g, "").split(",") : []
  const known = materialOptions.map((material) => material.name).filter((name) =>
    list.some((item) => same(item.replace(/^"|"$/g, ""), name)),
  )
  return known.length ? known : [defaultMaterial]
}

export type MaterialSetting = { name: string, enabled: boolean, markupCents: number, colours: string[] | null }

function savedColourList(value: unknown, fallback: readonly string[] | null) {
  if (!fallback) return null
  if (!Array.isArray(value)) return [...fallback]
  const names: string[] = []
  for (const item of value) {
    const name = cleanName(String(item ?? ""))
    if (name && !names.some((existing) => same(existing, name))) names.push(name)
  }
  return names
}

export function parseMaterialSettings(value: unknown): MaterialSetting[] {
  const parsed = fromJson(value)
  const saved = (Array.isArray(parsed) ? parsed : []) as Array<{ name?: unknown, enabled?: unknown, markupCents?: unknown, colours?: unknown } | null>
  return materialOptions.map((material) => {
    const item = saved.find((entry) => entry && typeof entry === "object" && same(String(entry.name ?? ""), material.name))
    const markup = Number(item?.markupCents)
    return {
      name: material.name,
      enabled: item ? item.enabled !== false : material.onByDefault,
      markupCents: material.name !== defaultMaterial && Number.isInteger(markup) && markup > 0 ? markup : 0,
      colours: savedColourList(item?.colours, material.defaultColours),
    }
  })
}

export type ColourRules = Record<string, string[]>

export function materialColourRules(palette: ColourOption[], settings: MaterialSetting[]): ColourRules {
  const shop = enabledColourNames(palette)
  return Object.fromEntries(materialOptions.map((material) => {
    const chosen = settings.find((setting) => same(setting.name, material.name))?.colours
      ?? (material.defaultColours ? [...material.defaultColours] : null)
    const colours = chosen
      ? palette.filter((colour) => chosen.some((name) => same(name, colour.name))).map((colour) => colour.name)
      : shop
    return [material.name, colours]
  }))
}

export function shopMaterials(productMaterials: unknown, settings: MaterialSetting[]) {
  const enabled = settings.filter((setting) => setting.enabled).map((setting) => setting.name)
  return parseMaterials(productMaterials).filter((name) => enabled.includes(name))
}

export function materialMarkups(settings: MaterialSetting[]) {
  return Object.fromEntries(settings.filter((setting) => setting.name !== defaultMaterial).map((setting) => [setting.name, setting.markupCents]))
}

export function materialColours(material: string, rules: ColourRules) {
  const option = materialOptions.find((item) => same(item.name, material))
  return option ? rules[option.name] ?? [] : []
}

export function materialColourLabel(colours: readonly string[] | null) {
  if (!colours) return "Every colour"
  if (!colours.length) return "No colours"
  if (colours.length === 1) return `${colours[0]} only`
  if (colours.length === 2) return `${colours[0]} or ${colours[1]}`
  return `${colours.join(", ")} only`
}

function nameOf(variant: Options, slot: Slot) {
  return slot === 1 ? variant.option1Name : slot === 2 ? variant.option2Name : variant.option3Name
}

function valueOf(variant: Options, slot: Slot) {
  return slot === 1 ? variant.option1Value : slot === 2 ? variant.option2Value : variant.option3Value
}

function isColourName(name: string) {
  return ["color", "colour", "primary colour", "primary color"].includes(name.trim().toLowerCase())
}

function namedSlot(variant: Options, test: (name: string) => boolean) {
  for (const slot of [1, 2, 3] as const) {
    if (test(nameOf(variant, slot))) return slot
  }
  return 0 as const
}

export function materialSlot(variants: Options[]) {
  for (const variant of variants) {
    const slot = namedSlot(variant, (name) => same(name, "material"))
    if (slot) return slot
  }
  const colour = colourSlot(variants)
  for (const slot of [2, 3] as const) {
    if (slot !== colour && variants.every((variant) => !nameOf(variant, slot).trim())) return slot
  }
  return 0 as const
}

function rebuildTitle<T extends Options & { title?: string }>(variant: T) {
  variant.title = [variant.option1Value, variant.option2Value, variant.option3Value]
    .filter((value) => value && value.toLowerCase() !== "default title")
    .join(" / ")
  return variant
}

function setOption<T extends Options>(variant: T, slot: Slot, name: string, value: string) {
  if (slot === 1) {
    variant.option1Name = name
    variant.option1Value = value
  } else if (slot === 2) {
    variant.option2Name = name
    variant.option2Value = value
  } else {
    variant.option3Name = name
    variant.option3Value = value
  }
}

export function withDefaultMaterial<T extends Options>(variants: T[]) {
  const slot = materialSlot(variants)
  if (!slot) return variants
  return variants.map((variant) => {
    if (nameOf(variant, slot).trim()) return variant
    const next = { ...variant }
    setOption(next, slot, "Material", defaultMaterial)
    return next
  })
}

export function variantMaterial(variant: Options) {
  const slot = namedSlot(variant, (name) => same(name, "material"))
  return slot ? valueOf(variant, slot) : ""
}

function coloursFor(variant: Options, rules: ColourRules) {
  const materialAt = namedSlot(variant, (name) => same(name, "material"))
  return materialColours(materialAt ? valueOf(variant, materialAt) : defaultMaterial, rules)
}

export function variantOffered(variant: Options, rules: ColourRules, materials: string[]) {
  const materialAt = namedSlot(variant, (name) => same(name, "material"))
  if (materialAt && !materials.some((name) => same(name, valueOf(variant, materialAt)))) return false
  const colourAt = namedSlot(variant, isColourName)
  return !colourAt || coloursFor(variant, rules).some((name) => same(name, valueOf(variant, colourAt)))
}

export function offeredVariants<T extends Options & { title?: string }>(variants: T[], rules: ColourRules, materials: string[]) {
  return variants.filter((variant) => variantOffered(variant, rules, materials)).map((variant) => {
    const next = { ...variant }
    const colourAt = namedSlot(next, isColourName)
    if (colourAt) {
      const colour = coloursFor(next, rules).find((name) => same(name, valueOf(next, colourAt)))!
      setOption(next, colourAt, "Colour", colour)
    }
    const materialAt = namedSlot(next, (name) => same(name, "material"))
    if (materialAt) {
      const material = materialOptions.find((option) => same(option.name, valueOf(next, materialAt)))!
      setOption(next, materialAt, "Material", material.name)
    }
    return rebuildTitle(next)
  })
}

export type PlanVariant = Options & {
  id: string
  title: string
  sku: string
  priceCents: number
  compareAtCents: number | null
  position: number
}

export type NewVariant<T extends PlanVariant> = Omit<T, "id"> & { copiedFrom: string }

function skuCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 6)
}

export function planVariants<T extends PlanVariant>(
  variants: T[],
  rules: ColourRules,
  materials: string[],
  extraCents: Record<string, number> = {},
) {
  const updates: T[] = []
  const inserts: Array<NewVariant<T>> = []
  if (!variants.length) return { updates, inserts }
  const colourAt = colourSlot(variants)
  const materialAt = materialSlot(variants)
  const working = variants.map((variant) => {
    if (!materialAt || nameOf(variant, materialAt).trim()) return variant
    const next = { ...variant }
    setOption(next, materialAt, "Material", defaultMaterial)
    updates.push(rebuildTitle(next))
    return next
  })
  if (!colourAt) return { updates, inserts }
  const groups = new Map<string, T[]>()
  for (const variant of working) {
    const key = ([1, 2, 3] as const)
      .filter((slot) => slot !== colourAt && slot !== materialAt)
      .map((slot) => valueOf(variant, slot).trim().toLowerCase())
      .join("|")
    groups.set(key, [...(groups.get(key) ?? []), variant])
  }
  let position = Math.max(...variants.map((variant) => variant.position)) + 1
  const wanted = materialAt ? materials : [""]
  for (const group of groups.values()) {
    const colourName = nameOf(group[0], colourAt).trim() || "Colour"
    const isPetg = (variant: T) => !materialAt || same(valueOf(variant, materialAt), defaultMaterial)
    const base = group.find((variant) => same(valueOf(variant, colourAt), "Black") && isPetg(variant))
      ?? group.find(isPetg)
      ?? group[0]
    const baseSku = base.sku.trim().replace(/-(W|BLK|B)$/i, "")
    for (const material of wanted) {
      for (const colour of materialColours(material || defaultMaterial, rules)) {
        const exists = group.some((variant) => same(valueOf(variant, colourAt), colour)
          && (!materialAt || same(valueOf(variant, materialAt), material)))
        if (exists) continue
        const extra = extraCents[material] ?? 0
        const { id, ...rest } = base
        const next = { ...rest, copiedFrom: id } as NewVariant<T>
        setOption(next, colourAt, colourName, colour)
        if (materialAt) setOption(next, materialAt, "Material", material)
        next.priceCents = base.priceCents + extra
        next.compareAtCents = base.compareAtCents === null ? null : base.compareAtCents + extra
        next.sku = baseSku
          ? [baseSku, colour === "Black" ? "" : skuCode(colour), material && material !== defaultMaterial ? skuCode(material) : ""].filter(Boolean).join("-")
          : ""
        next.position = position++
        inserts.push(rebuildTitle(next))
      }
    }
  }
  return { updates, inserts }
}

export function planReprice<T extends PlanVariant>(variants: T[], markups: Record<string, number>) {
  const materialAt = variants.map((variant) => namedSlot(variant, (name) => same(name, "material"))).find(Boolean)
  if (!materialAt) return []
  const key = (variant: T) => ([1, 2, 3] as const)
    .filter((slot) => slot !== materialAt)
    .map((slot) => valueOf(variant, slot).trim().toLowerCase())
    .join("|")
  const bases = new Map<string, T>()
  for (const variant of variants) {
    if (same(valueOf(variant, materialAt), defaultMaterial) && !bases.has(key(variant))) bases.set(key(variant), variant)
  }
  const updates: Array<{ id: string, priceCents: number, compareAtCents: number | null }> = []
  for (const variant of variants) {
    const material = materialOptions.find((option) => same(option.name, valueOf(variant, materialAt)))
    if (!material || material.name === defaultMaterial) continue
    const base = bases.get(key(variant))
    if (!base) continue
    const markup = markups[material.name] ?? 0
    const priceCents = base.priceCents + markup
    const compareAtCents = base.compareAtCents === null ? null : base.compareAtCents + markup
    if (priceCents !== variant.priceCents || compareAtCents !== variant.compareAtCents) {
      updates.push({ id: variant.id, priceCents, compareAtCents })
    }
  }
  return updates
}
