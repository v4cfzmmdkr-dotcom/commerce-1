import { NextResponse } from "next/server"
import { listProducts } from "@/lib/catalog"
import { formatMoney } from "@/lib/money"
import { getSettings } from "@/lib/settings"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? ""
  if (query.length < 2) return NextResponse.json({ results: [], total: 0 })
  const [result, settings] = await Promise.all([
    listProducts({ q: query, pageSize: 6 }),
    getSettings(),
  ])
  return NextResponse.json(
    {
      total: result.total,
      results: result.items.map((item) => ({
        handle: item.handle,
        title: item.title,
        price: formatMoney(item.priceCents, settings.currency),
        imageUrl: item.imageUrl,
        purchasable: item.purchasable,
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  )
}
