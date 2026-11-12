import Link from "next/link"
import { notFound } from "next/navigation"
import {
  approveAllItems,
  decideItems,
  deleteImport,
  pauseImport,
  rejectPendingItems,
  removeImportPackage,
  retryFailedItems,
  startImport,
} from "@/app/admin/bulk-import-actions"
import { BulkImportRunner } from "@/components/bulk-import-runner"
import { PendingButton } from "@/components/pending-button"
import { SelectAll } from "@/components/select-all"
import { getSql } from "@/db/client"
import { batchCounts, getBatch } from "@/lib/bulk-import/batches"
import { batchStatusLabels, formatGrams, formatMinutes, itemStatusLabel, licenceLabels, noticeFor } from "@/lib/bulk-import/format"
import { queueRemaining } from "@/lib/bulk-import/process"
import { formatMoney } from "@/lib/money"
import { formatFileSize } from "@/lib/print-file-rules"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const pageSize = 48

const filters = {
  all: "All",
  review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
  invalid: "Invalid",
  failed: "Failed",
  imported: "Imported",
} as const

type Filter = keyof typeof filters

function filterWhere(sql: ReturnType<typeof getSql>, show: Filter) {
  if (show === "review") return sql`i.decision = 'pending' and i.status <> 'invalid'`
  if (show === "approved") return sql`i.decision = 'approved'`
  if (show === "rejected") return sql`i.decision = 'rejected'`
  if (show === "invalid") return sql`i.status = 'invalid'`
  if (show === "failed") return sql`i.status = 'failed'`
  if (show === "imported") return sql`i.status = 'imported'`
  return sql`true`
}

type ItemRow = {
  id: string
  position: number
  title: string
  sku: string
  status: string
  decision: string
  blocked: boolean
  action: string
  productId: string | null
  matchTitle: string | null
  thumbnail: string | null
  priceCents: number | null
  weightGrams: number | null
  filamentType: string | null
  filamentGrams: number | null
  printMinutes: number | null
  commercialUse: string | null
  category: string | null
  imageCount: number | null
  modelCount: number | null
  errorCount: number
  warningCount: number
  firstError: string | null
}

export default async function BatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ show?: string, page?: string, notice?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const batch = await getBatch(id)
  if (!batch) notFound()
  const show: Filter = query.show && query.show in filters ? query.show as Filter : "all"
  const page = Math.max(1, Math.floor(Number(query.page) || 1))
  const sql = getSql()
  const [counts, remaining, totals] = await Promise.all([
    batchCounts(id),
    queueRemaining(id),
    sql<Array<{ count: number }>>`select count(*)::int as count from import_batch_items i where i.batch_id = ${id} and ${filterWhere(sql, show)}`,
  ])
  const items = await sql<ItemRow[]>`
    select i.id, i.position, i.title, i.sku, i.status, i.decision, i.blocked, i.action, i.product_id as "productId",
      p.title as "matchTitle",
      i.data->'images'->0->>'path' as thumbnail,
      (i.data->>'price_cents')::int as "priceCents",
      (i.data->>'shipping_weight_grams')::int as "weightGrams",
      i.data->'print'->>'filament_type' as "filamentType",
      (i.data->'print'->>'filament_grams')::float8 as "filamentGrams",
      (i.data->'print'->>'print_minutes')::int as "printMinutes",
      i.data->'licence'->>'commercial_use' as "commercialUse",
      i.data->>'category' as category,
      jsonb_array_length(coalesce(i.data->'images', '[]'::jsonb)) as "imageCount",
      jsonb_array_length(coalesce(i.data->'models', '[]'::jsonb)) as "modelCount",
      jsonb_array_length(i.errors) as "errorCount",
      jsonb_array_length(i.warnings) as "warningCount",
      i.errors->>0 as "firstError"
    from import_batch_items i
    left join products p on p.id = i.match_product_id
    where i.batch_id = ${id} and ${filterWhere(sql, show)}
    order by i.position
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `
  const pages = Math.max(1, Math.ceil(totals[0].count / pageSize))
  const link = (next: { show?: Filter, page?: number }) => {
    const search = new URLSearchParams()
    const nextShow = next.show ?? show
    if (nextShow !== "all") search.set("show", nextShow)
    const nextPage = next.page ?? (next.show ? 1 : page)
    if (nextPage > 1) search.set("page", String(nextPage))
    return `/admin/bulk-import/${id}${search.size ? `?${search}` : ""}`
  }
  const back = link({})
  const [statusLabel, statusTone] = batchStatusLabels[batch.status] ?? [batch.status, "neutral"]
  const notice = noticeFor(query.notice)
  const preview = (path: string) => `/api/admin/bulk-import/${id}/file?path=${encodeURIComponent(path)}`
  const importing = batch.status === "importing"
  const reviewable = batch.status === "review" || batch.status === "importing" || batch.status === "completed"

  return (
    <div className="grid gap-6">
      <p className="text-sm"><Link href="/admin/bulk-import">Bulk Product Importer</Link></p>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{batch.packageId || batch.fileName}</h1>
          <span className="import-chip" data-tone={statusTone}>{statusLabel}</span>
        </div>
        <p className="admin-note text-sm">
          {batch.fileName} · {formatFileSize(batch.packageBytes)} · uploaded {new Date(batch.createdAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
          {batch.createdBy ? ` by ${batch.createdBy}` : ""}
          {batch.schemaVersion ? ` · schema ${batch.schemaVersion}` : ""}
          {batch.generator ? ` · ${batch.generator}` : ""}
        </p>
      </div>
      {notice ? <p className="text-sm" role="status">{notice}</p> : null}

      {batch.status === "uploading" ? (
        <section className="admin-card grid max-w-3xl gap-2">
          <h2>Upload not finished</h2>
          <p className="text-sm">This package never finished uploading. Delete it and upload the file again.</p>
        </section>
      ) : null}

      {batch.errors.length ? (
        <section className="admin-card grid max-w-3xl gap-2" role="alert">
          <h2>Package rejected</h2>
          <p className="text-sm">Nothing was imported. Fix these problems in the sourcing app and upload a new package.</p>
          <ul className="import-issues" data-tone="red">
            {batch.errors.map((error, index) => <li key={index}>{error}</li>)}
          </ul>
        </section>
      ) : null}

      {batch.warnings.length ? (
        <details className="admin-card admin-disclosure max-w-3xl">
          <summary>{batch.warnings.length} package {batch.warnings.length === 1 ? "note" : "notes"}</summary>
          <ul className="import-issues mt-3" data-tone="orange">
            {batch.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </details>
      ) : null}

      {counts.total ? (
        <div className="import-stats">
          <article className="admin-card"><p className="admin-stat-label">Products</p><p className="admin-stat-value">{counts.total}</p></article>
          <article className="admin-card"><p className="admin-stat-label">New</p><p className="admin-stat-value">{counts.creates}</p></article>
          <article className="admin-card"><p className="admin-stat-label">Updates</p><p className="admin-stat-value">{counts.updates}</p></article>
          <article className="admin-card"><p className="admin-stat-label">Invalid</p><p className="admin-stat-value">{counts.invalid}</p></article>
          <article className="admin-card"><p className="admin-stat-label">Approved</p><p className="admin-stat-value">{counts.approved}</p></article>
          <article className="admin-card"><p className="admin-stat-label">Imported</p><p className="admin-stat-value">{counts.imported}</p></article>
          <article className="admin-card"><p className="admin-stat-label">Failed</p><p className="admin-stat-value">{counts.failed}</p></article>
        </div>
      ) : null}

      {reviewable && counts.total ? (
        <section className="admin-card grid max-w-3xl gap-4">
          <h2>Import progress</h2>
          {counts.approved ? (
            <BulkImportRunner
              batchId={id}
              active={importing}
              initial={{ imported: counts.imported, failed: counts.failed, approved: counts.approved, remaining }}
            />
          ) : (
            <p className="admin-note text-sm">Approve products below, then start the import.</p>
          )}
          {counts.approvedReady ? (
            <form action={startImport} className="grid gap-3">
              <input type="hidden" name="batchId" value={id} />
              <input type="hidden" name="back" value={back} />
              <label className="flex items-center gap-2 text-sm normal-case">
                <input type="checkbox" name="publish" defaultChecked={batch.publish} />
                List new products on the shop straight away (updated products keep their current listing)
              </label>
              <div>
                <PendingButton pendingText="Queueing…">
                  Import {counts.approvedReady} approved {counts.approvedReady === 1 ? "product" : "products"}
                </PendingButton>
              </div>
            </form>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {importing ? (
              <form action={pauseImport}>
                <input type="hidden" name="batchId" value={id} />
                <input type="hidden" name="back" value={back} />
                <button className="btn-ghost" type="submit">Pause import</button>
              </form>
            ) : null}
            {counts.failed ? (
              <form action={retryFailedItems}>
                <input type="hidden" name="batchId" value={id} />
                <input type="hidden" name="back" value={back} />
                <button className="btn-ghost" type="submit">Retry {counts.failed} failed</button>
              </form>
            ) : null}
          </div>
        </section>
      ) : null}

      {counts.total ? (
        <section className="grid gap-4">
          <nav className="admin-segmented" aria-label="Filter products">
            {(Object.keys(filters) as Filter[]).map((key) => (
              <Link key={key} href={link({ show: key })} aria-current={show === key ? "page" : undefined} className="admin-segment">
                {filters[key]}
              </Link>
            ))}
          </nav>
          <form id="import-items" action={decideItems} className="grid gap-4">
            <input type="hidden" name="batchId" value={id} />
            <input type="hidden" name="back" value={back} />
            {reviewable ? (
              <div className="import-toolbar">
                <SelectAll form="import-items" name="itemIds" label="Select this page" />
                <button className="btn-ghost btn-tint-blue" type="submit" name="decision" value="approved">Approve selected</button>
                <button className="btn-ghost btn-tint-red" type="submit" name="decision" value="rejected">Reject selected</button>
                <button className="btn-ghost" type="submit" formAction={approveAllItems}>Approve all valid ({counts.pending})</button>
                <button className="btn-ghost" type="submit" formAction={rejectPendingItems}>Reject all unreviewed</button>
              </div>
            ) : null}
            <p className="admin-note text-sm">
              {totals[0].count} {totals[0].count === 1 ? "product" : "products"}
              {pages > 1 ? `, page ${page} of ${pages}` : ""}
            </p>
            <ul className="import-grid">
              {items.map((item) => {
                const [label, tone] = itemStatusLabel(item)
                const licence = item.commercialUse ? licenceLabels[item.commercialUse] : null
                const locked = item.status === "invalid" || item.status === "imported" || item.status === "processing" || item.blocked
                return (
                  <li key={item.id} className="import-card">
                    <label className="import-select">
                      <input type="checkbox" name="itemIds" value={item.id} disabled={locked || !reviewable} aria-label={`Select ${item.title}`} />
                    </label>
                    <Link href={`/admin/bulk-import/${id}/items/${item.id}`} className="import-card-link">
                      <div className="import-thumb">
                        {item.thumbnail && batch.packagePath ? (
                          <img src={preview(item.thumbnail)} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="admin-note text-xs">No preview</span>
                        )}
                      </div>
                      <div className="grid gap-2 p-3">
                        <div className="flex flex-wrap gap-1">
                          <span className="import-chip" data-tone={tone}>{label}</span>
                          {item.status !== "invalid" ? (
                            <span className="import-chip" data-tone="neutral">{item.action === "update" ? "Updates existing" : "New product"}</span>
                          ) : null}
                        </div>
                        <p className="import-card-title">{item.title}</p>
                        <dl className="import-facts">
                          <dt>Price</dt><dd>{item.priceCents ? formatMoney(item.priceCents) : "—"}</dd>
                          <dt>Ships at</dt><dd>{item.weightGrams ? formatGrams(item.weightGrams) : "—"}</dd>
                          <dt>Filament</dt><dd>{item.filamentGrams ? `${formatGrams(item.filamentGrams)} ${item.filamentType ?? ""}` : "—"}</dd>
                          <dt>Print time</dt><dd>{item.printMinutes ? formatMinutes(item.printMinutes) : "—"}</dd>
                          <dt>SKU</dt><dd className="truncate">{item.sku || "—"}</dd>
                          <dt>Files</dt><dd>{item.imageCount ?? 0} images, {item.modelCount ?? 0} models</dd>
                        </dl>
                        {licence ? <span className="import-chip w-fit" data-tone={licence[1]}>{licence[0]}</span> : null}
                        {item.action === "update" && item.matchTitle ? <p className="admin-note text-xs">Updates “{item.matchTitle}”</p> : null}
                        {item.firstError ? (
                          <p className="text-xs text-[#ff3b30]">{item.firstError}{item.errorCount > 1 ? ` (+${item.errorCount - 1} more)` : ""}</p>
                        ) : item.warningCount ? (
                          <p className="admin-note text-xs">{item.warningCount} {item.warningCount === 1 ? "note" : "notes"} to check</p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </form>
          {pages > 1 ? (
            <nav className="flex items-center gap-3 text-sm" aria-label="Pages">
              {page > 1 ? <Link className="btn-ghost" href={link({ page: page - 1 })}>Previous</Link> : null}
              <span className="admin-note">Page {page} of {pages}</span>
              {page < pages ? <Link className="btn-ghost" href={link({ page: page + 1 })}>Next</Link> : null}
            </nav>
          ) : null}
        </section>
      ) : null}

      <section className="admin-card grid max-w-3xl gap-3">
        <h2>Package file</h2>
        <p className="admin-note text-sm">
          {batch.packagePath
            ? "The ZIP stays in private storage so products can be previewed, retried and resumed. Delete it once the import is finished to free space."
            : "The package file has been deleted. The import history is kept."}
        </p>
        <div className="flex flex-wrap gap-2">
          {batch.packagePath && !importing && counts.imported ? (
            <form action={removeImportPackage}>
              <input type="hidden" name="batchId" value={id} />
              <input type="hidden" name="back" value={back} />
              <button className="btn-ghost" type="submit">Delete package file</button>
            </form>
          ) : null}
          {!counts.imported && !importing ? (
            <form action={deleteImport}>
              <input type="hidden" name="batchId" value={id} />
              <input type="hidden" name="back" value={back} />
              <button className="btn-ghost btn-tint-red" type="submit">Delete this import</button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  )
}
