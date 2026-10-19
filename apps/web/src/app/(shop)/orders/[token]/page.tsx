import { notFound } from "next/navigation"
import { getSql } from "@/db/client"
import { fulfillPaidOrder } from "@/lib/orders"
import { formatMoney } from "@/lib/money"
import { getStripe, stripeConfigured } from "@/lib/stripe"
import type { Address } from "@/lib/types"

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
  const sql = getSql()
  const rows = await sql<Array<{
    id: string
    number: string
    email: string
    status: string
    paymentStatus: string
    fulfillmentStatus: string
    totalCents: number
    currency: string
    shippingName: string
    shippingAddress: Address
    trackingCarrier: string
    trackingNumber: string
    inventoryWarning: boolean
  }>>`
    select id, number, email, status, payment_status as "paymentStatus", fulfillment_status as "fulfillmentStatus",
      total_cents as "totalCents", currency, shipping_name as "shippingName", shipping_address as "shippingAddress",
      tracking_carrier as "trackingCarrier", tracking_number as "trackingNumber", inventory_warning as "inventoryWarning"
    from orders where public_token = ${token}
  `
  const order = rows[0]
  if (!order) notFound()
  if (query.session_id && stripeConfigured() && order.paymentStatus !== "paid") {
    try {
      const session = await getStripe().checkout.sessions.retrieve(query.session_id)
      if (session.metadata?.orderId === order.id) await fulfillPaidOrder(order.id, session)
    } catch (error) {
      console.error(error)
    }
  }
  const fresh = (await sql<typeof rows>`
    select id, number, email, status, payment_status as "paymentStatus", fulfillment_status as "fulfillmentStatus",
      total_cents as "totalCents", currency, shipping_name as "shippingName", shipping_address as "shippingAddress",
      tracking_carrier as "trackingCarrier", tracking_number as "trackingNumber", inventory_warning as "inventoryWarning"
    from orders where id = ${order.id}
  `)[0]
  const items = await sql<Array<{ productTitle: string, variantTitle: string, quantity: number, unitPriceCents: number }>>`
    select product_title as "productTitle", variant_title as "variantTitle", quantity, unit_price_cents as "unitPriceCents"
    from order_items where order_id = ${order.id}
  `
  const paid = fresh.paymentStatus === "paid"
  return (
    <div className="wrap max-w-2xl py-[var(--section)]">
      <p className="text-xs uppercase tracking-[0.18em]">{fresh.number}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{paid ? "Order confirmed" : "Order pending"}</h1>
      <p className="mt-3 text-sm">
        {paid
          ? "Payment has been verified. A confirmation email is sent when email delivery is configured."
          : "Payment is not confirmed yet. If you just paid, refresh this page in a moment."}
      </p>
      <dl className="mt-8 grid gap-2 text-sm">
        <div className="flex justify-between"><dt>Payment</dt><dd>{fresh.paymentStatus}</dd></div>
        <div className="flex justify-between"><dt>Fulfilment</dt><dd>{fresh.fulfillmentStatus}</dd></div>
        <div className="flex justify-between"><dt>Delivery</dt><dd>{fresh.shippingName}</dd></div>
        <div className="flex justify-between"><dt>Total</dt><dd>{formatMoney(Number(fresh.totalCents), fresh.currency)}</dd></div>
        {fresh.trackingNumber ? (
          <div className="flex justify-between"><dt>Tracking</dt><dd>{fresh.trackingCarrier} {fresh.trackingNumber}</dd></div>
        ) : null}
      </dl>
      <ul className="mt-8 grid gap-2 text-sm">
        {items.map((item, index) => (
          <li key={index}>{item.quantity} × {item.productTitle}{item.variantTitle ? ` (${item.variantTitle})` : ""}</li>
        ))}
      </ul>
    </div>
  )
}
