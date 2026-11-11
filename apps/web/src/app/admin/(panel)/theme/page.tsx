import { saveBanner, saveLogo } from "@/app/admin/actions"
import { ThemeEditor } from "@/components/theme-editor"
import { getSettings } from "@/lib/settings"

const logoErrors: Record<string, string> = {
  type: "Upload the logo as a PNG, JPEG, or WebP.",
  size: "The logo must be under 5MB.",
  missing: "Choose a logo file first.",
}

export default async function ThemePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string, logoError?: string }>
}) {
  const [settings, params] = await Promise.all([getSettings(), searchParams])
  const logoError = params.logoError ? logoErrors[params.logoError] : null
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold">Theme</h1>
      <p className="admin-note max-w-2xl text-sm">The shop starts black and white. Colour, type, spacing, and corner radius saved here apply to the storefront.</p>
      {params.saved && params.saved !== "logo" ? <p className="text-sm">Saved.</p> : null}
      <form action={saveLogo} className="admin-card grid max-w-2xl gap-4">
        <h2 className="text-lg font-semibold">Logo</h2>
        <p className="text-sm normal-case">Shown in the menu bar, the footer, and link previews across the shop. Use a square PNG, JPEG, or WebP up to 5MB; the menu bar crops it to a circle.</p>
        <div className="flex items-center gap-4">
          <span className="app-icon logo-preview">
            <img src={settings.logoUrl || "/brand/logo.png"} alt="Current logo" />
          </span>
          <p className="admin-note text-sm">{settings.logoUrl ? "Your uploaded logo." : "The default Niche Parts logo."}</p>
        </div>
        <label className="label">Logo file<input className="normal-case" name="logo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
        {settings.logoUrl ? (
          <label className="flex items-center gap-2 text-sm normal-case">
            <input type="checkbox" name="removeLogo" />
            Go back to the default logo
          </label>
        ) : null}
        {logoError ? <p className="text-sm" role="alert">{logoError}</p> : null}
        {params.saved === "logo" ? <p className="text-sm" role="status">Logo saved. It now shows across the shop.</p> : null}
        <button className="btn w-fit" type="submit">Save logo</button>
      </form>
      <form action={saveBanner} className="admin-card grid max-w-2xl gap-4">
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
