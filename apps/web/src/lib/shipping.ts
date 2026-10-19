// Free shipping applies when the merchandise subtotal is $25.00 or more
// (2500 cents). The paid rate stops at 2499 cents, so $25.00 itself is free.

export const STANDARD_SHIPPING_CENTS = 995
export const FREE_SHIPPING_MIN_CENTS = 2500
export const STANDARD_SHIPPING_MAX_CENTS = FREE_SHIPPING_MIN_CENTS - 1
export const SHIPPING_OFFER_NOTE = "$9.95 standard, free when the order is $25 or more."

export type ShippingRate = {
  id: string
  name: string
  priceCents: number
  countries: string
  minSubtotalCents: number | null
  maxSubtotalCents: number | null
  active?: boolean
}

export type ShippingSelection<T> = {
  rate: T | null
  reason: "selected" | "none" | "choose"
}

export function nullableCents(value: number | string | null | undefined) {
  if (value == null || value === "") return null
  const cents = Number(value)
  return Number.isFinite(cents) ? cents : null
}

export function shippingRateApplies(
  rate: Pick<ShippingRate, "countries" | "minSubtotalCents" | "maxSubtotalCents" | "active">,
  subtotalCents: number,
  country: string,
) {
  if (rate.active === false) return false
  const countries = rate.countries.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean)
  if (countries.length > 0 && !countries.includes(country.trim().toUpperCase())) return false
  if (rate.minSubtotalCents != null && subtotalCents < rate.minSubtotalCents) return false
  if (rate.maxSubtotalCents != null && subtotalCents > rate.maxSubtotalCents) return false
  return true
}

export function selectShippingRate<T extends ShippingRate>(
  rates: T[],
  subtotalCents: number,
  country: string,
  requestedId: string,
): ShippingSelection<T> {
  const matches = rates.filter((rate) => shippingRateApplies(rate, subtotalCents, country))
  if (matches.length === 0) return { rate: null, reason: "none" }
  const requested = matches.find((rate) => rate.id === requestedId)
  if (requested) return { rate: requested, reason: "selected" }
  if (matches.length === 1) return { rate: matches[0], reason: "selected" }
  return { rate: null, reason: "choose" }
}
