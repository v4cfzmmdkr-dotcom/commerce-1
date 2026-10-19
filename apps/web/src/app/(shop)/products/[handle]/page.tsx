import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PurchaseBox } from "@/components/purchase-box"
import { getPublicProduct, productPurchasable } from "@/lib/catalog"
import { cleanHtml } from "@/lib/html"
import { formatMoney } from "@/lib/money"
import { getSettings } from "@/lib/settings"
import { siteUrl } from "@/lib/site"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const product = await getPublicProduct(handle)
  if (!product) return { title: "Part" }
  return {
    title: product.seoTitle || product.title,
    description: product.seoDescription || product.title,
  }
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const [product, settings] = await Promise.all([getPublicProduct(handle), getSettings()])
  if (!product) notFound()
  const price = product.variants[0]?.priceCents ?? 0
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.seoDescription || product.title,
    sku: product.variants.find((variant) => variant.sku)?.sku,
    image: product.images.map((image) => image.url),
    offers: {
      "@type": "Offer",
      priceCurrency: settings.currency.toUpperCase(),
      price: (price / 100).toFixed(2),
      availability: productPurchasable(product) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${siteUrl()}/products/${product.handle}`,
    },
  }
  return (
    <article className="wrap grid gap-10 py-[var(--section)] lg:grid-cols-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="grid gap-3">
        {product.images.length === 0 ? <div className="product-media" /> : null}
        {product.images.map((image) => (
          <div key={image.id} className="product-media">
            <img src={image.url} alt={image.alt || product.title} />
          </div>
        ))}
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{product.title}</h1>
        <p className="mt-3 text-sm">{formatMoney(price, settings.currency)}</p>
        <div className="mt-6">
          <PurchaseBox variants={product.variants} currency={settings.currency} />
        </div>
        {product.tags.length > 0 ? (
          <p className="mt-6 text-xs uppercase tracking-wide">{product.tags.join(" · ")}</p>
        ) : null}
        <div
          className="prose mt-8 text-sm"
          dangerouslySetInnerHTML={{ __html: cleanHtml(product.descriptionHtml) }}
        />
      </div>
    </article>
  )
}
