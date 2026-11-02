import { summaryText } from "@/lib/html"
import { SHIPPING_COUNTRY, shippingRateApplies, type ShippingRate } from "@/lib/shipping"

const maxDescription = 155
// Google shows roughly 60 characters of a title before cutting it off.
const maxTitle = 60
const sellingPoints = "Australian made, dispatched within 48 hours."

// Imported eBay copy often opens with these, which says nothing to a searcher.
const boilerplate = [
  /^(brand )?new( item)?[.!]?$/i,
  /^3d[- ]printed( replacement| mount| part)?[.!]?$/i,
  /contact me|message me|let me know|looking for other/i,
]
// Notes and instructions that read badly out of context in a search result.
const unsuitable = [
  /^(you are|you're) not buying/i,
  /^(you will|please|here|that|the easiest|it is the easiest)\b/i,
  /auction|photo|pictured|visible lines/i,
]
const minOpening = 50

function dollars(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}

function price(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function openingLine(descriptionHtml: string) {
  const sentences = descriptionHtml
    .split(/\n|<br\s*\/?>|<\/(?:p|div|li|h[1-6])>/i)
    .flatMap((block) => summaryText(block, 2000).split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map((sentence) => sentence.trim())
  const first = sentences.find((sentence) => sentence && !boilerplate.some((pattern) => pattern.test(sentence)))
  // A heading such as "How to install:" or "Features:" is not an introduction.
  if (!first || first.endsWith(":") || first.length < minOpening) return ""
  return unsuitable.some((pattern) => pattern.test(first)) ? "" : first[0].toUpperCase() + first.slice(1)
}

export function freeShippingFrom(rates: ShippingRate[]) {
  const free = rates.filter((rate) => rate.active !== false && rate.priceCents === 0)
  if (free.length === 0) return null
  return Math.min(...free.map((rate) => rate.minSubtotalCents ?? 0))
}

export function shippingCentsFor(rates: ShippingRate[], subtotalCents: number) {
  const matches = rates.filter((rate) => shippingRateApplies(rate, subtotalCents, SHIPPING_COUNTRY))
  return matches.length ? Math.min(...matches.map((rate) => rate.priceCents)) : null
}

export function searchDescription(input: {
  title: string
  descriptionHtml: string
  seoDescription: string
  prices: number[]
  freeShippingFromCents: number | null
}) {
  if (input.seoDescription.trim()) return input.seoDescription.trim()
  const low = input.prices.length ? Math.min(...input.prices) : 0
  const high = input.prices.length ? Math.max(...input.prices) : 0
  const free = input.freeShippingFromCents
  const shipping = free == null ? "" : low >= free ? " with free shipping" : `, free shipping over ${dollars(free)}`
  const tail = low > 0 ? `${low === high ? "" : "From "}${price(low)}${shipping}. ${sellingPoints}` : sellingPoints
  let opening = openingLine(input.descriptionHtml) || input.title
  if (!/[.!?…]$/.test(opening)) opening += "."
  return `${summaryText(opening, maxDescription - tail.length - 1)} ${tail}`
}

export function pageTitle(title: string, siteName: string) {
  return `${title} · ${siteName}`.length > maxTitle ? { absolute: title } : title
}
