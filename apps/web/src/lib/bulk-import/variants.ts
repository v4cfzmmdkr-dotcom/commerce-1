import { defaultMaterial, variantMaterial } from "@/lib/product-options"

type Options = {
  id: string
  option1Name: string
  option1Value: string
  option2Name: string
  option2Value: string
  option3Name: string
  option3Value: string
  position: number
}

const colourNames = new Set(["color", "colour", "primary colour", "primary color"])

function options(variant: Options) {
  return [
    [variant.option1Name, variant.option1Value],
    [variant.option2Name, variant.option2Value],
    [variant.option3Name, variant.option3Value],
  ] as const
}

function isBaseMaterial(variant: Options) {
  const material = variantMaterial(variant)
  return !material || material.toLowerCase() === defaultMaterial.toLowerCase()
}

// A package gives one price, which only fits products whose variants differ by colour and material alone.
// Returns null when other options (such as size) exist, so their prices are left alone.
export function basePriceTargets(variants: Options[]) {
  const groups = new Set(variants.map((variant) => options(variant)
    .filter(([name, value]) => name.trim()
      && !colourNames.has(name.trim().toLowerCase())
      && name.trim().toLowerCase() !== "material"
      && value.trim().toLowerCase() !== "default title")
    .map(([, value]) => value.trim().toLowerCase())
    .join("|")))
  if (groups.size > 1) return null
  return variants.filter(isBaseMaterial).map((variant) => variant.id)
}

export function baseVariant<T extends Options>(variants: T[]) {
  const sorted = [...variants].sort((left, right) => left.position - right.position)
  return sorted.find((variant) => isBaseMaterial(variant)
    && options(variant).some(([name, value]) => colourNames.has(name.trim().toLowerCase()) && value.trim().toLowerCase() === "black"))
    ?? sorted.find(isBaseMaterial)
    ?? sorted[0]
    ?? null
}
