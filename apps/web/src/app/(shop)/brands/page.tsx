import { brandDirectory, brandOptions, listHomeCollections } from "@/lib/catalog"
import { brandLogo } from "@/lib/brands"
import { getSettings } from "@/lib/settings"
import type { Metadata } from "next"
import Link from "next/link"

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  const title = "Shop by brand"
  const description = `Every brand ${settings.name} makes parts for, printed in Australia and dispatched within 48 hours.`
  return {
    title,
    description,
    alternates: { canonical: "/brands" },
    openGraph: { type: "website", siteName: settings.name, locale: "en_AU", url: "/brands", title, description },
    twitter: { card: "summary", title, description },
  }
}

export default async function BrandsPage() {
  const [collections, counts] = await Promise.all([
    listHomeCollections(),
    brandOptions(),
  ])
  const brands = brandDirectory(collections, counts)
  return (
    <section className="wrap-wide py-[var(--section)]">
      <h1 className="collection-group-title">Shop by brand</h1>
      <p className="mt-1 mb-6 max-w-xl text-sm opacity-70">Parts for the tools already in the shed.</p>
      <div className="brand-directory">
        {brands.map((brand) => {
          const logo = brand.imageUrl ? null : brandLogo(brand.key)
          return (
            <Link key={brand.key} href={brand.href} className="collection-tile no-underline">
              <div className={`product-media${logo || !brand.imageUrl ? " brand-tile-media" : ""}`}>
                {brand.imageUrl || logo ? (
                  <img src={brand.imageUrl || logo || ""} alt={logo ? `${brand.name} logo` : brand.name} />
                ) : (
                  <span className="brand-tile-wordmark">{brand.name}</span>
                )}
              </div>
              <p className="mt-3 text-sm font-bold">{brand.name}</p>
              {brand.count != null ? (
                <p className="text-xs opacity-60">{brand.count} {brand.count === 1 ? "part" : "parts"}</p>
              ) : null}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
