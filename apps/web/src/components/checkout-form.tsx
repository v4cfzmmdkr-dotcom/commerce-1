"use client"

import dynamic from "next/dynamic"
import { useActionState, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { placeOrder } from "@/app/(shop)/checkout/actions"
import { formatMoney } from "@/lib/money"
import { merchandiseSubtotal, quoteOrder } from "@/lib/pricing"
import { SHIPPING_OFFER_NOTE, shippingRateApplies } from "@/lib/shipping"

type Rate = {
  id: string
  name: string
  description: string
  priceCents: number
  countries: string
  minSubtotalCents: number | null
  maxSubtotalCents: number | null
}

const AddressFinder = dynamic(
  () => import("@/components/address-finder").then((mod) => mod.AddressFinder),
  { ssr: false },
)

function PayButton() {
  const pending = useFormStatus()
  return <button className="btn w-full" type="submit">{pending.pending ? "Redirecting to payment…" : "Continue to payment"}</button>
}

export function CheckoutForm({
  rates,
  lines,
  currency,
  gstRateBps,
  pricesIncludeTax,
  cancelled,
}: {
  rates: Rate[]
  lines: Array<{ productTitle: string, variantTitle: string, quantity: number, unitPriceCents: number, taxable: boolean }>
  currency: string
  gstRateBps: number
  pricesIncludeTax: boolean
  cancelled: boolean
}) {
  const [country, setCountry] = useState("AU")
  const [line1, setLine1] = useState("")
  const [line2, setLine2] = useState("")
  const [city, setCity] = useState("")
  const [region, setRegion] = useState("")
  const [postcode, setPostcode] = useState("")
  const [rateId, setRateId] = useState("")
  const [formState, action] = useActionState(placeOrder, null)
  const subtotalCents = merchandiseSubtotal(lines)
  const available = useMemo(() => {
    return rates.filter((rate) => shippingRateApplies(rate, subtotalCents, country))
  }, [country, rates, subtotalCents])
  const selected = available.length === 1
    ? available[0]
    : available.find((rate) => rate.id === rateId) ?? null
  const quote = quoteOrder({
    lines,
    shippingCents: selected?.priceCents ?? 0,
    gstRateBps,
    pricesIncludeTax,
  })

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-4">
        {cancelled ? <p className="text-sm">Payment was cancelled. Your cart is still here.</p> : null}
        <label className="label">Email<input className="field normal-case" name="email" type="email" required autoComplete="email" /></label>
        <label className="label">Full name<input className="field normal-case" name="name" required autoComplete="name" /></label>
        <AddressFinder
          onSelect={(address) => {
            setLine1(address.line1)
            setLine2(address.line2)
            setCity(address.city)
            setRegion(address.state)
            setPostcode(address.postcode)
            if (address.country === "AU" || address.country === "NZ") setCountry(address.country)
          }}
        />
        <label className="label">Address<input className="field normal-case" name="line1" required autoComplete="address-line1" value={line1} onChange={(event) => setLine1(event.target.value)} /></label>
        <label className="label">Apartment, suite (optional)<input className="field normal-case" name="line2" autoComplete="address-line2" value={line2} onChange={(event) => setLine2(event.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">City<input className="field normal-case" name="city" required autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} /></label>
          <label className="label">State<input className="field normal-case" name="state" required autoComplete="address-level1" value={region} onChange={(event) => setRegion(event.target.value)} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">Postcode<input className="field normal-case" name="postcode" required autoComplete="postal-code" value={postcode} onChange={(event) => setPostcode(event.target.value)} /></label>
          <label className="label">
            Country
            <select className="select normal-case" name="country" value={country} onChange={(event) => setCountry(event.target.value)}>
              <option value="AU">Australia</option>
              <option value="NZ">New Zealand</option>
            </select>
          </label>
        </div>
        <label className="label">Phone (optional)<input className="field normal-case" name="phone" autoComplete="tel" /></label>
        <fieldset className="grid gap-2">
          <legend className="text-xs uppercase tracking-wide">Delivery</legend>
          <p className="text-sm">{SHIPPING_OFFER_NOTE}</p>
          {available.length === 0 ? <p className="text-sm">No delivery option is active for this country. Add one in the dashboard.</p> : null}
          {available.length === 1 ? (
            <div className="border border-[var(--border)] p-3 text-sm normal-case">
              <input type="hidden" name="shippingRateId" value={available[0].id} />
              <span className="block">{available[0].name} · {formatMoney(available[0].priceCents, currency)}</span>
              {available[0].description ? <span className="block text-xs opacity-70">{available[0].description}</span> : null}
            </div>
          ) : available.map((rate) => (
            <label key={rate.id} className="flex items-start gap-3 border border-[var(--border)] p-3 text-sm normal-case">
              <input
                type="radio"
                name="shippingRateId"
                value={rate.id}
                checked={(selected?.id ?? "") === rate.id}
                onChange={() => setRateId(rate.id)}
                required
              />
              <span>
                <span className="block">{rate.name} · {formatMoney(rate.priceCents, currency)}</span>
                {rate.description ? <span className="block text-xs opacity-70">{rate.description}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
        {formState?.error ? <p className="text-sm" role="alert">{formState.error}</p> : null}
        <PayButton />
      </div>
      <aside className="h-fit border border-[var(--border)] p-4 text-sm">
        <ul className="grid gap-2">
          {lines.map((line, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span>{line.quantity} × {line.productTitle}{line.variantTitle ? ` (${line.variantTitle})` : ""}</span>
              <span>{formatMoney(line.unitPriceCents * line.quantity, currency)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between"><span>Shipping</span><span>{selected ? formatMoney(selected.priceCents, currency) : "—"}</span></p>
        <p className="mt-2 flex justify-between"><span>{pricesIncludeTax ? "Includes GST" : "GST"}</span><span>{formatMoney(quote.tax, currency)}</span></p>
        <p className="mt-3 flex justify-between font-medium"><span>Total</span><span>{formatMoney(quote.total, currency)}</span></p>
      </aside>
    </form>
  )
}
