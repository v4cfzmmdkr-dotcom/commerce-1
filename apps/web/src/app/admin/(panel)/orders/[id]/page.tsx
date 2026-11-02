import { notFound } from "next/navigation"
import { resendOrderEmail, resendShippingEmail, updateOrder } from "@/app/admin/actions"
import { getSql } from "@/db/client"
import { formatMoney } from "@/lib/money"
import { paymentLabel } from "@/lib/payment-status"
import { carriers, trackingUrl } from "@/lib/tracking"
import type { Address } from "@/lib/types"

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string, email?: string, shipping?: string }>
}) {
  const { id } = await params
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
    refundedCents: number
    subtotalCents: number
    shippingCents: number
    taxCents: number
    currency: string
    shippingName: string
    shippingAddress: Address
    trackingCarrier: string
    trackingNumber: string
    emailStatus: string
    shippingEmailStatus: string
    shippingEmailedTracking: string
    stripeSessionId: string | null
  }>>`
    select id, number, email, status, payment_status as "paymentStatus", fulfillment_status as "fulfillmentStatus",
      total_cents as "totalCents", refunded_cents as "refundedCents", subtotal_cents as "subtotalCents", shipping_cents as "shippingCents",
      tax_cents as "taxCents", currency, shipping_name as "shippingName", shipping_address as "shippingAddress",
      tracking_carrier as "trackingCarrier", tracking_number as "trackingNumber",
      email_status as "emailStatus",
      shipping_email_status as "shippingEmailStatus", shipping_emailed_tracking as "shippingEmailedTracking",
      stripe_session_id as "stripeSessionId"
    from orders where id = ${id}
  `
  const order = rows[0]
  if (!order) notFound()
  const items = await sql<Array<{ productTitle: string, variantTitle: string, sku: string, quantity: number, unitPriceCents: number }>>`
    select product_title as "productTitle", variant_title as "variantTitle", sku, quantity, unit_price_cents as "unitPriceCents"
    from order_items where order_id = ${id}
  `
  const address = order.shippingAddress
  const trackLink = trackingUrl(order.trackingCarrier, order.trackingNumber)
  const knownCarrier = carriers.some((carrier) => carrier.name === order.trackingCarrier)
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="text-3xl font-semibold">{order.number}</h1>
      {query.saved ? <p className="text-sm">Order updated.</p> : null}
      {query.email ? <p className="text-sm">Email status: {query.email}</p> : null}
      {query.shipping ? <p className="text-sm">{shippingMessage(query.shipping)}</p> : null}
      <dl className="grid gap-1 text-sm">
        <div>Payment: {paymentLabel(order.paymentStatus, order)}</div>
        <div>Status: {order.status}</div>
        <div>Email: {order.email}</div>
        <div>Confirmation email: {order.emailStatus}</div>
        <div>
          Shipping email: {order.shippingEmailStatus === "sent" ? `sent (tracking ${order.shippingEmailedTracking})` : order.shippingEmailStatus || "not sent"}
        </div>
        {trackLink ? <div><a className="underline" href={trackLink} target="_blank" rel="noopener noreferrer">Track parcel</a></div> : null}
        <div>Subtotal {formatMoney(Number(order.subtotalCents), order.currency)} · Shipping {formatMoney(Number(order.shippingCents), order.currency)} · GST {formatMoney(Number(order.taxCents), order.currency)} · Total {formatMoney(Number(order.totalCents), order.currency)}</div>
        <div>{address.name}, {address.line1} {address.line2}, {address.city} {address.state} {address.postcode} {address.country}</div>
      </dl>
      <ul className="admin-card text-sm">
        {items.map((item, index) => (
          <li key={index}>{item.quantity} × {item.productTitle} {item.variantTitle} {item.sku}</li>
        ))}
      </ul>
      <form action={updateOrder} className="admin-card grid gap-3">
        <input type="hidden" name="id" value={order.id} />
        <label className="label">Fulfilment
          <select className="select normal-case" name="fulfillment" defaultValue={order.fulfillmentStatus}>
            <option value="unfulfilled">Unfulfilled</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </label>
        <label className="label">Carrier
          <select className="select normal-case" name="carrier" defaultValue={order.trackingCarrier || carriers[0].name}>
            {carriers.map((carrier) => <option key={carrier.name} value={carrier.name}>{carrier.name}</option>)}
            {order.trackingCarrier && !knownCarrier ? <option value={order.trackingCarrier}>{order.trackingCarrier}</option> : null}
            <option value="Other">Other</option>
          </select>
        </label>
        <label className="label">Tracking number<input className="field normal-case" name="tracking" defaultValue={order.trackingNumber} /></label>
        <p className="text-sm">Saving a tracking number on a paid order marks it shipped and emails the customer. They are only emailed again if the number changes.</p>
        <label className="label">Record a manual status
          <select className="select normal-case" name="mark" defaultValue="">
            <option value="">Leave payment as it is</option>
            <option value="cancelled">Cancel if unpaid</option>
            <option value="refunded">Mark refunded after refunding in Stripe</option>
          </select>
        </label>
        <button className="btn w-fit" type="submit">Update order</button>
      </form>
      <p className="text-sm">Refunds made in Stripe show here automatically. Marking an order refunded does not send money back.</p>
      <div className="flex flex-wrap gap-3">
        <form action={resendOrderEmail}>
          <input type="hidden" name="id" value={order.id} />
          <button className="btn-ghost" type="submit">Resend confirmation email</button>
        </form>
        {order.trackingNumber ? (
          <form action={resendShippingEmail}>
            <input type="hidden" name="id" value={order.id} />
            <button className="btn-ghost" type="submit">Resend shipping email</button>
          </form>
        ) : null}
      </div>
    </div>
  )
}

function shippingMessage(status: string) {
  if (status === "sent") return "Shipping email sent to the customer with the tracking number."
  if (status === "not_configured") return "Shipping email not sent: set RESEND_API_KEY and ORDERS_FROM_EMAIL to enable emails."
  if (status === "failed") return "Shipping email failed to send. Try again with Resend shipping email."
  return "Add a tracking number before sending the shipping email."
}
