import { describe, expect, it } from "vitest"
import { paymentLabel } from "@/lib/payment-status"

describe("paymentLabel", () => {
  it("names refunded orders", () => {
    expect(paymentLabel("refunded")).toBe("Refunded")
    expect(paymentLabel("paid")).toBe("Paid")
  })

  it("shows how much of a partly refunded order went back", () => {
    const label = paymentLabel("partially_refunded", { refundedCents: 1000, totalCents: 3000, currency: "aud" })
    expect(label).toMatch(/^Partially refunded \(.*10\.00 of .*30\.00\)$/)
  })
})
