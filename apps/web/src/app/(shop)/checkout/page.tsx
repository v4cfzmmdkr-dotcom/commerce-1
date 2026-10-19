import { redirect } from "next/navigation"
import { CheckoutForm } from "@/components/checkout-form"
import { getCart } from "@/lib/cart"
import { getSql } from "@/db/client"
import { databaseConfigured } from "@/db/client"
import { getSettings } from "@/lib/settings"
import { nullableCents } from "@/lib/shipping"

export const metadata = { title: "Checkout" }

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>
}) {
  const cart = await getCart()
  if (cart.lines.length === 0) redirect("/cart")
  const settings = await getSettings()
  const params = await searchParams
  const rates = databaseConfigured()
    ? await getSql()<Array<{
        id: string
        name: string
        description: string
        priceCents: number
        countries: string
        minSubtotalCents: number | null
        maxSubtotalCents: number | null
      }>>`
        select id, name, description, price_cents as "priceCents", countries,
          min_subtotal_cents as "minSubtotalCents", max_subtotal_cents as "maxSubtotalCents"
        from shipping_rates
        where active = true
        order by position asc
      `
    : []
  return (
    <div className="wrap py-[var(--section)]">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm
        rates={rates.map((rate) => ({
          ...rate,
          priceCents: Number(rate.priceCents),
          minSubtotalCents: nullableCents(rate.minSubtotalCents),
          maxSubtotalCents: nullableCents(rate.maxSubtotalCents),
        }))}
        lines={cart.lines.map((line) => ({
          productTitle: line.productTitle,
          variantTitle: line.variantTitle,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          taxable: line.taxable,
        }))}
        currency={settings.currency}
        gstRateBps={settings.gstRateBps}
        pricesIncludeTax={settings.pricesIncludeTax}
        cancelled={params.cancelled === "1"}
      />
    </div>
  )
}
