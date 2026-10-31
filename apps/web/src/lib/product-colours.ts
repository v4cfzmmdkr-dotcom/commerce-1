export type ColourVariant = {
  option1Name: string
  option1Value: string
  option2Name: string
  option2Value: string
  option3Name: string
  option3Value: string
  title?: string
  sku?: string
}

const COLOUR_NAMES = new Set(["color", "colour", "primary colour", "primary color"])

function isColourName(name: string) {
  return COLOUR_NAMES.has(name.trim().toLowerCase())
}

function isPlaceholder(name: string, value: string) {
  const optionName = name.trim().toLowerCase()
  const optionValue = value.trim().toLowerCase()
  return !optionName || optionName === "title" || !optionValue || optionValue === "default title"
}

export function namedColour(value: string) {
  const colour = value.trim().toLowerCase()
  if (colour === "black") return "Black"
  if (colour === "white") return "White"
  return null
}

export function colourSlot(variants: Array<Pick<ColourVariant, "option1Name" | "option2Name" | "option3Name">>) {
  for (const variant of variants) {
    if (isColourName(variant.option1Name)) return 1 as const
    if (isColourName(variant.option2Name)) return 2 as const
    if (isColourName(variant.option3Name)) return 3 as const
  }
  if (!variants.length) return 0 as const
  const first = variants[0]
  if (isPlaceholder(first.option1Name, first.option1Value)) return 1 as const
  if (!first.option2Name.trim()) return 2 as const
  if (!first.option3Name.trim()) return 3 as const
  return 0 as const
}

function colourOf(variant: ColourVariant, slot: 1 | 2 | 3) {
  const value = slot === 1 ? variant.option1Value : slot === 2 ? variant.option2Value : variant.option3Value
  return namedColour(value)
}

function withColour<T extends ColourVariant>(
  variant: T,
  slot: 1 | 2 | 3,
  colour: "Black" | "White",
  rewriteSku = false,
): T {
  const next = { ...variant }
  if (slot === 1) {
    next.option1Name = "Colour"
    next.option1Value = colour
  } else if (slot === 2) {
    next.option2Name = "Colour"
    next.option2Value = colour
  } else {
    next.option3Name = "Colour"
    next.option3Value = colour
  }
  const parts = [next.option1Value, next.option2Value, next.option3Value].filter(
    (value) => value && value.toLowerCase() !== "default title",
  )
  next.title = parts.join(" / ")
  if (rewriteSku && colour === "White" && next.sku?.trim() && !/-W$/i.test(next.sku)) {
    next.sku = `${next.sku.trim()}-W`
  }
  return next
}

function optionKey(variant: ColourVariant, slot: 1 | 2 | 3) {
  const values = [variant.option1Value, variant.option2Value, variant.option3Value]
  values[slot - 1] = ""
  return values.map((value) => value.trim().toLowerCase()).join("|")
}

export function keepBlackWhiteColours<T extends ColourVariant>(variants: T[]) {
  const slot = colourSlot(variants)
  if (!slot) return variants
  const kept = variants.filter((variant) => {
    const colour = colourOf(variant, slot)
    return colour === "Black" || colour === "White"
  })
  return kept.length ? kept.map((variant) => withColour(variant, slot, colourOf(variant, slot)!)) : variants
}

export function limitVariantsToBlackWhite<T extends ColourVariant>(variants: T[]) {
  if (!variants.length) return variants
  const slot = colourSlot(variants)
  if (!slot) return variants
  const groups = new Map<string, T>()
  for (const variant of variants) {
    const key = optionKey(variant, slot)
    const colour = colourOf(variant, slot)
    const preferred = colour === "Black" || colour === "White" || !groups.has(key)
    if (preferred) groups.set(key, variant)
  }
  const limited: T[] = []
  for (const variant of groups.values()) {
    limited.push(withColour(variant, slot, "Black"))
    limited.push(withColour(variant, slot, "White", namedColour(
      slot === 1 ? variant.option1Value : slot === 2 ? variant.option2Value : variant.option3Value,
    ) !== "White"))
  }
  return limited
}
