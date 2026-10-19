import { saveSettings } from "@/app/admin/actions"
import { getSettings } from "@/lib/settings"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const [settings, params] = await Promise.all([getSettings(), searchParams])
  return (
    <form action={saveSettings} className="grid max-w-2xl gap-4">
      <h1 className="text-3xl font-semibold">Settings</h1>
      {params.saved ? <p className="text-sm">Settings saved.</p> : null}
      <label className="label">Store name<input className="field normal-case" name="name" defaultValue={settings.name} /></label>
      <label className="label">Tagline<input className="field normal-case" name="tagline" defaultValue={settings.tagline} /></label>
      <label className="label">Announcement<input className="field normal-case" name="announcement" defaultValue={settings.announcement} /></label>
      <label className="label">Support email<input className="field normal-case" name="supportEmail" defaultValue={settings.supportEmail} /></label>
      <label className="label">GST percent<input className="field normal-case" name="gst" defaultValue={(settings.gstRateBps / 100).toFixed(2)} /></label>
      <label className="flex items-center gap-2 text-sm normal-case">
        <input type="checkbox" name="pricesIncludeTax" defaultChecked={settings.pricesIncludeTax} />
        Prices already include GST
      </label>
      <label className="label">About HTML<textarea className="field normal-case min-h-32" name="aboutHtml" defaultValue={settings.aboutHtml} /></label>
      <label className="label">Shipping page HTML<textarea className="field normal-case min-h-32" name="shippingHtml" defaultValue={settings.shippingHtml} /></label>
      <button className="btn" type="submit">Save settings</button>
    </form>
  )
}
