import { notFound } from "next/navigation"
import { resendOrderEmail, updateOrder } from "@/app/admin/actions"
import { getSql } from "@/db/client"
import { formatMoney } from "@/lib/money"
import type { Address } from "@/lib/types"

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string, email?: string }>
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
    subtotalCents: number
    shippingCents: number
    taxCents: number
    currency: string
    shippingName: string
    shippingAddress: Address
    trackingCarrier: string
    trackingNumber: string
    inventoryWarning: boolean
    emailStatus: string
    stripeSessionId: string | null
  }>>`
    select id, number, email, status, payment_status as "paymentStatus", fulfillment_status as "fulfillmentStatus",
      total_cents as "totalCents", subtotal_cents as "subtotalCents", shipping_cents as "shippingCents",
      tax_cents as "taxCents", currency, shipping_name as "shippingName", shipping_address as "shippingAddress",
      tracking_carrier as "trackingCarrier", tracking_number as "trackingNumber",
      inventory_warning as "inventoryWarning", email_status as "emailStatus", stripe_session_id as "stripeSessionId"
    from orders where id = ${id}
  `
  const order = rows[0]
  if (!order) notFound()
  const items = await sql<Array<{ productTitle: string, variantTitle: string, sku: string, quantity: number, unitPriceCents: number }>>`
    select product_title as "productTitle", variant_title as "variantTitle", sku, quantity, unit_price_cents as "unitPriceCents"
    from order_items where order_id = ${id}
  `
  const address = order.shippingAddress
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="text-3xl font-semibold">{order.number}</h1>
      {query.saved ? <p className="text-sm">Order updated.</p> : null}
      {query.email ? <p className="text-sm">Email status: {query.email}</p> : null}
      {order.inventoryWarning ? <p className="text-sm">Payment was captured, but stock could not be reduced for every line. Check inventory.</p> : null}
      <dl className="grid gap-1 text-sm">
        <div>Payment: {order.paymentStatus}</div>
        <div>Status: {order.status}</div>
        <div>Email: {order.email}</div>
        <div>Confirmation email: {order.emailStatus}</div>
        <div>Subtotal {formatMoney(Number(order.subtotalCents), order.currency)} · Shipping {formatMoney(Number(order.shippingCents), order.currency)} · GST {formatMoney(Number(order.taxCents), order.currency)} · Total {formatMoney(Number(order.totalCents), order.currency)}</div>
        <div>{address.name}, {address.line1} {address.line2}, {address.city} {address.state} {address.postcode} {address.country}</div>
      </dl>
      <ul className="text-sm">
        {items.map((item, index) => (
          <li key={index}>{item.quantity} × {item.productTitle} {item.variantTitle} {item.sku}</li>
        ))}
      </ul>
      <form action={updateOrder} className="grid gap-3">
        <input type="hidden" name="id" value={order.id} />
        <label className="label">Fulfilment
          <select className="select normal-case" name="fulfillment" defaultValue={order.fulfillmentStatus}>
            <option value="unfulfilled">Unfulfilled</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </label>
        <label className="label">Carrier<input className="field normal-case" name="carrier" defaultValue={order.trackingCarrier} /></label>
        <label className="label">Tracking number<input className="field normal-case" name="tracking" defaultValue={order.trackingNumber} /></label>
        <label className="label">Record a manual status
          <select className="select normal-case" name="mark" defaultValue="">
            <option value="">Leave payment as it is</option>
            <option value="cancelled">Cancel if unpaid</option>
            <option value="refunded">Mark refunded after refunding in Stripe</option>
          </select>
        </label>
        <button className="btn w-fit" type="submit">Update order</button>
      </form>
      <p className="text-sm">Marking an order refunded does not send money back. Refund the payment in Stripe first.</p>
      <form action={resendOrderEmail}>
        <input type="hidden" name="id" value={order.id} />
        <button className="btn-ghost" type="submit">Resend confirmation email</button>
      </form>
    </div>
  )
}
