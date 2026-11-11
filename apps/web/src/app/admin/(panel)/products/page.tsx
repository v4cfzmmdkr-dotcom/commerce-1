import Link from "next/link"
import { copyListing, createProduct, deleteProduct, runImport, setListed } from "@/app/admin/actions"
import { ImageDownload } from "@/components/image-download"
import { PendingButton } from "@/components/pending-button"
import { SwipeToDelete } from "@/components/swipe-to-delete"
import { getSql } from "@/db/client"
import { remoteImageCount } from "@/lib/shopify/import"
import type { ImportReport } from "@/lib/types"

export const maxDuration = 60

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string, show?: string, notice?: string, listingError?: string, run?: string, collections?: string, collectionError?: string }>
}) {
  const params = await searchParams
  const sql = getSql()
  const term = params.q?.trim() ? `%${params.q.trim().replace(/[%_]/g, "")}%` : null
  const show = params.show === "listed" || params.show === "hidden" ? params.show : null
  const search = term ? sql`and (p.title ilike ${term} or p.handle ilike ${term})` : sql``
  const listing = show === "listed" ? sql`and p.status = 'active'` : show === "hidden" ? sql`and p.status <> 'active'` : sql``
  const [products, counts, remoteImages, runs] = await Promise.all([
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
    remoteImageCount(),
    params.run ? sql<Array<{ report: ImportReport }>>`select report from import_runs where id = ${params.run}` : [],
  ])
  const pendingImages = remoteImages
  const report = runs[0]?.report
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
      <form action={copyListing} className="admin-card grid gap-3">
        <div>
          <h2>Copy a listing</h2>
          <p className="admin-note mt-1 text-sm">Paste a Shopify product link or an eBay listing link. The title, description, price, options, and photos are copied into a new product.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input className="field normal-case" name="url" type="url" inputMode="url" required placeholder="https://store.com/products/… or https://www.ebay.com.au/itm/…" aria-label="Listing link" />
          <PendingButton pendingText="Copying…">Copy listing</PendingButton>
        </div>
        <label className="flex items-center gap-2 text-sm normal-case">
          <input type="checkbox" name="list" />
          List it on the shop straight away
        </label>
        {params.listingError ? <p className="text-sm" role="alert">{params.listingError}</p> : null}
      </form>
      <form action={createProduct} className="admin-card grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <input className="field" name="title" placeholder="New product title" required />
        <input className="field" name="price" placeholder="18.00" required />
        <button className="btn" type="submit">Add product</button>
      </form>
      <nav className="admin-segmented" aria-label="Filter products">
        <Link href={filterLink(null)} aria-current={show === null ? "page" : undefined} className="admin-segment">
          All ({counts[0].listed + counts[0].hidden})
        </Link>
        <Link href={filterLink("listed")} aria-current={show === "listed" ? "page" : undefined} className="admin-segment">
          Listed ({counts[0].listed})
        </Link>
        <Link href={filterLink("hidden")} aria-current={show === "hidden" ? "page" : undefined} className="admin-segment">
          Hidden ({counts[0].hidden})
        </Link>
      </nav>
      <p className="admin-note text-sm">{products.length} {products.length === 1 ? "product" : "products"}{term ? " found" : ""}</p>
      <ul className="admin-list">
        {products.map((product) => {
          const listed = product.status === "active"
          return (
            <SwipeToDelete
              key={product.id}
              id={`p-${product.id}`}
              action={deleteProduct}
              fields={{ id: product.id, back }}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <Link className="admin-row-link" href={`/admin/products/${product.id}`}>{product.title}</Link>
              <form action={setListed} className="flex shrink-0 items-center gap-3">
                <input type="hidden" name="id" value={product.id} />
                <input type="hidden" name="listed" value={listed ? "0" : "1"} />
                <input type="hidden" name="back" value={back} />
                <span className="admin-note">{listed ? "Listed" : "Hidden"}</span>
                <button className={`btn-ghost ${listed ? "btn-tint-blue" : "btn-tint-red"}`} type="submit">{listed ? "Hide" : "List"}</button>
              </form>
            </SwipeToDelete>
          )
        })}
      </ul>
      <p className="text-sm"><a href="/api/admin/export/products">Export products CSV</a></p>
      <details id="import" className="admin-card admin-disclosure" open={Boolean(params.run || params.collectionError || pendingImages)}>
        <summary>Import a Shopify CSV</summary>
        <div className="grid gap-4 pt-3">
          <p className="admin-note text-sm">
            Products are matched by handle, so importing the same file again updates them. Images are copied into this shop&apos;s storage. A large catalogue should also be imported with the local command so every image can finish.
          </p>
          <form action={runImport} className="grid gap-3">
            <input name="file" type="file" accept=".csv,text/csv" required aria-label="Shopify product CSV" />
            <label className="flex items-center gap-2 text-sm normal-case"><input type="checkbox" name="images" defaultChecked /> Download a batch of images now</label>
            <label className="flex items-center gap-2 text-sm normal-case"><input type="checkbox" name="collections" defaultChecked /> Sync collections from the store</label>
            <label className="label">Store URL<input className="field normal-case" name="storeUrl" defaultValue="https://nicheparts.com.au" /></label>
            <div><PendingButton pendingText="Importing…">Import CSV</PendingButton></div>
          </form>
          {params.collections ? <p className="text-sm" role="status">Synced {params.collections} collections.</p> : null}
          {params.collectionError ? <p className="text-sm" role="alert">{params.collectionError}</p> : null}
          {report ? (
            <section className="grid gap-1 text-sm" role="status">
              <h3 className="font-medium">Last import</h3>
              <p>Created {report.productsCreated}, updated {report.productsUpdated}, skipped {report.productsSkipped}, variants {report.variantsImported}.</p>
              <p>Images waiting {report.imagesPending}. Failures {report.failures.length}. Warnings {report.warnings.length}.</p>
              <ul>
                {report.failures.slice(0, 20).map((issue, index) => (
                  <li key={index}>Record {issue.record} {issue.handle}: {issue.message}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {pendingImages ? (
            <div className="grid gap-2">
              <p className="text-sm">{pendingImages} {pendingImages === 1 ? "image is" : "images are"} still hosted on Shopify.</p>
              <ImageDownload pending={pendingImages} />
            </div>
          ) : null}
        </div>
      </details>
    </div>
  )
}
