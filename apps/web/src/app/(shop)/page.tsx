import { ProductGrid } from "@/components/product-grid"
import { SocialLinks } from "@/components/social-links"
import { groupHomeCollections, listFeaturedProducts, listHomeCollections, type HomeCollection } from "@/lib/catalog"
import { getSettings } from "@/lib/settings"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { alternates: { canonical: "/" } }

function CollectionTile({
  collection,
  wide = false,
}: {
  collection: HomeCollection
  wide?: boolean
}) {
  return (
    <Link
      href={`/collections/${collection.handle}`}
      className={`collection-tile no-underline${wide ? " collection-tile-wide" : ""}`}
    >
      <div className="product-media bg-[var(--muted)]">
        {collection.imageUrl ? (
          <img src={collection.imageUrl} alt={collection.title} />
        ) : (
          <div className="h-full w-full bg-[var(--fg)]" />
        )}
      </div>
      <p className="mt-3 text-sm">{collection.title}</p>
    </Link>
  )
}

export default async function HomePage() {
  const [settings, collections, products] = await Promise.all([
    getSettings(),
    listHomeCollections(),
    listFeaturedProducts(),
  ])
  const collectionGroups = groupHomeCollections(collections)
  return (
    <>
      <section className="hero relative isolate overflow-hidden">
        {settings.bannerUrl && settings.bannerKind === "video" ? (
          <video
            className="hero-video absolute inset-0 h-full w-full object-cover"
            src={settings.bannerUrl}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
        ) : null}
        {settings.bannerUrl && settings.bannerKind === "image" ? (
          <img className="hero-media absolute inset-0 h-full w-full" src={settings.bannerUrl} alt="" />
        ) : null}
        {settings.bannerUrl ? <div className="hero-scrim absolute inset-0" /> : null}
        <div className="wrap-wide relative py-[var(--section)]">
          <p className="hero-kicker">{settings.invoiceName || settings.name}</p>
          <h1 className="hero-title">{settings.tagline}</h1>
          <p className="hero-lede">{settings.announcement}</p>
        </div>
      </section>
      <section className="hero-actions wrap-wide">
        <Link href="/search" className="btn hero-actions-btn">Browse parts</Link>
        <SocialLinks />
      </section>
      {collectionGroups.map((group) => (
        <section key={group.id} className="wrap-wide collection-group">
          <h2 className="collection-group-title">{group.heading}</h2>
          <p className="mt-1 mb-6 max-w-xl text-sm opacity-70">{group.intro}</p>
          <div className={group.layout === "mosaic" ? "collection-mosaic" : "grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4 xl:grid-cols-6"}>
            {group.collections.map((collection, index) => (
              <CollectionTile
                key={collection.handle}
                collection={collection}
                wide={group.layout === "mosaic" && index < 2}
              />
            ))}
          </div>
        </section>
      ))}
      <section className="wrap-wide py-[var(--section)]">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-sm font-semibold">Parts</h2>
          <Link href="/search" className="text-sm">View all</Link>
        </div>
        <ProductGrid products={products} currency={settings.currency} />
      </section>
    </>
  )
}
