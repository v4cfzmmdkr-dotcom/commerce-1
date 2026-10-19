import Link from "next/link"
import { createProduct } from "@/app/admin/actions"
import { getSql } from "@/db/client"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string, notice?: string }>
}) {
  const params = await searchParams
  const sql = getSql()
  const term = params.q?.trim() ? `%${params.q.trim().replace(/[%_]/g, "")}%` : null
  const products = term
    ? await sql<Array<{ id: string, title: string, handle: string, status: string, price: number | null }>>`
        select p.id, p.title, p.handle, p.status, min(v.price_cents) as price
        from products p
        left join variants v on v.product_id = p.id
        where p.title ilike ${term} or p.handle ilike ${term}
        group by p.id
        order by p.updated_at desc
        limit 50
      `
    : await sql<Array<{ id: string, title: string, handle: string, status: string, price: number | null }>>`
        select p.id, p.title, p.handle, p.status, min(v.price_cents) as price
        from products p
        left join variants v on v.product_id = p.id
        group by p.id
        order by p.updated_at desc
        limit 50
      `
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold">Products</h1>
      {params.notice === "archived" ? <p className="text-sm">That product is on an order, so it was archived instead of deleted.</p> : null}
      {params.notice === "deleted" ? <p className="text-sm">Product deleted.</p> : null}
      <form action="/admin/products" className="flex gap-2">
        <input className="field max-w-sm" name="q" defaultValue={params.q || ""} placeholder="Search title or handle" />
        <button className="btn" type="submit">Search</button>
      </form>
      <form action={createProduct} className="grid gap-3 border border-[var(--border)] p-4 sm:grid-cols-[1fr_140px_auto]">
        <input className="field" name="title" placeholder="New product title" required />
        <input className="field" name="price" placeholder="18.00" required />
        <button className="btn" type="submit">Add product</button>
      </form>
      <ul className="grid gap-2">
        {products.map((product) => (
          <li key={product.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 text-sm">
            <Link href={`/admin/products/${product.id}`}>{product.title}</Link>
            <span>{product.status}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm"><a href="/api/admin/export/products">Export products CSV</a></p>
    </div>
  )
}
