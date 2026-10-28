import { redirect } from "next/navigation"
import { CheckoutForm } from "@/components/checkout-form"
import { getCart } from "@/lib/cart"
import { listActiveShippingRates } from "@/lib/orders"
import { getSettings } from "@/lib/settings"

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
  const rates = await listActiveShippingRates()
  return (
    <div className="wrap py-[var(--section)]">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm
        rates={rates}
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
