import { saveSettings } from "@/app/admin/actions"
import { getSettings } from "@/lib/settings"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const [settings, params] = await Promise.all([getSettings(), searchParams])
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      {params.saved ? <p className="text-sm">Settings saved.</p> : null}
      <form action={saveSettings} className="admin-card grid gap-4">
      <label className="label">Store name<input className="field normal-case" name="name" defaultValue={settings.name} /></label>
      <label className="label">Tagline<input className="field normal-case" name="tagline" defaultValue={settings.tagline} /></label>
      <label className="label">Announcement<input className="field normal-case" name="announcement" defaultValue={settings.announcement} /></label>
      <label className="label">Support email<input className="field normal-case" name="supportEmail" defaultValue={settings.supportEmail} /></label>
      <label className="label">
        New order alerts
        <input className="field normal-case" type="email" name="orderAlertEmail" defaultValue={settings.orderAlertEmail} placeholder="Leave empty to turn off" />
      </label>
      <label className="label">
        ABN
        <input className="field normal-case" name="abn" inputMode="numeric" defaultValue={settings.abn} placeholder="Only once registered for GST" />
      </label>
      <label className="label">
        Business name on invoices
        <input className="field normal-case" name="invoiceName" defaultValue={settings.invoiceName} placeholder="Leave empty to use the store name" />
      </label>
      <label className="label">GST percent<input className="field normal-case" name="gst" defaultValue={(settings.gstRateBps / 100).toFixed(2)} /></label>
      <label className="flex items-center gap-2 text-sm normal-case">
        <input type="checkbox" name="pricesIncludeTax" defaultChecked={settings.pricesIncludeTax} />
        Prices already include GST
      </label>
      <label className="label">About HTML<textarea className="field normal-case min-h-32" name="aboutHtml" defaultValue={settings.aboutHtml} /></label>
      <label className="label">Shipping page HTML<textarea className="field normal-case min-h-32" name="shippingHtml" defaultValue={settings.shippingHtml} /></label>
      <button className="btn" type="submit">Save settings</button>
      </form>
    </div>
  )
}
