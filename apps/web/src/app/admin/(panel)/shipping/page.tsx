import { saveShipping } from "@/app/admin/actions"
import { getSql } from "@/db/client"
import { nullableCents } from "@/lib/shipping"

function dollars(cents: number | null) {
  if (cents == null) return ""
  return (cents / 100).toFixed(2)
}

export default async function ShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const params = await searchParams
  const rows = await getSql()<Array<{
    id: string
    name: string
    description: string
    priceCents: number
    countries: string
    active: boolean
    position: number
    minSubtotalCents: number | null
    maxSubtotalCents: number | null
  }>>`
    select id, name, description, price_cents as "priceCents", countries, active, position,
      min_subtotal_cents as "minSubtotalCents", max_subtotal_cents as "maxSubtotalCents"
    from shipping_rates
    order by position asc
  `
  const rates = rows.map((rate) => ({
    ...rate,
    priceCents: Number(rate.priceCents),
    minSubtotalCents: nullableCents(rate.minSubtotalCents),
    maxSubtotalCents: nullableCents(rate.maxSubtotalCents),
  }))
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold">Shipping</h1>
      <p className="max-w-2xl text-sm">Rates are inactive until you turn them on, so checkout will not charge a guessed delivery price. Country codes are comma-separated, for example AU or AU,NZ. Leave countries blank to offer the rate everywhere. A rate applies only when the merchandise subtotal is at least the minimum and at most the maximum. Leave a limit blank for no bound. Free shipping at $25 or more uses a minimum of 25.00, and the paid rate stops at 24.99.</p>
      {params.saved ? <p className="text-sm">Shipping saved.</p> : null}
      {rates.map((rate) => (
        <form key={rate.id} action={saveShipping} className="grid gap-2 border border-[var(--border)] p-4">
          <input type="hidden" name="id" value={rate.id} />
          <input className="field" name="name" defaultValue={rate.name} />
          <input className="field" name="description" defaultValue={rate.description} />
          <label className="label">Price (AUD)<input className="field" name="price" defaultValue={(rate.priceCents / 100).toFixed(2)} /></label>
          <label className="label">Minimum subtotal (AUD)<input className="field" name="minSubtotal" placeholder="No minimum" defaultValue={dollars(rate.minSubtotalCents)} /></label>
          <label className="label">Maximum subtotal (AUD)<input className="field" name="maxSubtotal" placeholder="No maximum" defaultValue={dollars(rate.maxSubtotalCents)} /></label>
          <input className="field" name="countries" defaultValue={rate.countries} />
          <input className="field" name="position" defaultValue={rate.position} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={rate.active} /> Active</label>
          <button className="btn w-fit" type="submit">Save rate</button>
        </form>
      ))}
      <form action={saveShipping} className="grid gap-2 border border-dashed border-[var(--border)] p-4">
        <h2 className="text-lg">New rate</h2>
        <input className="field" name="name" placeholder="Name" required />
        <input className="field" name="description" placeholder="Description" />
        <label className="label">Price (AUD)<input className="field" name="price" placeholder="9.95" required /></label>
        <label className="label">Minimum subtotal (AUD)<input className="field" name="minSubtotal" placeholder="No minimum" /></label>
        <label className="label">Maximum subtotal (AUD)<input className="field" name="maxSubtotal" placeholder="No maximum" /></label>
        <input className="field" name="countries" placeholder="AU" />
        <input className="field" name="position" placeholder="0" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" /> Active</label>
        <button className="btn w-fit" type="submit">Add rate</button>
      </form>
    </div>
  )
}
