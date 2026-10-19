import { getSettings } from "@/lib/settings"
import { siteUrl } from "@/lib/site"
import { themeCss } from "@/lib/theme"
import type { Metadata, Viewport } from "next"
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans, Inter } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" })
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
})
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const futuraBook = localFont({
  src: "../fonts/FuturaCyrillicBook.ttf",
  variable: "--font-hero",
  display: "swap",
  weight: "400",
})
const futuraDemi = localFont({
  src: "../fonts/FuturaCyrillicDemi.ttf",
  variable: "--font-hero-btn",
  display: "swap",
  weight: "600",
})
const zahaHadid = localFont({
  src: "../fonts/ZahaHadid-Sans.otf",
  variable: "--font-hadid",
  display: "swap",
  weight: "400",
})
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-hero-meta",
})

export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: settings.name, template: `%s · ${settings.name}` },
    description: settings.tagline,
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const theme = settings.theme
  return (
    <html
      lang="en-AU"
      className={`${archivo.variable} ${plex.variable} ${inter.variable} ${futuraBook.variable} ${futuraDemi.variable} ${zahaHadid.variable} ${plexMono.variable}`}
      data-font={theme.font}
      data-density={theme.density}
      data-radius={theme.radius}
    >
      <body>
        <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
        <a className="skip-link" href="#content">Skip to content</a>
        {children}
      </body>
    </html>
  )
}
