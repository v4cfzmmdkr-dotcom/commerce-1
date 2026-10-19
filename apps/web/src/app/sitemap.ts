import type { MetadataRoute } from "next"
import { handlesForSitemap } from "@/lib/catalog"
import { siteUrl } from "@/lib/site"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const handles = await handlesForSitemap()
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/shipping`, changeFrequency: "monthly", priority: 0.3 },
    ...handles.collections.map((handle) => ({
      url: `${base}/collections/${handle}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...handles.products.map((handle) => ({
      url: `${base}/products/${handle}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ]
}
