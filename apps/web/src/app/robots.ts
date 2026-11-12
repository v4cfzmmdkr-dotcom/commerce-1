import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"

const aiCrawlers = [
  "GPTBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "FacebookBot",
  "cohere-ai",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "Timpibot",
  "YouBot",
  "DataForSeoBot",
  "PetalBot",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: aiCrawlers, disallow: "/" },
      {
        userAgent: "*",
        allow: ["/", "/api/media/"],
        disallow: ["/admin", "/api/", "/checkout", "/cart", "/orders"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
