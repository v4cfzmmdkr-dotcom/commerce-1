import Link from "next/link"
import {
  archivePreviousListingsAction,
  restorePreviousListingsAction,
  revokeConnectedAppKey,
} from "@/app/admin/bulk-import-actions"
import { BulkImportUpload } from "@/components/bulk-import-upload"
import { ConnectedAppKey } from "@/components/connected-app-key"
import { databaseConfigured } from "@/db/client"
import { listApiKeys } from "@/lib/api-keys"
import { previousListingSummary } from "@/lib/bulk-import/archive"
import { listBatches } from "@/lib/bulk-import/batches"
import { batchStatusLabels } from "@/lib/bulk-import/format"
import { packageStorageSupported } from "@/lib/bulk-import/package-store"
import { limits } from "@/lib/bulk-import/schema"
import { formatFileSize } from "@/lib/print-file-rules"
import { siteUrl } from "@/lib/site"

function when(date: Date | null) {
  return date ? new Date(date).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) : "Never"
}

export const dynamic = "force-dynamic"
export const maxDuration = 60

export default async function BulkImportPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams
  const [batches, keys, previous] = databaseConfigured()
    ? await Promise.all([listBatches(), listApiKeys(), previousListingSummary()])
    : [[], [], null]
  const activeKeys = keys.filter((key) => !key.revokedAt)
  const archived = /^archived-(\d+)$/.exec(params.notice ?? "")?.[1]
  const restored = /^restored-(\d+)$/.exec(params.notice ?? "")?.[1]
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Bulk Product Importer</h1>
        <p className="admin-note mt-2 max-w-3xl text-sm">
          Upload a product package from the sourcing app. Every product is checked and shown here first, and nothing reaches the
          shop until you approve it. Products already imported from the same source, or with the same SKU, are updated instead of duplicated.
        </p>
      </div>
      {params.notice === "deleted" ? <p className="text-sm" role="status">Import deleted.</p> : null}
      {params.notice === "key-revoked" ? <p className="text-sm" role="status">Key revoked. Apps using it can no longer upload.</p> : null}
      {archived ? <p className="text-sm" role="status">{archived} previous listings archived. They are hidden from the shop.</p> : null}
      {restored ? <p className="text-sm" role="status">{restored} listings restored to how they were.</p> : null}
      {params.notice === "archive-unconfirmed" ? <p className="text-sm" role="alert">Tick the box to confirm before archiving.</p> : null}
      <section className="admin-card grid max-w-3xl gap-3">
        <h2>Upload package</h2>
        {packageStorageSupported() ? (
          <BulkImportUpload maxBytes={limits.packageBytes} />
        ) : (
          <p className="text-sm" role="alert">Bulk import needs Neon object storage. Set the STORAGE_* settings, then reload this page.</p>
        )}
        <p className="admin-note text-sm">
          Up to {limits.products} products per package. Images: JPEG, PNG or WebP up to {formatFileSize(limits.imageBytes)}.
          Print files: STL or 3MF up to {formatFileSize(limits.modelBytes)}.
        </p>
      </section>
      <section className="admin-card grid max-w-3xl gap-3">
        <h2>Connected apps</h2>
        <p className="admin-note text-sm">
          A key lets the sourcing app upload packages and import them by itself. Valid products are approved automatically and placed
          in the best matching collection; anything the importer rejects stays in the app with the reason. Keep keys private.
        </p>
        {activeKeys.length ? (
          <ul className="grid gap-2">
            {activeKeys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{key.name}</span>
                  <span className="admin-note block text-xs">{key.prefix}… · created {when(key.createdAt)} · last used {when(key.lastUsedAt)}</span>
                </span>
                <form action={revokeConnectedAppKey}>
                  <input type="hidden" name="keyId" value={key.id} />
                  <button className="btn-ghost btn-tint-red" type="submit">Revoke</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <ConnectedAppKey shopUrl={siteUrl()} />
      </section>
      {previous ? (
        <section className="admin-card grid max-w-3xl gap-3">
          <h2>Previous listings</h2>
          <p className="admin-note text-sm">
            Products the sourcing app did not create or update. Archiving hides them from the shop but keeps them in the admin,
            along with their orders, and can be undone.
          </p>
          <p className="text-sm">
            {previous.active} live and {previous.draft} draft previous listings. The sourcing app has {previous.sourcedActive} live
            and {previous.sourcedDraft} draft products.
          </p>
          {previous.active + previous.draft ? (
            <form action={archivePreviousListingsAction} className="grid gap-3">
              {previous.sourcedActive ? null : (
                <p className="text-sm" role="alert">No sourcing app products are live yet, so archiving now would leave the shop empty.</p>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" required />
                Hide all {previous.active + previous.draft} previous listings from the shop
              </label>
              <button className="btn-ghost btn-tint-red justify-self-start" type="submit">Archive previous listings</button>
            </form>
          ) : null}
          {previous.archivedByTool ? (
            <form action={restorePreviousListingsAction} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{previous.archivedByTool} listings archived here can be put back as they were.</span>
              <button className="btn-ghost" type="submit">Restore archived listings</button>
            </form>
          ) : null}
        </section>
      ) : null}
      <section className="grid gap-3">
        <h2>Import history</h2>
        {batches.length ? (
          <div className="admin-card overflow-x-auto p-0">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Uploaded</th>
                  <th>Package</th>
                  <th>Status</th>
                  <th>Products</th>
                  <th>Imported</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const [label, tone] = batchStatusLabels[batch.status] ?? [batch.status, "neutral"]
                  return (
                    <tr key={batch.id}>
                      <td>{new Date(batch.createdAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className="max-w-[18rem] truncate">
                        <Link href={`/admin/bulk-import/${batch.id}`}>{batch.packageId || batch.fileName}</Link>
                        <span className="admin-note block text-xs">{batch.fileName} · {formatFileSize(batch.packageBytes)}</span>
                      </td>
                      <td><span className="import-chip" data-tone={tone}>{label}</span></td>
                      <td>{batch.total || batch.productCount || "—"}</td>
                      <td>{batch.imported}</td>
                      <td>{batch.failed || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-note text-sm">No packages uploaded yet.</p>
        )}
      </section>
    </div>
  )
}
