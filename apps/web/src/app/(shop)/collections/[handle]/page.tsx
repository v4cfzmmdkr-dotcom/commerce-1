import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CatalogView } from "@/components/catalog-view"
import { brandOptions, getCollection, listProducts } from "@/lib/catalog"
import { formatDescription, summaryText } from "@/lib/html"
import { catalogQuery } from "@/lib/query"
import { getSettings } from "@/lib/settings"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const [collection, settings] = await Promise.all([getCollection(handle), getSettings()])
  if (!collection) return { title: "Collection" }
  const description = summaryText(collection.descriptionHtml) || `Shop ${collection.title} from ${settings.name}, made in Australia and dispatched within 48 hours.`
  const path = `/collections/${collection.handle}`
  const images = collection.imageUrl ? [{ url: collection.imageUrl, alt: collection.title }] : []
  return {
    title: collection.title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: settings.name, locale: "en_AU", url: path, title: collection.title, description, images },
    twitter: { card: images.length ? "summary_large_image" : "summary", title: collection.title, description },
  }
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
  const [result, brands, settings] = await Promise.all([
    listProducts({ ...query, collectionId: collection.id }),
    brandOptions(collection.id),
    getSettings(),
  ])
  return (
    <CatalogView
      title={collection.title}
      descriptionHtml={formatDescription(collection.descriptionHtml)}
      products={result.items}
      total={result.total}
      page={result.page}
      pageCount={result.pageCount}
      brands={brands}
      currency={settings.currency}
      basePath={`/collections/${collection.handle}`}
      query={query.raw}
    />
  )
}
