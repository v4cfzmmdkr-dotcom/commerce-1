import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ProductGallery } from "@/components/product-gallery"
import { PurchaseBox } from "@/components/purchase-box"
import { getPublicProduct, type PublicProduct } from "@/lib/catalog"
import { formatDescription } from "@/lib/html"
import { isPurchasable } from "@/lib/money"
import { listActiveShippingRates } from "@/lib/orders"
import { freeShippingFrom, pageTitle, searchDescription, shippingCentsFor } from "@/lib/product-seo"
import { RETURN_DAYS } from "@/lib/returns"
import { getSettings } from "@/lib/settings"
import { SHIPPING_COUNTRY, type ShippingRate } from "@/lib/shipping"
import { siteUrl } from "@/lib/site"

async function shippingRates(): Promise<ShippingRate[]> {
  try {
    return await listActiveShippingRates()
  } catch {
    return []
  }
}

function productDescription(product: PublicProduct, rates: ShippingRate[]) {
  return searchDescription({
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    seoDescription: product.seoDescription,
    prices: product.variants.map((variant) => variant.priceCents),
    freeShippingFromCents: freeShippingFrom(rates),
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const [product, settings, rates] = await Promise.all([getPublicProduct(handle), getSettings(), shippingRates()])
  if (!product) return { title: "Part" }
  const title = product.seoTitle || product.title
  const description = productDescription(product, rates)
  const path = `/products/${product.handle}`
  const images = product.images.slice(0, 4).map((image) => ({ url: image.url, alt: image.alt || product.title }))
  return {
    title: pageTitle(title, settings.name),
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: settings.name, locale: "en_AU", url: path, title, description, images },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description, images: images.map((image) => image.url) },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const [product, settings, rates] = await Promise.all([getPublicProduct(handle), getSettings(), shippingRates()])
  if (!product) notFound()
  const base = siteUrl()
  const url = `${base}/products/${product.handle}`
  const currency = settings.currency.toUpperCase()
  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: SHIPPING_COUNTRY,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: RETURN_DAYS,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    merchantReturnLink: `${base}/returns`,
  }
  const offers = product.variants.map((variant) => {
    const shippingCents = shippingCentsFor(rates, variant.priceCents)
    return {
      "@type": "Offer",
      ...(product.variants.length > 1 ? { name: variant.title } : {}),
      ...(variant.sku ? { sku: variant.sku } : {}),
      priceCurrency: currency,
      price: (variant.priceCents / 100).toFixed(2),
      availability: isPurchasable(variant) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url,
      ...(shippingCents == null ? {} : {
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: { "@type": "MonetaryAmount", value: (shippingCents / 100).toFixed(2), currency },
          shippingDestination: { "@type": "DefinedRegion", addressCountry: SHIPPING_COUNTRY },
        },
      }),
      hasMerchantReturnPolicy: returnPolicy,
    }
  })
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: productDescription(product, rates),
    sku: product.variants.find((variant) => variant.sku)?.sku,
    image: product.images.map((image) => image.url),
    url,
    brand: { "@type": "Brand", name: settings.name },
    offers,
  }
  return (
    <article className="wrap grid gap-10 py-[var(--section)] lg:grid-cols-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ProductGallery title={product.title} images={product.images} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{product.title}</h1>
        <div className="mt-6">
          <PurchaseBox variants={product.variants} currency={settings.currency} colours={settings.colours} />
        </div>
        <div
          className="prose mt-8 text-sm"
          dangerouslySetInnerHTML={{ __html: formatDescription(product.descriptionHtml) }}
        />
      </div>
    </article>
  )
}
