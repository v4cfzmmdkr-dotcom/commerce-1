import Link from "next/link"
import { ProductGrid } from "@/components/product-grid"
import { SocialLinks } from "@/components/social-links"
import { listFeaturedProducts, listHomeCollections } from "@/lib/catalog"
import { getSettings } from "@/lib/settings"

export default async function HomePage() {
  const [settings, collections, products] = await Promise.all([
    getSettings(),
    listHomeCollections(),
    listFeaturedProducts(),
  ])
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
          <img className="absolute inset-0 h-full w-full object-cover" src={settings.bannerUrl} alt="" />
        ) : null}
        {settings.bannerUrl ? <div className="absolute inset-0 bg-black/45" /> : null}
        <div className="wrap relative py-[var(--section)]">
          <p className="text-xs font-semibold">{settings.name}</p>
          <h1 className="mt-4 max-w-3xl font-semibold tracking-tight" style={{ fontSize: "var(--hero)", lineHeight: 1.05 }}>
            {settings.tagline}
          </h1>
          <p className="mt-5 max-w-xl text-sm opacity-80">{settings.announcement}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/search" className="btn btn-on-dark">Browse parts</Link>
            <SocialLinks />
          </div>
        </div>
      </section>
      {collections.length > 0 ? (
        <section className="wrap py-[var(--section)]">
          <h2 className="mb-6 text-sm font-semibold">Collections</h2>
          <div className="grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4">
            {collections.map((collection) => (
              <Link key={collection.handle} href={`/collections/${collection.handle}`} className="no-underline">
                <div className="product-media bg-[var(--muted)]">
                  {collection.imageUrl ? (
                    <img src={collection.imageUrl} alt="" />
                  ) : (
                    <div className="h-full w-full bg-[var(--fg)]" />
                  )}
                </div>
                <p className="mt-3 text-sm">{collection.title}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <section className="wrap pb-[var(--section)]">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-sm font-semibold">Parts</h2>
          <Link href="/search" className="text-sm">View all</Link>
        </div>
        <ProductGrid products={products} currency={settings.currency} />
      </section>
    </>
  )
}
