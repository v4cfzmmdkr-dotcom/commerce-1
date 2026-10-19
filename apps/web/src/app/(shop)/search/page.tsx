import type { Metadata } from "next"
import { CatalogView } from "@/components/catalog-view"
import { listProducts, popularTags } from "@/lib/catalog"
import { catalogQuery } from "@/lib/query"
import { getSettings } from "@/lib/settings"

export const metadata: Metadata = { title: "Shop" }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = catalogQuery(await searchParams)
  const [result, tags, settings] = await Promise.all([
    listProducts(params),
    popularTags(),
    getSettings(),
  ])
  return (
    <CatalogView
      title={params.q ? `Search: ${params.q}` : "All parts"}
      products={result.items}
      total={result.total}
      page={result.page}
      pageCount={result.pageCount}
      tags={tags}
      currency={settings.currency}
      basePath="/search"
      query={params.raw}
    />
  )
}
