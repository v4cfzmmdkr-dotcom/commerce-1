import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sendOrderAlert, sendRefundEmail, sendShippingEmail } from "@/lib/email"

const order = {
  number: "NP-1001",
  publicToken: "token123",
  email: "customer@example.com",
  shippingAddress: { name: "Sam Lee", line1: "1 Test St", line2: "", city: "Brisbane", state: "QLD", postcode: "4000", country: "AU", phone: "" },
  trackingCarrier: "Australia Post",
  trackingNumber: "33ABC123",
  items: [{ productTitle: "Bit holder", variantTitle: "Black", quantity: 2, unitPriceCents: 900 }],
}

describe("sendShippingEmail", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-key")
    vi.stubEnv("ORDERS_FROM_EMAIL", "orders@example.com")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("emails the customer with the tracking number and carrier link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(sendShippingEmail(order)).resolves.toBe("sent")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.to).toEqual(["customer@example.com"])
    expect(body.subject).toBe("Order NP-1001 is on the way")
    expect(body.html).toContain("33ABC123")
    expect(body.html).toContain("https://auspost.com.au/mypost/track/details/33ABC123")
    expect(body.html).toContain("2 × Bit holder (Black)")
  })

  it("reports when email delivery is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    await expect(sendShippingEmail(order)).resolves.toBe("not_configured")
  })
})

describe("sendOrderAlert", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-key")
    vi.stubEnv("ORDERS_FROM_EMAIL", "orders@example.com")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("emails the owner with the customer, total, and admin link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const paid = {
      id: "order-1",
      number: "NP-1001",
      publicToken: "token123",
      email: "customer@example.com",
      totalCents: 2795,
      currency: "aud",
      shippingName: "Standard",
      shippingAddress: { ...order.shippingAddress, phone: "0400 000 000" },
      items: order.items,
    }
    await expect(sendOrderAlert("owner@example.com", paid)).resolves.toBe("sent")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.to).toEqual(["owner@example.com"])
    expect(body.subject).toContain("New order NP-1001")
    expect(body.html).toContain("customer@example.com")
    expect(body.html).toContain("0400 000 000")
    expect(body.html).toContain("/admin/orders/order-1")
  })
})

describe("sendRefundEmail", () => {
  const refund = {
    number: "NP-1001",
    publicToken: "token123",
    email: "customer@example.com",
    currency: "aud",
    totalCents: 3000,
    amountCents: 1000,
    refundedCents: 1000,
    full: false,
  }

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-key")
    vi.stubEnv("ORDERS_FROM_EMAIL", "orders@example.com")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("tells the customer how much of a partial refund they have received", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(sendRefundEmail(refund)).resolves.toBe("sent")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.to).toEqual(["customer@example.com"])
    expect(body.subject).toBe("Refund for order NP-1001")
    expect(body.html).toContain("$10.00")
    expect(body.html).toContain("Refunded so far: $10.00 of $30.00")
  })

  it("says when the order is fully refunded", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await sendRefundEmail({ ...refund, amountCents: 2000, refundedCents: 3000, full: true })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.html).toContain("$20.00")
    expect(body.html).toContain("fully refunded")
  })
})
