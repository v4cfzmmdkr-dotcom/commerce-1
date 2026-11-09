import { loadMerchantFeed } from "@/lib/merchant-feed"

export const dynamic = "force-dynamic"

export async function GET() {
  const feed = await loadMerchantFeed()
  if (!feed) {
    return new Response("Product feed is unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    })
  }
  return new Response(feed, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
