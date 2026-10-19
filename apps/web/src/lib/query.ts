import { parseMoneyToCents } from "@/lib/money"

export function catalogQuery(params: Record<string, string | string[] | undefined>) {
  const read = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }
  const min = parseMoneyToCents(read("min") || "")
  const max = parseMoneyToCents(read("max") || "")
  const page = Number(read("page") || "1")
  return {
    q: read("q") || undefined,
    sort: read("sort") || undefined,
    tag: read("tag") || undefined,
    inStock: read("stock") === "1",
    minCents: typeof min === "number" ? min : null,
    maxCents: typeof max === "number" ? max : null,
    page: Number.isFinite(page) ? page : 1,
    raw: {
      q: read("q"),
      sort: read("sort"),
      tag: read("tag"),
      stock: read("stock"),
      min: read("min"),
      max: read("max"),
    },
  }
}
