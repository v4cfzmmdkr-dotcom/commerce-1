import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sendShippingEmail } from "@/lib/email"

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
