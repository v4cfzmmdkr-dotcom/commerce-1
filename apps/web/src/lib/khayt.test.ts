import { afterEach, describe, expect, it, vi } from "vitest"
import { khaytImportUrl, khaytPayload, type KhaytOrder } from "@/lib/khayt"

const order: KhaytOrder = {
  id: "ord_1",
  number: "NP-1042",
  email: "sam@example.com",
  currency: "aud",
  paymentStatus: "paid",
  shippingName: "Sam Lee",
  shippingAddress: { name: "Sam Van Lee", line1: "1 Main St", line2: "", city: "Brisbane", state: "QLD", postcode: "4000", country: "AU", phone: "0400000000" },
  items: [
    {
      id: "item_1",
      productTitle: "Dyson V11 trigger",
      variantTitle: "Black",
      sku: "",
      quantity: 2,
      unitPriceCents: 1312,
      variant: {
        id: "var_1", sku: "", option1Name: "Colour", option1Value: "Black",
        option2Name: "", option2Value: "", option3Name: "", option3Value: "",
      },
    },
    {
      id: "item_2",
      productTitle: "Hose adapter",
      variantTitle: "Default Title",
      sku: "HA-1",
      quantity: 1,
      unitPriceCents: 900,
      variant: null,
    },
  ],
}

describe("khaytPayload", () => {
  it("sends a paid order in the shape Khayt's Medusa importer reads", () => {
    const payload = khaytPayload(order, "https://nicheparts.com.au")
    expect(payload).toMatchObject({
      id: "ord_1",
      display_id: 1042,
      custom_display_id: "NP-1042",
      payment_status: "captured",
      currency_code: "aud",
      metadata: { admin_url: "https://nicheparts.com.au/admin/orders/ord_1" },
      shipping_address: { first_name: "Sam", last_name: "Van Lee", province: "QLD", postal_code: "4000", country_code: "au" },
      customer: { email: "sam@example.com", first_name: "Sam" },
    })
    expect(payload.items[0]).toMatchObject({
      title: "Dyson V11 trigger",
      subtitle: "Black",
      quantity: 2,
      unit_price: 13.12,
      variant: { id: "var_1", options: [{ value: "Black", option: { title: "Colour" } }] },
    })
  })

  it("leaves out placeholder variant names and missing variants", () => {
    const line = khaytPayload(order, "https://nicheparts.com.au").items[1]
    expect(line.subtitle).toBeNull()
    expect(line.variant).toBeUndefined()
  })
})

describe("khaytImportUrl", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("only accepts an https link", () => {
    vi.stubEnv("KHAYT_IMPORT_URL", "https://cloud.khaytapp.com/v1/shops/abc/import/medusa")
    expect(khaytImportUrl()).toBe("https://cloud.khaytapp.com/v1/shops/abc/import/medusa")
    vi.stubEnv("KHAYT_IMPORT_URL", "http://cloud.khaytapp.com/v1/shops/abc/import/medusa")
    expect(khaytImportUrl()).toBeNull()
    vi.stubEnv("KHAYT_IMPORT_URL", "")
    expect(khaytImportUrl()).toBeNull()
  })
})
