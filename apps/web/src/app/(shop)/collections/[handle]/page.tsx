import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CatalogView } from "@/components/catalog-view"
import { getCollection, listProducts, popularTags } from "@/lib/catalog"
import { cleanHtml } from "@/lib/html"
import { catalogQuery } from "@/lib/query"
import { getSettings } from "@/lib/settings"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const collection = await getCollection(handle)
  if (!collection) return { title: "Collection" }
  return { title: collection.title, description: collection.title }
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { handle } = await params
  const collection = await getCollection(handle)
  if (!collection) notFound()
  const query = catalogQuery(await searchParams)
  const [result, tags, settings] = await Promise.all([
    listProducts({ ...query, collectionId: collection.id }),
    popularTags(collection.id),
    getSettings(),
  ])
  return (
    <CatalogView
      title={collection.title}
      descriptionHtml={cleanHtml(collection.descriptionHtml)}
      products={result.items}
      total={result.total}
      page={result.page}
      pageCount={result.pageCount}
      tags={tags}
      currency={settings.currency}
      basePath={`/collections/${collection.handle}`}
      query={query.raw}
    />
  )
}
