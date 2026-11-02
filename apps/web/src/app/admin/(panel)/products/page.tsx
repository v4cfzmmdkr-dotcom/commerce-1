import Link from "next/link"
import { createProduct, setListed } from "@/app/admin/actions"
import { getSql } from "@/db/client"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string, show?: string, notice?: string }>
}) {
  const params = await searchParams
  const sql = getSql()
  const term = params.q?.trim() ? `%${params.q.trim().replace(/[%_]/g, "")}%` : null
  const show = params.show === "listed" || params.show === "hidden" ? params.show : null
  const search = term ? sql`and (p.title ilike ${term} or p.handle ilike ${term})` : sql``
  const listing = show === "listed" ? sql`and p.status = 'active'` : show === "hidden" ? sql`and p.status <> 'active'` : sql``
  const [products, counts] = await Promise.all([
    sql<Array<{ id: string, title: string, status: string }>>`
      select p.id, p.title, p.status
      from products p
      where true ${search} ${listing}
      order by p.updated_at desc
    `,
    sql<Array<{ listed: number, hidden: number }>>`
      select count(*) filter (where status = 'active')::int as listed, count(*) filter (where status <> 'active')::int as hidden
      from products
    `,
  ])
  const query = new URLSearchParams()
  if (params.q?.trim()) query.set("q", params.q.trim())
  if (show) query.set("show", show)
  const back = `/admin/products${query.size ? `?${query}` : ""}`
  const filterLink = (value: string | null) => {
    const next = new URLSearchParams(query)
    if (value) next.set("show", value)
    else next.delete("show")
    return `/admin/products${next.size ? `?${next}` : ""}`
  }
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold">Products</h1>
      {params.notice === "archived" ? <p className="text-sm">That product is on an order, so it was hidden instead of deleted.</p> : null}
      {params.notice === "deleted" ? <p className="text-sm">Product deleted.</p> : null}
      <form action="/admin/products" className="flex gap-2">
        <input className="field max-w-sm" name="q" defaultValue={params.q || ""} placeholder="Search title or handle" />
        {show ? <input type="hidden" name="show" value={show} /> : null}
        <button className="btn" type="submit">Search</button>
      </form>
      <form action={createProduct} className="grid gap-3 border border-[var(--border)] p-4 sm:grid-cols-[1fr_140px_auto]">
        <input className="field" name="title" placeholder="New product title" required />
        <input className="field" name="price" placeholder="18.00" required />
        <button className="btn" type="submit">Add product</button>
      </form>
      <nav className="flex gap-4 text-sm" aria-label="Filter products">
        <Link href={filterLink(null)} aria-current={show === null ? "page" : undefined} className={show === null ? "font-semibold" : ""}>
          All ({counts[0].listed + counts[0].hidden})
        </Link>
        <Link href={filterLink("listed")} aria-current={show === "listed" ? "page" : undefined} className={show === "listed" ? "font-semibold" : ""}>
          Listed ({counts[0].listed})
        </Link>
        <Link href={filterLink("hidden")} aria-current={show === "hidden" ? "page" : undefined} className={show === "hidden" ? "font-semibold" : ""}>
          Hidden ({counts[0].hidden})
        </Link>
      </nav>
      <p className="text-sm">{products.length} {products.length === 1 ? "product" : "products"}{term ? " found" : ""}</p>
      <ul className="grid gap-2">
        {products.map((product) => {
          const listed = product.status === "active"
          return (
            <li key={product.id} id={`p-${product.id}`} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 text-sm">
              <Link href={`/admin/products/${product.id}`}>{product.title}</Link>
              <form action={setListed} className="flex shrink-0 items-center gap-3">
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="listed" value={listed ? "0" : "1"} />
                <input type="hidden" name="back" value={back} />
                <span>{listed ? "Listed" : "Hidden"}</span>
                <button className="btn-ghost" type="submit">{listed ? "Hide" : "List"}</button>
              </form>
            </li>
          )
        })}
      </ul>
      <p className="text-sm"><a href="/api/admin/export/products">Export products CSV</a></p>
    </div>
  )
}
