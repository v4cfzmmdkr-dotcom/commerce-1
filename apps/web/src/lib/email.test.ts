import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sendOrderAlert, sendOrderEmail, sendRefundEmail, sendShippingEmail } from "@/lib/email"

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
    expect(body.html).toContain("Bit holder")
    expect(body.html).toContain("Qty 2")
    expect(body.text).toContain("2 × Bit holder (Black)")
    expect(body.text).toContain("Tracking number: 33ABC123")
  })

  it("reports when email delivery is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    await expect(sendShippingEmail(order)).resolves.toBe("not_configured")
  })
})

describe("sendOrderEmail", () => {
  const receipt = {
    number: "NP-1001",
    publicToken: "token123",
    email: "customer@example.com",
    totalCents: 2795,
    currency: "aud",
    shippingName: "Standard",
    shippingAddress: order.shippingAddress,
    items: order.items,
    shippingCents: 995,
    taxCents: 254,
    paidAt: "2026-11-03T00:00:00Z",
    sellerName: "Niche Parts Australia",
    abn: "12 345 678 901",
  }

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "test-key")
    vi.stubEnv("ORDERS_FROM_EMAIL", "orders@example.com")
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("sends a branded receipt with support contacts and social links", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(sendOrderEmail(receipt)).resolves.toBe("sent")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.subject).toBe("Order NP-1001 confirmed")
    expect(body.reply_to).toBe("contact@nicheparts.com.au")
    expect(body.html).toContain("https://shop.example.com/brand/logo.png")
    expect(body.html).toContain("https://shop.example.com/brand/email/banner.jpg")
    expect(body.html).toContain("mailto:contact@nicheparts.com.au")
    expect(body.html).toContain("tel:+61450635422")
    expect(body.html).toContain("0450 635 422")
    expect(body.html).toContain("https://www.facebook.com/")
    expect(body.html).toContain("https://www.instagram.com/nicheparts.com.au/")
    expect(body.html).toContain("Hi Sam,")
    expect(body.html).toContain("ABN")
    expect(body.html).toContain("$27.95")
    expect(body.text).toContain("Total  $27.95")
    expect(body.text).toContain("Australia")
  })

  it("shows item photos and free shipping", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await sendOrderEmail({
      ...receipt,
      shippingCents: 0,
      items: [{ ...order.items[0], imageUrl: "/media/bit-holder.webp" }],
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.html).toContain("https://shop.example.com/media/bit-holder.webp")
    expect(body.html).toContain("Free")
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
