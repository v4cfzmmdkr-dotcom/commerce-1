import { ContactChannels } from "@/components/social-links"
import { cleanHtml } from "@/lib/html"
import { getSettings } from "@/lib/settings"

export async function generateMetadata() {
  const settings = await getSettings()
  return { title: "Contact", description: `Contact ${settings.name} on Instagram or Facebook.` }
}

export default async function ContactPage() {
  const settings = await getSettings()
  return (
    <div className="wrap max-w-2xl py-[var(--section)]">
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-4 text-sm opacity-80">
        The fastest way to reach {settings.name} is Instagram, Facebook, or email. Get in touch for custom made, built-to-order parts as well.
      </p>
      <ContactChannels />
      {settings.aboutHtml ? (
        <div className="prose mt-10" dangerouslySetInnerHTML={{ __html: cleanHtml(settings.aboutHtml) }} />
      ) : null}
    </div>
  )
}
