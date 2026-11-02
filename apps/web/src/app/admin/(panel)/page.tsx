import Link from "next/link"
import { getSql } from "@/db/client"

export default async function AdminHome() {
  const sql = getSql()
  const [products, orders, remoteImages] = await Promise.all([
    sql<{ listed: number, hidden: number }[]>`
      select count(*) filter (where status = 'active')::int as listed, count(*) filter (where status <> 'active')::int as hidden
      from products
    `,
    sql<{ paymentStatus: string, count: number, revenue: number }[]>`
      select payment_status as "paymentStatus", count(*)::int as count, coalesce(sum(total_cents), 0)::int as revenue
      from orders group by payment_status
    `,
    sql<{ count: number }[]>`
      select count(*)::int as count from product_images where storage_path is null and source_url is not null
    `,
  ])
  const paid = orders.find((row) => row.paymentStatus === "paid")
  const { listed, hidden } = products[0]
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-semibold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="border border-[var(--border)] p-4">
          <p className="text-xs uppercase tracking-wide">Products</p>
          <p className="mt-2 text-2xl">{listed + hidden}</p>
          <p className="text-sm">
            <Link href="/admin/products?show=listed">listed {listed}</Link> · <Link href="/admin/products?show=hidden">hidden {hidden}</Link>
          </p>
        </article>
        <article className="border border-[var(--border)] p-4">
          <p className="text-xs uppercase tracking-wide">Paid orders</p>
          <p className="mt-2 text-2xl">{paid?.count ?? 0}</p>
        </article>
        <article className="border border-[var(--border)] p-4">
          <p className="text-xs uppercase tracking-wide">Images still on Shopify</p>
          <p className="mt-2 text-2xl">{remoteImages[0]?.count ?? 0}</p>
          <Link href="/admin/import" className="text-sm">Download them</Link>
        </article>
      </div>
    </div>
  )
}
