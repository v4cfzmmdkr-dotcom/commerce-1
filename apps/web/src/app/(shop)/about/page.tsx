import { cleanHtml } from "@/lib/html"
import { getSettings } from "@/lib/settings"

export async function generateMetadata() {
  const settings = await getSettings()
  return { title: "About", description: settings.tagline }
}

export default async function AboutPage() {
  const settings = await getSettings()
  return (
    <div className="wrap max-w-2xl py-[var(--section)]">
      <h1 className="text-3xl font-semibold tracking-tight">About {settings.name}</h1>
      <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: cleanHtml(settings.aboutHtml) }} />
    </div>
  )
}
