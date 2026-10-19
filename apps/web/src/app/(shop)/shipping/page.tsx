import { cleanHtml } from "@/lib/html"
import { getSettings } from "@/lib/settings"

export const metadata = { title: "Shipping" }

export default async function ShippingPage() {
  const settings = await getSettings()
  return (
    <div className="wrap max-w-2xl py-[var(--section)]">
      <h1 className="text-3xl font-semibold tracking-tight">Shipping</h1>
      <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: cleanHtml(settings.shippingHtml) }} />
    </div>
  )
}
