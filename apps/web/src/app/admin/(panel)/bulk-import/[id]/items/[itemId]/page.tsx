import Link from "next/link"
import { notFound } from "next/navigation"
import { decideItems, retryFailedItems } from "@/app/admin/bulk-import-actions"
import { getSql } from "@/db/client"
import { getBatch } from "@/lib/bulk-import/batches"
import { formatGrams, formatMinutes, itemStatusLabel, licenceLabels, noticeFor } from "@/lib/bulk-import/format"
import type { PackageProduct } from "@/lib/bulk-import/schema"
import { cleanHtml } from "@/lib/html"
import { formatMoney } from "@/lib/money"
import { formatFileSize } from "@/lib/print-file-rules"

export const dynamic = "force-dynamic"

type Item = {
  id: string
  position: number
  title: string
  sku: string
  status: string
  decision: string
  blocked: boolean
  action: string
  attempts: number
  data: Partial<PackageProduct> | string
  errors: string[] | string
  warnings: string[] | string
  log: Array<{ at: string, message: string }> | string
  productId: string | null
  matchProductId: string | null
  matchTitle: string | null
  importedAt: Date | null
}

function parsed<T>(value: T | string, fallback: T): T {
  if (typeof value !== "string") return value ?? fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function ExternalLink({ href, children }: { href?: string, children: React.ReactNode }) {
  if (!href || !/^https?:\/\//i.test(href)) return <>{children}</>
  return <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
}

export default async function ImportItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string, itemId: string }>
  searchParams: Promise<{ notice?: string }>
}) {
  const { id, itemId } = await params
  const query = await searchParams
  const batch = await getBatch(id)
  if (!batch) notFound()
  const rows = await getSql()<Item[]>`
    select i.id, i.position, i.title, i.sku, i.status, i.decision, i.blocked, i.action, i.attempts, i.data, i.errors, i.warnings, i.log,
      i.product_id as "productId", i.match_product_id as "matchProductId", p.title as "matchTitle", i.imported_at as "importedAt"
    from import_batch_items i
    left join products p on p.id = i.match_product_id
    where i.id = ${itemId} and i.batch_id = ${id}
  `
  const item = rows[0]
  if (!item) notFound()
  const data = parsed<Partial<PackageProduct>>(item.data, {})
  const errors = parsed<string[]>(item.errors, [])
  const warnings = parsed<string[]>(item.warnings, [])
  const log = parsed<Array<{ at: string, message: string }>>(item.log, [])
  const [label, tone] = itemStatusLabel(item)
  const licence = data.licence ? licenceLabels[data.licence.commercial_use] : null
  const notice = noticeFor(query.notice)
  const back = `/admin/bulk-import/${id}/items/${itemId}`
  const available = Boolean(batch.packagePath)
  const preview = (path: string) => `/api/admin/bulk-import/${id}/file?path=${encodeURIComponent(path)}`
  const fileSize = (path: string) => batch.files.find((file) => file.path === path)?.size
  const reviewable = ["review", "importing", "completed"].includes(batch.status)
  const canDecide = reviewable && !item.blocked && ["ready", "queued", "failed"].includes(item.status)

  return (
    <div className="grid gap-6">
      <p className="text-sm">
        <Link href="/admin/bulk-import">Bulk Product Importer</Link>
        {" / "}
        <Link href={`/admin/bulk-import/${id}`}>{batch.packageId || batch.fileName}</Link>
      </p>
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold">{item.title}</h1>
        <div className="flex flex-wrap gap-2">
          <span className="import-chip" data-tone={tone}>{label}</span>
          {item.status !== "invalid" ? (
            <span className="import-chip" data-tone="neutral">{item.action === "update" ? "Updates existing" : "New product"}</span>
          ) : null}
          {licence ? <span className="import-chip" data-tone={licence[1]}>{licence[0]}</span> : null}
          <span className="admin-note text-sm">Product {item.position + 1} in the package</span>
        </div>
      </div>
      {notice ? <p className="text-sm" role="status">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        {canDecide ? (
          <form action={decideItems} className="flex flex-wrap gap-2">
            <input type="hidden" name="batchId" value={id} />
            <input type="hidden" name="itemIds" value={item.id} />
            <input type="hidden" name="back" value={back} />
            {item.decision !== "approved" ? <button className="btn" type="submit" name="decision" value="approved">Approve</button> : null}
            {item.decision !== "rejected" ? <button className="btn-ghost btn-tint-red" type="submit" name="decision" value="rejected">Reject</button> : null}
          </form>
        ) : null}
        {item.status === "failed" && item.decision === "approved" ? (
          <form action={retryFailedItems}>
            <input type="hidden" name="batchId" value={id} />
            <input type="hidden" name="itemIds" value={item.id} />
            <input type="hidden" name="back" value={back} />
            <button className="btn" type="submit">Retry import</button>
          </form>
        ) : null}
        {item.status === "imported" && item.productId ? <Link className="btn" href={`/admin/products/${item.productId}`}>Open product</Link> : null}
        {item.action === "update" && item.matchProductId && item.status !== "imported" ? (
          <Link className="btn-ghost" href={`/admin/products/${item.matchProductId}`}>Current listing: {item.matchTitle}</Link>
        ) : null}
      </div>

      {errors.length ? (
        <section className="admin-card grid max-w-3xl gap-2" role="alert">
          <h2>{item.status === "failed" ? "Import failed" : "Problems"}</h2>
          <ul className="import-issues" data-tone="red">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>
        </section>
      ) : null}
      {warnings.length ? (
        <section className="admin-card grid max-w-3xl gap-2">
          <h2>Check before approving</h2>
          <ul className="import-issues" data-tone="orange">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </section>
      ) : null}

      {data.images?.length ? (
        <section className="admin-card grid gap-3">
          <h2>Images</h2>
          {available ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.images.map((image) => (
                <figure key={image.path} className="grid gap-1">
                  <div className="import-thumb"><img src={preview(image.path)} alt={image.alt || data.title || ""} loading="lazy" /></div>
                  <figcaption className="text-xs">
                    <span className="block">{image.alt || <span className="admin-note">No alt text (the title is used)</span>}</span>
                    <span className="admin-note">{image.path}{fileSize(image.path) ? ` · ${formatFileSize(fileSize(image.path)!)}` : ""}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="admin-note text-sm">The package file was deleted, so previews are no longer available.</p>
          )}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="admin-card grid content-start gap-3">
          <h2>Pricing and weight</h2>
          <dl className="import-facts import-facts-wide">
            <dt>Price</dt><dd>{data.price_cents ? formatMoney(data.price_cents) : "—"} (PETG, before material markups)</dd>
            <dt>Compare at</dt><dd>{data.compare_at_price_cents ? formatMoney(data.compare_at_price_cents) : "—"}</dd>
            <dt>Shipping weight</dt><dd>{data.shipping_weight_grams ? formatGrams(data.shipping_weight_grams) : "—"}</dd>
            <dt>Filament</dt><dd>{data.print ? `${formatGrams(data.print.filament_grams)} of ${data.print.filament_type}` : "—"}</dd>
            <dt>Print time</dt><dd>{data.print ? formatMinutes(data.print.print_minutes) : "—"}</dd>
            <dt>SKU</dt><dd>{data.sku ?? item.sku}</dd>
          </dl>
        </section>
        <section className="admin-card grid content-start gap-3">
          <h2>Source and licence</h2>
          <dl className="import-facts import-facts-wide">
            <dt>Source</dt><dd><ExternalLink href={data.source?.url}>{data.source?.name ?? "—"}</ExternalLink></dd>
            <dt>Source ID</dt><dd>{data.external_id ?? "—"}</dd>
            <dt>Creator</dt><dd><ExternalLink href={data.creator?.url}>{data.creator?.name ?? "—"}</ExternalLink></dd>
            <dt>Licence</dt><dd><ExternalLink href={data.licence?.url}>{data.licence?.name ?? "—"}</ExternalLink></dd>
            <dt>Commercial use</dt><dd>{licence ? licence[0] : "—"}</dd>
            <dt>Attribution</dt><dd>{data.licence?.attribution_required ? "Required" : "Not required"}</dd>
            {data.licence?.notes ? <><dt>Notes</dt><dd>{data.licence.notes}</dd></> : null}
          </dl>
        </section>
      </div>

      <section className="admin-card grid gap-3">
        <h2>Listing</h2>
        <dl className="import-facts import-facts-wide">
          <dt>Category</dt><dd>{data.category ?? "—"}</dd>
          <dt>Tags</dt><dd>{data.tags?.length ? data.tags.join(", ") : "—"}</dd>
          <dt>Handle</dt><dd>{data.handle ?? "Made from the title"}</dd>
          <dt>SEO title</dt><dd>{data.seo?.title || data.title} <span className="admin-note">({(data.seo?.title || data.title || "").length} characters)</span></dd>
          <dt>SEO description</dt><dd>{data.seo?.description || "—"} <span className="admin-note">({data.seo?.description?.length ?? 0} characters)</span></dd>
        </dl>
        {data.description_html ? (
          <div className="admin-inset prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: cleanHtml(data.description_html) }} />
        ) : null}
      </section>

      {data.models?.length ? (
        <section className="admin-card grid gap-3">
          <h2>3D print files</h2>
          <ul className="admin-list p-0">
            {data.models.map((model) => (
              <li key={model.path} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {available ? <a href={preview(model.path)}>{model.path}</a> : model.path}
                  {model.notes ? <span className="admin-note block text-xs">{model.notes}</span> : null}
                </span>
                <span className="admin-note shrink-0">
                  {model.copies > 1 ? `${model.copies} copies · ` : ""}{fileSize(model.path) ? formatFileSize(fileSize(model.path)!) : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {log.length ? (
        <section className="admin-card grid max-w-3xl gap-2">
          <h2>Import log</h2>
          <ul className="grid gap-1 text-sm">
            {log.map((entry, index) => (
              <li key={index}><span className="admin-note">{new Date(entry.at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "medium" })}</span> {entry.message}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
