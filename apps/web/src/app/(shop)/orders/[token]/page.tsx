import { notFound } from "next/navigation"
import { fulfillPaidOrder, getOrderByPublicToken, getOrderItems } from "@/lib/orders"
import { formatMoney } from "@/lib/money"
import { paymentLabel } from "@/lib/payment-status"
import { trackingUrl } from "@/lib/tracking"
import { getSettings } from "@/lib/settings"
import { getStripe, stripeConfigured } from "@/lib/stripe"
import { invoiceDate } from "@/lib/tax-invoice"

export const metadata = { title: "Order" }

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ session_id?: string }>
}) {
  const { token } = await params
  const query = await searchParams
  const order = await getOrderByPublicToken(token)
  if (!order) notFound()
  if (query.session_id && stripeConfigured() && order.paymentStatus !== "paid") {
    try {
      const session = await getStripe().checkout.sessions.retrieve(query.session_id)
      if (session.metadata?.orderId === order.id) await fulfillPaidOrder(order.id, session)
    } catch (error) {
      console.error(error)
    }
  }
  const fresh = await getOrderByPublicToken(token) ?? order
  const [items, settings] = await Promise.all([getOrderItems(fresh.id), getSettings()])
  const paid = fresh.paymentStatus === "paid"
  const trackLink = trackingUrl(fresh.trackingCarrier, fresh.trackingNumber)
  const money = (cents: number) => formatMoney(cents, fresh.currency)
  return (
    <div className="wrap max-w-2xl py-[var(--section)]">
      {fresh.paidAt && settings.abn ? (
        <div className="mb-8 border-b border-[var(--border)] pb-6 text-sm">
          <p className="text-lg font-semibold">Tax invoice</p>
          <p className="mt-1">{settings.invoiceName || settings.name} · ABN {settings.abn}</p>
          <p>Invoice {fresh.number} · {invoiceDate(fresh.paidAt)}</p>
        </div>
      ) : null}
      <p className="text-xs uppercase tracking-[0.18em]">{fresh.number}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{paid ? "Order confirmed" : "Order pending"}</h1>
      <p className="mt-3 text-sm">
        {paid
          ? `Payment received. A confirmation email is on its way to ${fresh.email}.`
          : "Payment is not confirmed yet. If you just paid, refresh this page in a moment."}
      </p>
      <dl className="mt-8 grid gap-2 text-sm">
        <div className="flex justify-between"><dt>Payment</dt><dd>{paymentLabel(fresh.paymentStatus)}</dd></div>
        <div className="flex justify-between"><dt>Fulfilment</dt><dd>{fresh.fulfillmentStatus}</dd></div>
        <div className="flex justify-between"><dt>Delivery</dt><dd>{fresh.shippingName}</dd></div>
        <div className="flex justify-between"><dt>Shipping</dt><dd>{money(fresh.shippingCents)}</dd></div>
        <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(fresh.totalCents)}</dd></div>
        <div className="flex justify-between"><dt>Includes GST</dt><dd>{money(fresh.taxCents)}</dd></div>
        {fresh.trackingNumber ? (
          <div className="flex justify-between">
            <dt>Tracking</dt>
            <dd>
              {fresh.trackingCarrier} {trackLink ? (
                <a href={trackLink} target="_blank" rel="noopener noreferrer">{fresh.trackingNumber}</a>
              ) : fresh.trackingNumber}
            </dd>
          </div>
        ) : null}
      </dl>
      <ul className="mt-8 grid gap-2 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex justify-between gap-4">
            <span>{item.quantity} × {item.productTitle}{item.variantTitle ? ` (${item.variantTitle})` : ""}</span>
            <span>{money(item.unitPriceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
