import { revalidatePath } from "next/cache"
import { getSql } from "@/db/client"
import { batchCounts, createBatch, deleteBatch, getBatch, validateBatch } from "@/lib/bulk-import/batches"
import { packageSize, packageStorageSupported, signPackageUpload } from "@/lib/bulk-import/package-store"
import { queueRemaining, runImportStep } from "@/lib/bulk-import/process"
import { limits } from "@/lib/bulk-import/schema"
import { storageMode } from "@/lib/storage"

export type StartResult =
  | { ok: true, batchId: string, uploadUrl: string, mode: "signed" | "local" }
  | { ok: false, error: string }

export async function beginUpload(fileName: string, size: number, createdBy: string, localUploadUrl: (batchId: string) => string): Promise<StartResult> {
  if (!packageStorageSupported()) return { ok: false, error: "Bulk import needs Neon object storage (the STORAGE_* settings) or local storage" }
  if (!/\.zip$/i.test(fileName)) return { ok: false, error: "Choose a .zip product package" }
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "That file is empty" }
  if (size > limits.packageBytes) return { ok: false, error: `Packages must be under ${limits.packageBytes / 1024 / 1024 / 1024}GB. Split it into smaller packages` }
  const batch = await createBatch(fileName, size, createdBy)
  if (storageMode() === "local") return { ok: true, batchId: batch.id, mode: "local", uploadUrl: localUploadUrl(batch.id) }
  return { ok: true, batchId: batch.id, mode: "signed", uploadUrl: await signPackageUpload(batch.objectPath) }
}

export async function finishUpload(batchId: string) {
  const batch = await getBatch(batchId)
  if (!batch?.packagePath || batch.status !== "uploading") return { ok: false as const, error: "This upload has already been checked" }
  const size = await packageSize(batch.packagePath)
  if (!size) return { ok: false as const, error: "The package did not reach storage. Try again" }
  if (size > limits.packageBytes) {
    await deleteBatch(batchId)
    return { ok: false as const, error: "The package is larger than the upload limit" }
  }
  const result = await validateBatch(batchId)
  revalidatePath("/admin/bulk-import")
  return result.ok
    ? { ok: true as const, batchId, invalid: false, products: result.products, invalidProducts: result.invalid }
    : { ok: true as const, batchId, invalid: true, errors: result.errors }
}

export async function runStep(batchId: string) {
  const step = await runImportStep({ batchId, budgetMs: 40_000, concurrency: 2 })
  if (step.imported) revalidatePath("/", "layout")
  const [counts, remaining, batch] = await Promise.all([batchCounts(batchId), queueRemaining(batchId), getBatch(batchId)])
  return { imported: step.imported, failed: step.failed, remaining, counts, status: batch?.status ?? "completed" }
}

export async function batchReport(batchId: string) {
  const batch = await getBatch(batchId)
  if (!batch) return null
  const sql = getSql()
  const items = await sql<Array<{
    externalId: string
    sourceName: string
    sku: string
    title: string
    status: string
    decision: string
    action: string
    productId: string | null
    handle: string | null
    productStatus: string | null
    errors: unknown
    warnings: unknown
    collections: unknown
  }>>`
    select i.external_id as "externalId", i.source_name as "sourceName", i.sku, i.title, i.status, i.decision, i.action,
      case when i.status = 'imported' then i.product_id end as "productId", p.handle, p.status as "productStatus",
      i.errors, i.warnings,
      (select coalesce(jsonb_agg(c.title order by c.title), '[]'::jsonb) from collection_products cp
        join collections c on c.id = cp.collection_id where cp.product_id = p.id) as collections
    from import_batch_items i
    left join products p on p.id = i.product_id and i.status = 'imported'
    where i.batch_id = ${batchId}
    order by i.position
  `
  return {
    id: batch.id,
    status: batch.status,
    packageId: batch.packageId,
    errors: batch.errors,
    warnings: batch.warnings,
    counts: await batchCounts(batchId),
    remaining: await queueRemaining(batchId),
    items: items.map((item) => ({
      ...item,
      errors: Array.isArray(item.errors) ? item.errors : [],
      warnings: Array.isArray(item.warnings) ? item.warnings : [],
      collections: Array.isArray(item.collections) ? item.collections as string[] : [],
    })),
  }
}
