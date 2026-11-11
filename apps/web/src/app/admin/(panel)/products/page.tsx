import Link from "next/link"
import type { CSSProperties } from "react"
import { copyListing, createProduct, deleteProduct, runImport, setListed } from "@/app/admin/actions"
import { saveMaterialsAndColours } from "@/app/admin/option-actions"
import { ImageDownload } from "@/components/image-download"
import { PendingButton } from "@/components/pending-button"
import { ColourPaletteChips } from "@/components/colour-palette-chips"
import { SwipeToDelete } from "@/components/swipe-to-delete"
import { getSql } from "@/db/client"
import { defaultMaterial, materialColourRules, materialOptions } from "@/lib/product-options"
import { getSettings } from "@/lib/settings"
import { remoteImageCount } from "@/lib/shopify/import"
import type { ImportReport } from "@/lib/types"

export const maxDuration = 60

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string, show?: string, notice?: string, listingError?: string, colours?: string, added?: string, materials?: string, repriced?: string, materialError?: string, run?: string, collections?: string, collectionError?: string }>
}) {
  const params = await searchParams
  const sql = getSql()
  const term = params.q?.trim() ? `%${params.q.trim().replace(/[%_]/g, "")}%` : null
  const show = params.show === "listed" || params.show === "hidden" ? params.show : null
  const search = term ? sql`and (p.title ilike ${term} or p.handle ilike ${term})` : sql``
  const listing = show === "listed" ? sql`and p.status = 'active'` : show === "hidden" ? sql`and p.status <> 'active'` : sql``
  const added = Number(params.added) || 0
  const repriced = Number(params.repriced) || 0
  const [products, counts, settings, remoteImages, runs] = await Promise.all([
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
    getSettings(),
    remoteImageCount(),
    params.run ? sql<Array<{ report: ImportReport }>>`select report from import_runs where id = ${params.run}` : [],
  ])
  const pendingImages = remoteImages
  const colourRules = materialColourRules(settings.colours, settings.materials)
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
      <form action={saveMaterialsAndColours} className="admin-card grid gap-4">
        <div>
          <h2>Materials and colours</h2>
          <p className="admin-note mt-1 text-sm">
            Switching a material on offers it on every product. Switch it off to hide it everywhere. Tick the colours each material comes in; new colours are added to every product at the same price as Black. To leave a material off one product, untick it on that product&apos;s edit page.
          </p>
        </div>
        <div className="grid gap-5">
          {materialOptions.map((material) => {
            const setting = settings.materials.find((item) => item.name === material.name)
            const isBase = material.name === defaultMaterial
            const chosen = colourRules[material.name] ?? []
            return (
              <div key={material.name} className="material-block grid gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="colour-chip material-chip">
                    <input type="checkbox" name="materials" value={material.name} defaultChecked={setting?.enabled !== false} />
                    <span className="font-medium">{material.name}</span>
                  </label>
                  {isBase ? (
                    <span className="admin-note text-sm">Base price</span>
                  ) : (
                    <label className="flex items-center gap-2 whitespace-nowrap text-sm normal-case">
                      Markup over PETG ($)
                      <input
                        className="field w-28 normal-case"
                        name={`markup_${material.name}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        defaultValue={((setting?.markupCents ?? 0) / 100).toFixed(2)}
                        aria-label={`${material.name} markup over PETG`}
                      />
                    </label>
                  )}
                </div>
                {isBase ? (
                  <>
                    <ColourPaletteChips
                      key={settings.colours.map((colour) => colour.name).join("|")}
                      colours={settings.colours}
                      name={`colours_${material.name}`}
                    />
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="label max-w-xs flex-1">
                        Add a colour
                        <input className="field normal-case" name="newName" maxLength={30} placeholder="Olive" />
                      </label>
                      <input className="colour-picker" type="color" name="newHex" defaultValue="#6b8e23" aria-label="Swatch for the new colour" />
                    </div>
                  </>
                ) : (
                  <fieldset className="colour-chips">
                    <legend className="sr-only">{material.name} colours</legend>
                    {settings.colours.map((colour) => (
                      <label key={colour.name} className="colour-chip" data-colour={colour.name}>
                        <input
                          type="checkbox"
                          name={`colours_${material.name}`}
                          value={colour.name}
                          defaultChecked={chosen.includes(colour.name)}
                        />
                        <span className="colour-chip-dot" style={{ "--swatch": colour.hex } as CSSProperties} aria-hidden />
                        {colour.name}
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            )
          })}
        </div>
        <p className="admin-note text-sm">
          Drag a PETG colour by its handle to rearrange the colours everywhere, including on product pages. A new colour is switched on for PETG and can then be ticked for other materials. Removing a colour with × takes it off every material. Saving updates the price of every non-PETG option to its PETG price plus the markup.
        </p>
        {params.colours === "removed" ? <p className="text-sm" role="status">Colour removed.</p> : null}
        {params.materials === "saved" ? (
          <p className="text-sm" role="status">
            Saved{repriced ? `, ${repriced} ${repriced === 1 ? "price" : "prices"} updated` : ""}{added ? `, ${added} new ${added === 1 ? "variant" : "variants"} added` : ""}.
          </p>
        ) : null}
        {params.materialError ? <p className="text-sm" role="alert">{params.materialError}</p> : null}
        <div>
          <PendingButton pendingText="Saving…">Save materials and colours</PendingButton>
        </div>
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
