import Link from "next/link"
import { ProductGrid } from "@/components/product-grid"
import type { ProductCard } from "@/lib/catalog"

export function CatalogView({
  title,
  descriptionHtml,
  products,
  total,
  page,
  pageCount,
  tags,
  currency,
  basePath,
  query,
}: {
  title: string
  descriptionHtml?: string
  products: ProductCard[]
  total: number
  page: number
  pageCount: number
  tags: Array<{ tag: string, count: number }>
  currency: string
  basePath: string
  query: Record<string, string | undefined>
}) {
  const href = (nextPage: number, extra?: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const merged = { ...query, ...extra, page: String(nextPage) }
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value)
    }
    const text = params.toString()
    return text ? `${basePath}?${text}` : basePath
  }

  return (
    <div className="wrap grid gap-8 py-[var(--section)] lg:grid-cols-[220px_1fr]">
      <form action={basePath} className="grid content-start gap-4">
        <label className="label">
          Search
          <input className="field normal-case" name="q" defaultValue={query.q || ""} />
        </label>
        <label className="label">
          Sort
          <select className="select normal-case" name="sort" defaultValue={query.sort || "newest"}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
            <option value="title">Name</option>
          </select>
        </label>
        <label className="label">
          Tag
          <select className="select normal-case" name="tag" defaultValue={query.tag || ""}>
            <option value="">Any</option>
            {tags.map((tag) => (
              <option key={tag.tag} value={tag.tag}>{tag.tag}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="label">
            Min $
            <input className="field normal-case" name="min" inputMode="decimal" defaultValue={query.min || ""} />
          </label>
          <label className="label">
            Max $
            <input className="field normal-case" name="max" inputMode="decimal" defaultValue={query.max || ""} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm normal-case">
          <input type="checkbox" name="stock" value="1" defaultChecked={query.stock === "1"} />
          In stock only
        </label>
        <button className="btn" type="submit">Apply</button>
      </form>
      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm">{total} parts</p>
          </div>
        </div>
        {descriptionHtml ? (
          <div className="prose mb-8 max-w-2xl text-sm" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
        ) : null}
        <ProductGrid products={products} currency={currency} />
        {pageCount > 1 ? (
          <nav className="mt-8 flex items-center gap-3 text-sm" aria-label="Pagination">
            {page > 1 ? <Link className="nav-link" href={href(page - 1)}>Previous</Link> : null}
            <span>Page {page} of {pageCount}</span>
            {page < pageCount ? <Link className="nav-link" href={href(page + 1)}>Next</Link> : null}
          </nav>
        ) : null}
      </section>
    </div>
  )
}
