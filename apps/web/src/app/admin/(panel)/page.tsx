import Link from "next/link"
import { setStockPolicy } from "@/app/admin/actions"
import { getSql } from "@/db/client"

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ stock?: string }>
}) {
  const sql = getSql()
  const params = await searchParams
  const [products, orders, soldOut, remoteImages] = await Promise.all([
    sql<{ status: string, count: number }[]>`select status, count(*)::int as count from products group by status`,
    sql<{ paymentStatus: string, count: number, revenue: number }[]>`
      select payment_status as "paymentStatus", count(*)::int as count, coalesce(sum(total_cents), 0)::int as revenue
      from orders group by payment_status
    `,
    sql<{ count: number }[]>`
      select count(*)::int as count from variants
      where available = true and inventory_qty <= 0 and inventory_policy = 'deny'
    `,
    sql<{ count: number }[]>`
      select count(*)::int as count from product_images where storage_path is null and source_url is not null
    `,
  ])
  const paid = orders.find((row) => row.paymentStatus === "paid")
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-semibold">Overview</h1>
      {params.stock ? <p className="text-sm">Stock policy updated.</p> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="border border-[var(--border)] p-4">
          <p className="text-xs uppercase tracking-wide">Products</p>
          <p className="mt-2 text-2xl">{products.reduce((sum, row) => sum + row.count, 0)}</p>
          <p className="text-sm">{products.map((row) => `${row.status} ${row.count}`).join(" · ")}</p>
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
      <section className="border border-[var(--border)] p-4">
        <h2 className="text-lg font-medium">Out of stock variants</h2>
        <p className="mt-2 max-w-2xl text-sm">
          {soldOut[0]?.count ?? 0} variants are at zero quantity with Shopify’s deny policy, so the shop treats them as sold out.
          The import keeps that data. Use this only if those parts are made to order.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={setStockPolicy}>
            <input type="hidden" name="mode" value="continue" />
            <button className="btn" type="submit">Allow purchase when stock is zero</button>
          </form>
          <form action={setStockPolicy}>
            <input type="hidden" name="mode" value="deny" />
            <button className="btn-ghost" type="submit">Mark zero-stock variants sold out</button>
          </form>
        </div>
      </section>
    </div>
  )
}
