import { BrandCarousel } from "@/components/brand-carousel"
import { CustomPartCta, MaterialGuide, WhyNicheParts } from "@/components/home-sections"
import { SocialLinks } from "@/components/social-links"
import { brandLogo, type BrandCount } from "@/lib/brands"
import { brandOptions, groupHomeCollections, listHomeCollections, type HomeCollection } from "@/lib/catalog"
import { getSettings } from "@/lib/settings"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { alternates: { canonical: "/" } }

// How many leading tiles span two columns so every row of the mosaic is full.
function mosaicWideCount(count: number, columns: number) {
  return Math.min((columns - (count % columns)) % columns, count)
}

function mosaicTileClass(index: number, count: number) {
  return [
    index < mosaicWideCount(count, 2) ? "collection-tile-wide-sm" : "",
    index < mosaicWideCount(count, 3) ? "collection-tile-wide-md" : "",
    index < mosaicWideCount(count, 4) ? "collection-tile-wide-xl" : "",
  ].filter(Boolean).join(" ")
}

function CollectionTile({
  collection,
  className = "",
}: {
  collection: HomeCollection
  className?: string
}) {
  return (
    <Link
      href={`/collections/${collection.handle}`}
      className={`collection-tile no-underline ${className}`.trim()}
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
  const [settings, collections, brandCounts] = await Promise.all([
    getSettings(),
    listHomeCollections(),
    brandOptions(),
  ])
  const collectionGroups = groupHomeCollections(collections, brandCounts)
  return (
    <>
      <section className="hero relative isolate overflow-clip">
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
          <div className="hero-cta">
            <Link href="/search" className="btn no-underline">Shop all parts</Link>
            <Link href="/contact" className="hero-cta-secondary glass no-underline">Request a custom part</Link>
          </div>
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
            <div className="collection-mosaic">
              {group.collections.map((collection, index) => (
                <CollectionTile
                  key={collection.handle}
                  collection={collection}
                  className={mosaicTileClass(index, group.collections.length)}
                />
              ))}
            </div>
          )}
        </section>
      ))}
      <MaterialGuide materials={settings.materials} />
      <WhyNicheParts currency={settings.currency} />
      <CustomPartCta />
    </>
  )
}

function heroLine(tagline: string, announcement: string) {
  const title = tagline.trim().replace(/[.,]$/, "")
  const detail = announcement.replace(/\s+with Australia Post(?=\.?\s*$)/i, "").trim()
  if (!title || !detail) return title || detail
  return `${title}, ${detail.charAt(0).toLowerCase()}${detail.slice(1)}`
}
