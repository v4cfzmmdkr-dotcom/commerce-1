import { saveBanner } from "@/app/admin/actions"
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
      {params.saved ? <p className="text-sm">Saved.</p> : null}
      <form action={saveBanner} className="grid max-w-2xl gap-4 border border-[var(--border)] p-4">
        <h2 className="text-lg font-semibold">Homepage banner</h2>
        <p className="text-sm normal-case">This sits behind the black homepage panel. JPEG, PNG, WebP, or GIF up to 12MB, or MP4 or WebM up to 18MB. A dark tint stays over the media so the heading remains readable.</p>
        {settings.bannerUrl ? (
          settings.bannerKind === "video" ? (
            <video className="max-h-48 w-full bg-black object-cover" src={settings.bannerUrl} muted controls />
          ) : (
            <img className="max-h-48 w-full object-cover" src={settings.bannerUrl} alt="" />
          )
        ) : (
          <p className="text-sm">No banner yet. The panel stays solid black.</p>
        )}
        <label className="label">Banner file<input className="normal-case" name="banner" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" /></label>
        {settings.bannerUrl ? (
          <label className="flex items-center gap-2 text-sm normal-case">
            <input type="checkbox" name="removeBanner" />
            Remove the current banner
          </label>
        ) : null}
        <button className="btn w-fit" type="submit">Save banner</button>
      </form>
      <ThemeEditor theme={settings.theme} />
    </div>
  )
}
