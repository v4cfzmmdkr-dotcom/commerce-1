import { BrandCarousel } from "@/components/brand-carousel"
import { ProductGrid } from "@/components/product-grid"
import { SocialLinks } from "@/components/social-links"
import { brandLogo, type BrandCount } from "@/lib/brands"
import { brandOptions, groupHomeCollections, listFeaturedProducts, listHomeCollections, type HomeCollection } from "@/lib/catalog"
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
      <p className="mt-3 text-sm font-bold">{collection.title}</p>
    </Link>
  )
}

function BrandTile({ brand }: { brand: BrandCount }) {
  const logo = brandLogo(brand.slug)
  return (
    <Link href={`/search?brand=${brand.slug}`} className="collection-tile no-underline">
      <div className="product-media brand-tile-media">
        {logo ? (
          <img src={logo} alt={`${brand.name} logo`} loading="lazy" decoding="async" />
        ) : (
          <span className="brand-tile-wordmark">{brand.name}</span>
        )}
      </div>
      <p className="mt-3 text-sm font-bold">{brand.name}</p>
      <p className="text-xs opacity-60">{brand.count} {brand.count === 1 ? "part" : "parts"}</p>
    </Link>
  )
}

export default async function HomePage() {
  const [settings, collections, products, brandCounts] = await Promise.all([
    getSettings(),
    listHomeCollections(),
    listFeaturedProducts(),
    brandOptions(),
  ])
  const collectionGroups = groupHomeCollections(collections, brandCounts)
  return (
    <>
      <section className="hero relative isolate overflow-x-clip">
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
          <img
            className={settings.bannerUrl.endsWith(".svg") ? "hero-media hero-drawing" : "hero-media absolute inset-0 h-full w-full"}
            src={settings.bannerUrl}
            alt=""
          />
        ) : null}
        {settings.bannerUrl ? <div className="hero-scrim absolute inset-0" /> : null}
        <div className="wrap-wide relative py-[var(--section)]">
          <h1 className="hero-kicker">{settings.invoiceName || settings.name}</h1>
          <p className="hero-title">{heroLine(settings.tagline, settings.announcement)}</p>
        </div>
      </section>
      <section className="hero-actions wrap-wide">
        <SocialLinks />
      </section>
      {collectionGroups.map((group) => (
        <section key={group.id} className="wrap-wide collection-group">
          <div className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="collection-group-title">{group.heading}</h2>
              {group.id === "brands" ? <Link href="/brands" className="view-all glass no-underline">View all</Link> : null}
            </div>
            <p className="mt-1 max-w-xl text-sm opacity-70">{group.intro}</p>
          </div>
          {group.layout === "brands" ? (
            <BrandCarousel label={group.heading}>
              {group.collections.map((collection) => (
                <CollectionTile key={collection.handle} collection={collection} />
              ))}
              {group.brands?.map((brand) => <BrandTile key={brand.slug} brand={brand} />)}
            </BrandCarousel>
          ) : (
            <div className={group.layout === "mosaic" ? "collection-mosaic" : "grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4 xl:grid-cols-6"}>
              {group.collections.map((collection, index) => (
                <CollectionTile
                  key={collection.handle}
                  collection={collection}
                  wide={group.layout === "mosaic" && index < 2}
                />
              ))}
            </div>
          )}
        </section>
      ))}
      <section className="wrap-wide py-[var(--section)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="collection-group-title">Parts</h2>
          <Link href="/search" className="view-all glass no-underline">View all</Link>
        </div>
        <ProductGrid products={products} currency={settings.currency} />
      </section>
    </>
  )
}

function heroLine(tagline: string, announcement: string) {
  const title = tagline.trim().replace(/[.,]$/, "")
  const detail = announcement.replace(/\s+with Australia Post(?=\.?\s*$)/i, "").trim()
  if (!title || !detail) return title || detail
  return `${title}, ${detail.charAt(0).toLowerCase()}${detail.slice(1)}`
}
