import { describe, expect, it } from "vitest"
import {
  FREE_SHIPPING_MIN_CENTS,
  STANDARD_SHIPPING_CENTS,
  STANDARD_SHIPPING_MAX_CENTS,
  selectShippingRate,
  type ShippingRate,
} from "@/lib/shipping"

const standard: ShippingRate = {
  id: "standard",
  name: "Standard shipping",
  priceCents: STANDARD_SHIPPING_CENTS,
  countries: "AU",
  minSubtotalCents: null,
  maxSubtotalCents: STANDARD_SHIPPING_MAX_CENTS,
  active: true,
}

const free: ShippingRate = {
  id: "free",
  name: "Free shipping",
  priceCents: 0,
  countries: "AU",
  minSubtotalCents: FREE_SHIPPING_MIN_CENTS,
  maxSubtotalCents: null,
  active: true,
}

const rates = [standard, free]

describe("selectShippingRate", () => {
  it("charges $9.95 under $25 and free shipping at $25 and above", () => {
    expect(selectShippingRate(rates, 2499, "AU", "standard").rate).toMatchObject({
      id: "standard",
      priceCents: 995,
    })
    expect(selectShippingRate(rates, FREE_SHIPPING_MIN_CENTS, "AU", "free").rate).toMatchObject({
      id: "free",
      priceCents: 0,
    })
    expect(selectShippingRate(rates, 10_000, "au", "free").rate?.id).toBe("free")
  })

  it("does not honour a free rate posted for an order under $25", () => {
    const chosen = selectShippingRate(rates, 2499, "AU", "free")
    expect(chosen.reason).toBe("selected")
    expect(chosen.rate?.id).toBe("standard")
    expect(chosen.rate?.priceCents).toBe(995)
  })

  it("uses the free rate at $25 even if the paid rate was posted", () => {
    const chosen = selectShippingRate(rates, 2500, "AU", "standard")
    expect(chosen.rate?.id).toBe("free")
    expect(chosen.rate?.priceCents).toBe(0)
  })

  it("refuses a country the rate does not cover", () => {
    expect(selectShippingRate(rates, 3000, "NZ", "free")).toEqual({ rate: null, reason: "none" })
  })

  it("asks for a choice when more than one rate matches and the posted id does not", () => {
    const pickup: ShippingRate = {
      id: "pickup",
      name: "Local pickup",
      priceCents: 0,
      countries: "AU",
      minSubtotalCents: null,
      maxSubtotalCents: null,
      active: true,
    }
    const open = { ...standard, maxSubtotalCents: null }
    expect(selectShippingRate([open, pickup], 1000, "AU", "missing")).toEqual({
      rate: null,
      reason: "choose",
    })
    expect(selectShippingRate([open, pickup], 1000, "AU", "pickup").rate?.id).toBe("pickup")
  })

  it("ignores an inactive rate even when that id was posted", () => {
    const open = { ...standard, maxSubtotalCents: null }
    const chosen = selectShippingRate([{ ...free, active: false }, open], 3000, "AU", "free")
    expect(chosen.rate?.id).toBe("standard")
    expect(chosen.rate?.priceCents).toBe(995)
  })
})
