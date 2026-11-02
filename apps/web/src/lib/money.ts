export function parseMoneyToCents(value: string): number | null | "invalid" {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return "invalid"
  const [dollars, fraction = ""] = trimmed.split(".")
  return Number(dollars) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2))
}

export function formatMoney(cents: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

export function includedTaxCents(totalCents: number, gstRateBps: number) {
  if (gstRateBps <= 0 || totalCents <= 0) return 0
  return Math.round((totalCents * gstRateBps) / (10000 + gstRateBps))
}

export function exclusiveTaxCents(netCents: number, gstRateBps: number) {
  if (gstRateBps <= 0 || netCents <= 0) return 0
  return Math.round((netCents * gstRateBps) / 10000)
}

export function isPurchasable(variant: {
  available: boolean
  inventoryPolicy: string
  inventoryQty: number
}) {
  // Parts are made to order, so stock counts never block a sale.
  return variant.available
}

export function maxPurchasable(variant: {
  available: boolean
  inventoryPolicy: string
  inventoryQty: number
}) {
  return isPurchasable(variant) ? 99 : 0
}
