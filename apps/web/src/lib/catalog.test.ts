import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { listProducts } from "@/lib/catalog"

const products = [
  { id: "a", title: "Bracket", price: 2000 },
  { id: "b", title: "Adapter", price: 900 },
  { id: "c", title: "Clip", price: 1500 },
  { id: "d", title: "Mount", price: 900 },
]

function card(id: string) {
  const product = products.find((row) => row.id === id)!
  return {
    id,
    handle: id,
    title: product.title,
    product_images: [],
    variants: [{ price_cents: product.price, compare_at_cents: null, available: true, inventory_policy: "continue", inventory_qty: 0 }],
  }
}

describe("listProducts through the Supabase API", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    vi.stubEnv("VERCEL", "1")
    fetchMock = vi.fn(async (input: string) => {
      const url = new URL(input)
      const select = url.searchParams.get("select") ?? ""
      if (select.startsWith("id,title,variants")) {
        const rows = products.map((row) => ({ id: row.id, title: row.title, variants: [{ price_cents: row.price }] }))
        return new Response(JSON.stringify(rows), { status: 200 })
      }
      const ids = (url.searchParams.get("id") ?? "").replace(/^in\.\(|\)$/g, "").split(",")
      return new Response(JSON.stringify(ids.reverse().map(card)), { status: 200 })
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("sorts by lowest price, breaking ties by name", async () => {
    const result = await listProducts({ sort: "price-asc" })
    expect(result.items.map((item) => item.title)).toEqual(["Adapter", "Mount", "Clip", "Bracket"])
    expect(result.total).toBe(4)
  })

  it("sorts by highest price", async () => {
    const result = await listProducts({ sort: "price-desc" })
    expect(result.items.map((item) => item.title)).toEqual(["Bracket", "Clip", "Adapter", "Mount"])
  })

  it("applies the price range and pages the results", async () => {
    const result = await listProducts({ sort: "title", minCents: 1000, maxCents: 2000, pageSize: 1, page: 2 })
    expect(result.items.map((item) => item.title)).toEqual(["Clip"])
    expect(result.total).toBe(2)
    expect(result.pageCount).toBe(2)
  })

  it("filters by brand with a whole-word title match", async () => {
    await listProducts({ brand: "milwaukee", sort: "price-asc" })
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get("title")).toBe("imatch.\\m(milwaukee|packout)\\M")
  })

  it("ignores an unknown brand", async () => {
    await listProducts({ brand: "nope", sort: "price-asc" })
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("title")).toBeNull()
  })

  it("never asks the API to order by a variant column", async () => {
    await listProducts({ sort: "price-asc" })
    for (const [input] of fetchMock.mock.calls) {
      expect(new URL(input).searchParams.get("order") ?? "").not.toContain("variants")
    }
  })
})
