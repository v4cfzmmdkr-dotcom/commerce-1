import Link from "next/link"
import { BulkImportUpload } from "@/components/bulk-import-upload"
import { databaseConfigured } from "@/db/client"
import { listBatches } from "@/lib/bulk-import/batches"
import { batchStatusLabels } from "@/lib/bulk-import/format"
import { packageStorageSupported } from "@/lib/bulk-import/package-store"
import { limits } from "@/lib/bulk-import/schema"
import { formatFileSize } from "@/lib/print-file-rules"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export default async function BulkImportPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams
  const batches = databaseConfigured() ? await listBatches() : []
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
