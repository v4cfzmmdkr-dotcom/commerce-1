import { getSettings } from "@/lib/settings"
import type { MetadataRoute } from "next"

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings()
  return {
    name: settings.name,
    short_name: "Niche Parts",
    description: settings.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: settings.theme.background,
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
