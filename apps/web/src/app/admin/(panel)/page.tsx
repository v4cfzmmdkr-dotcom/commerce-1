import Link from "next/link"
import { AutoRefresh } from "@/components/auto-refresh"
import { getSql } from "@/db/client"
import { formatMoney } from "@/lib/money"

export const dynamic = "force-dynamic"

function age(createdAt: string | Date) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  if (days < 1) return "Today"
  if (days === 1) return "Yesterday"
  return `${days} days ago`
}

export default async function AdminHome() {
  const sql = getSql()
  const [openOrders, products, orders, remoteImages] = await Promise.all([
    sql<{ id: string, number: string, email: string, totalCents: number, currency: string, createdAt: string }[]>`
      select id, number, email, total_cents as "totalCents", currency, created_at as "createdAt"
      from orders
      where payment_status in ('paid', 'partially_refunded')
        and not (tracking_number <> '' and shipping_email_status = 'sent' and shipping_emailed_tracking = tracking_number)
      order by created_at asc
    `,
    sql<{ listed: number, hidden: number }[]>`
      select count(*) filter (where status = 'active')::int as listed, count(*) filter (where status <> 'active')::int as hidden
      from products
    `,
    sql<{ count: number }[]>`
      select count(*)::int as count from orders where payment_status in ('paid', 'partially_refunded')
    `,
    sql<{ count: number }[]>`
      select
        (select count(*) from product_images where storage_path is null and source_url is not null)::int
        + (select count(*) from collections where image_path is null and image_url is not null)::int as count
    `,
  ])
  const paid = orders[0]
  const { listed, hidden } = products[0]
  return (
    <div className="grid gap-8">
      <AutoRefresh />
      <h1 className="text-3xl font-semibold">Overview</h1>
      <div className="grid gap-4">
      <article className="admin-card">
        <p className="admin-stat-label">Open orders</p>
        <p className="admin-stat-value">{openOrders.length}</p>
        <p className="admin-note mt-1 text-sm">
          {openOrders.length ? "Paid and waiting for tracking. Oldest first." : "Everything paid has shipped."}
        </p>
        {openOrders.length ? (
          <ul className="admin-open-orders">
            {openOrders.slice(0, 5).map((order) => (
              <li key={order.id}>
                <Link className="admin-row-link" href={`/admin/orders/${order.id}`}>
                  <span className="font-medium">{order.number}</span>
                  <span className="admin-note min-w-0 flex-1 truncate">{order.email}</span>
                  <span className="admin-note hidden sm:inline">{age(order.createdAt)}</span>
                  <span>{formatMoney(Number(order.totalCents), order.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1 text-sm">
          <Link href="/admin/orders">{openOrders.length > 5 ? `View all ${openOrders.length} open orders` : "View orders"}</Link>
        </p>
      </article>
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="admin-card">
          <p className="admin-stat-label">Products</p>
          <p className="admin-stat-value">{listed + hidden}</p>
          <p className="mt-1 text-sm">
            <Link href="/admin/products?show=listed">Listed {listed}</Link> · <Link href="/admin/products?show=hidden">Hidden {hidden}</Link>
          </p>
        </article>
        <article className="admin-card">
          <p className="admin-stat-label">Paid orders</p>
          <p className="admin-stat-value">{paid?.count ?? 0}</p>
          <p className="mt-1 text-sm"><Link href="/admin/orders">View orders</Link></p>
        </article>
        <article className="admin-card">
          <p className="admin-stat-label">Images still on Shopify</p>
          <p className="admin-stat-value">{remoteImages[0]?.count ?? 0}</p>
          <p className="mt-1 text-sm"><Link href="/admin/products#import">Download them</Link></p>
        </article>
      </div>
      </div>
    </div>
  )
}
