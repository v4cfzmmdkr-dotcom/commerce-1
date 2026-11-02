import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ProductGallery } from "@/components/product-gallery"
import { PurchaseBox } from "@/components/purchase-box"
import { getPublicProduct, productPurchasable } from "@/lib/catalog"
import { formatDescription, summaryText } from "@/lib/html"
import { getSettings } from "@/lib/settings"
import { siteUrl } from "@/lib/site"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const [product, settings] = await Promise.all([getPublicProduct(handle), getSettings()])
  if (!product) return { title: "Part" }
  const title = product.seoTitle || product.title
  const description = productDescription(product)
  const path = `/products/${product.handle}`
  const images = product.images.slice(0, 4).map((image) => ({ url: image.url, alt: image.alt || product.title }))
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: settings.name, locale: "en_AU", url: path, title, description, images },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description, images: images.map((image) => image.url) },
  }
}

function productDescription(product: { seoDescription: string, descriptionHtml: string, title: string }) {
  return product.seoDescription || summaryText(product.descriptionHtml) || product.title
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const [product, settings] = await Promise.all([getPublicProduct(handle), getSettings()])
  if (!product) notFound()
  const url = `${siteUrl()}/products/${product.handle}`
  const prices = product.variants.map((variant) => variant.priceCents)
  const low = prices.length ? Math.min(...prices) : 0
  const high = prices.length ? Math.max(...prices) : 0
  const availability = productPurchasable(product) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
  const currency = settings.currency.toUpperCase()
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: productDescription(product),
    sku: product.variants.find((variant) => variant.sku)?.sku,
    image: product.images.map((image) => image.url),
    url,
    brand: { "@type": "Brand", name: settings.name },
    offers: low === high
      ? { "@type": "Offer", priceCurrency: currency, price: (low / 100).toFixed(2), availability, itemCondition: "https://schema.org/NewCondition", url }
      : {
          "@type": "AggregateOffer",
          priceCurrency: currency,
          lowPrice: (low / 100).toFixed(2),
          highPrice: (high / 100).toFixed(2),
          offerCount: product.variants.length,
          availability,
          url,
        },
  }
  return (
    <article className="wrap grid gap-10 py-[var(--section)] lg:grid-cols-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ProductGallery title={product.title} images={product.images} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{product.title}</h1>
        <div className="mt-6">
          <PurchaseBox variants={product.variants} currency={settings.currency} />
        </div>
        <div
          className="prose mt-8 text-sm"
          dangerouslySetInnerHTML={{ __html: formatDescription(product.descriptionHtml) }}
        />
      </div>
    </article>
  )
}
