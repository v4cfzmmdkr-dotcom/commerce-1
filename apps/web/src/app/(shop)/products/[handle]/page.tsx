import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ProductGallery } from "@/components/product-gallery"
import { PurchaseBox } from "@/components/purchase-box"
import { getPublicProduct, productPurchasable } from "@/lib/catalog"
import { formatDescription } from "@/lib/html"
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
