import Link from "next/link"
import { getSql } from "@/db/client"
import { formatMoney } from "@/lib/money"
import { paymentLabel } from "@/lib/payment-status"

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams
  const archived = show === "archived"
  const sql = getSql()
  const isArchived = sql`(tracking_number <> '' and shipping_email_status = 'sent' and shipping_emailed_tracking = tracking_number)`
  const [orders, counts] = await Promise.all([
    sql<Array<{
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
      where ${isArchived} = ${archived}
      order by created_at desc
      limit 100
    `,
    sql<Array<{ open: number, archived: number }>>`
      select count(*) filter (where not ${isArchived})::int as open, count(*) filter (where ${isArchived})::int as archived
      from orders
    `,
  ])
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Orders</h1>
        <a href="/api/admin/export/orders">Export CSV</a>
      </div>
      <nav className="admin-segmented" aria-label="Filter orders">
        <Link href="/admin/orders" aria-current={archived ? undefined : "page"} className="admin-segment">
          Open ({counts[0].open})
        </Link>
        <Link href="/admin/orders?show=archived" aria-current={archived ? "page" : undefined} className="admin-segment">
          Archived ({counts[0].archived})
        </Link>
      </nav>
      <p className="admin-note text-sm">
        {archived
          ? "Orders move here once tracking is added and the shipping email has been sent."
          : "Orders waiting for tracking or a shipping email."}
      </p>
      {orders.length ? (
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
      ) : (
        <p className="admin-card text-sm">{archived ? "No archived orders yet." : "No open orders. Everything has shipped."}</p>
      )}
    </div>
  )
}
