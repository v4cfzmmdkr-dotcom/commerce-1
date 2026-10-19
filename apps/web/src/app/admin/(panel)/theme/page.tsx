import { ThemeEditor } from "@/components/theme-editor"
import { getSettings } from "@/lib/settings"

export default async function ThemePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const [settings, params] = await Promise.all([getSettings(), searchParams])
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold">Theme</h1>
      <p className="max-w-2xl text-sm">The shop starts black and white. Colour, type, spacing, and corner radius saved here apply to the storefront.</p>
      {params.saved ? <p className="text-sm">Theme saved.</p> : null}
      <ThemeEditor theme={settings.theme} />
    </div>
  )
}
