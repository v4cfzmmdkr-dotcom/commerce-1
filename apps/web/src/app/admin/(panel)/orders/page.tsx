import Link from "next/link"
import { getSql } from "@/db/client"
import { formatMoney } from "@/lib/money"
import { paymentLabel } from "@/lib/payment-status"

export default async function OrdersPage() {
  const sql = getSql()
  const orders = await sql<Array<{
    id: string
    number: string
    email: string
    paymentStatus: string
    fulfillmentStatus: string
    totalCents: number
    refundedCents: number
    currency: string
    createdAt: string
  }>>`
    select id, number, email, payment_status as "paymentStatus", fulfillment_status as "fulfillmentStatus",
      total_cents as "totalCents", refunded_cents as "refundedCents", currency, created_at as "createdAt"
    from orders
    order by created_at desc
    limit 100
  `
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Orders</h1>
        <a href="/api/admin/export/orders">Export CSV</a>
      </div>
      <div className="admin-card overflow-x-auto p-0">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Email</th>
            <th>Payment</th>
            <th>Fulfilment</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td><Link href={`/admin/orders/${order.id}`}>{order.number}</Link></td>
              <td>{order.email}</td>
              <td>{paymentLabel(order.paymentStatus, order)}</td>
              <td>{order.fulfillmentStatus}</td>
              <td>{formatMoney(Number(order.totalCents), order.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
