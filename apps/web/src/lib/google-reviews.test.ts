import { describe, expect, it } from "vitest"
import { parseGoogleReviews } from "@/lib/google-reviews"

const placeId = "ChIJT7tcbLSB7GsRBcaVnyRkwOU"

function payload(label: string, rating: number | null, reviews: number | null) {
  const card = [
    null,
    null,
    null,
    [`https://search.google.com/local/reviews?placeid=${placeId}&q=Niche+Parts+Australia`, label],
    null,
    null,
    null,
    rating,
    reviews,
  ]
  return `)]}'\n${JSON.stringify(["Niche Parts Australia", card])}`
}

describe("parseGoogleReviews", () => {
  it("reads the star rating and review count for this business", () => {
    expect(parseGoogleReviews(payload("1 review", 5, 1))).toEqual({ rating: 5, reviews: 1 })
  })

  it("treats a listing with no reviews as empty", () => {
    expect(parseGoogleReviews(payload("No reviews", null, null))).toEqual({ rating: null, reviews: 0 })
  })

  it("ignores a payload for a different place", () => {
    const body = payload("1 review", 5, 1).replace(placeId, "ChIJotherplace")
    expect(parseGoogleReviews(body)).toBeNull()
  })
})
