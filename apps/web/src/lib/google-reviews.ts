import { cache } from "react"
import { social } from "@/lib/social"

const placeId = "ChIJT7tcbLSB7GsRBcaVnyRkwOU"
const phone = "0450635422"

export function parseGoogleReviews(body: string, id = placeId): { rating: number | null, reviews: number } | null {
  const start = body.indexOf("[")
  if (start < 0 || !body.includes(id)) return null
  let data: unknown
  try {
    data = JSON.parse(body.slice(start))
  } catch {
    return null
  }
  let match: { rating: number | null, reviews: number } | null = null
  const walk = (node: unknown) => {
    if (match || !Array.isArray(node)) return
    for (let index = 0; index < node.length; index += 1) {
      const item = node[index]
      if (Array.isArray(item) && typeof item[0] === "string" && item[0].includes(`placeid=${id}`) && typeof item[1] === "string") {
        const label = item[1]
        if (/^no reviews$/i.test(label)) {
          match = { rating: null, reviews: 0 }
          return
        }
        const reviews = Number.parseInt(label, 10)
        const rating = node[index + 4]
        const counted = node[index + 5]
        if (Number.isInteger(reviews) && reviews >= 0 && typeof rating === "number" && rating >= 1 && rating <= 5 && counted === reviews) {
          match = { rating, reviews }
          return
        }
      }
      walk(item)
    }
  }
  walk(data)
  return match
}

function fallback() {
  return { rating: social.google.rating, reviews: social.google.reviews }
}

export const googleReviews = cache(async () => {
  try {
    const url = `https://www.google.com/search?tbm=map&hl=en-AU&q=${encodeURIComponent("Niche Parts Australia")}&ludocid=16555342338672936453`
    const response = await fetch(url, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "en-AU,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      next: { revalidate: 600 },
    })
    if (!response.ok) return fallback()
    const body = await response.text()
    const digits = body.replace(/\D/g, "")
    if (!digits.includes(phone)) return fallback()
    return parseGoogleReviews(body) ?? fallback()
  } catch {
    return fallback()
  }
})
