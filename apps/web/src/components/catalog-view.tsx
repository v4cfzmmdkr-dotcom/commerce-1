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
  brands,
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
  brands: Array<{ slug: string, name: string, count: number }>
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

  const activeFilters = [query.q, query.tag, query.brand, query.min, query.max, query.sort && query.sort !== "newest" ? query.sort : undefined]
    .filter(Boolean).length

  return (
    <div className="wrap-wide py-[var(--section)]">
      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm">{total} parts</p>
          </div>
          <details className="catalog-filters">
            <summary className="catalog-filters-toggle" aria-label={activeFilters > 0 ? `Filters, ${activeFilters} active` : "Filters"}>
              <FiltersIcon />
              <span>Filters</span>
              {activeFilters > 0 ? <span className="catalog-filters-count">{activeFilters}</span> : null}
            </summary>
            <form action={basePath} className="catalog-filters-panel grid content-start gap-4">
              <label className="label">
                Search
                <input className="field normal-case" name="q" defaultValue={query.q || ""} />
              </label>
              {brands.length > 0 ? (
                <label className="label">
                  Fits brand
                  <select className="select normal-case" name="brand" defaultValue={query.brand || ""}>
                    <option value="">Any brand</option>
                    {brands.map((brand) => (
                      <option key={brand.slug} value={brand.slug}>{brand.name} ({brand.count})</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="label">
                Sort
                <select className="select normal-case" name="sort" defaultValue={query.sort || "newest"}>
                  <option value="newest">Newest</option>
                  <option value="price-asc">Price, low to high</option>
                  <option value="price-desc">Price, high to low</option>
                  <option value="title">Name</option>
                </select>
              </label>
              {tags.length > 0 ? (
                <label className="label">
                  Tag
                  <select className="select normal-case" name="tag" defaultValue={query.tag || ""}>
                    <option value="">Any</option>
                    {tags.map((tag) => (
                      <option key={tag.tag} value={tag.tag}>{tag.tag}</option>
                    ))}
                  </select>
                </label>
              ) : null}
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
              <button className="btn" type="submit">Apply</button>
              {activeFilters > 0 ? <Link className="text-center text-sm" href={basePath}>Clear filters</Link> : null}
            </form>
          </details>
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

function FiltersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 5h12.2a2.5 2.5 0 0 1 4.6 0H21v1.6h-1.2a2.5 2.5 0 0 1-4.6 0H3zm14.5 1.8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM3 11.2h1.2a2.5 2.5 0 0 1 4.6 0H21v1.6H8.8a2.5 2.5 0 0 1-4.6 0H3zm3.5 1.8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM3 17.4h9.2a2.5 2.5 0 0 1 4.6 0H21V19h-4.2a2.5 2.5 0 0 1-4.6 0H3zm11.5 1.8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    </svg>
  )
}
