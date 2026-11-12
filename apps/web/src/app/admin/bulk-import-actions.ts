"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth/current"
import {
  approveAllValid,
  batchCounts,
  createBatch,
  deleteBatch,
  getBatch,
  pauseBatch,
  queueApproved,
  rejectAllPending,
  removeBatchPackage,
  retryFailed,
  setDecision,
  validateBatch,
} from "@/lib/bulk-import/batches"
import { packageSize, packageStorageSupported, signPackageUpload } from "@/lib/bulk-import/package-store"
import { queueRemaining, runImportStep } from "@/lib/bulk-import/process"
import { limits } from "@/lib/bulk-import/schema"
import { storageMode } from "@/lib/storage"

type StartResult =
  | { ok: true, batchId: string, uploadUrl: string, mode: "signed" | "local" }
  | { ok: false, error: string }

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim()
}

function back(formData: FormData, batchId: string, notice?: string) {
  const path = text(formData, "back")
  const url = new URL(path.startsWith(`/admin/bulk-import/${batchId}`) ? path : `/admin/bulk-import/${batchId}`, "http://admin.local")
  if (notice) url.searchParams.set("notice", notice)
  else url.searchParams.delete("notice")
  return `${url.pathname}${url.search}`
}

export async function startBulkImport(fileName: string, size: number): Promise<StartResult> {
  const admin = await requireAdmin()
  if (!packageStorageSupported()) return { ok: false, error: "Bulk import needs Neon object storage (the STORAGE_* settings) or local storage" }
  if (!/\.zip$/i.test(fileName)) return { ok: false, error: "Choose a .zip product package" }
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "That file is empty" }
  if (size > limits.packageBytes) return { ok: false, error: `Packages must be under ${limits.packageBytes / 1024 / 1024 / 1024}GB. Split it into smaller packages` }
  const batch = await createBatch(fileName, size, admin.email)
  if (storageMode() === "local") {
    return { ok: true, batchId: batch.id, mode: "local", uploadUrl: `/api/admin/bulk-import/${batch.id}/package` }
  }
  return { ok: true, batchId: batch.id, mode: "signed", uploadUrl: await signPackageUpload(batch.objectPath) }
}

export async function finishBulkImport(batchId: string) {
  await requireAdmin()
  const batch = await getBatch(batchId)
  if (!batch?.packagePath || batch.status !== "uploading") return { ok: false, error: "This upload has already been checked" }
  const size = await packageSize(batch.packagePath)
  if (!size) return { ok: false, error: "The package did not reach storage. Try again" }
  if (size > limits.packageBytes) {
    await deleteBatch(batchId)
    return { ok: false, error: "The package is larger than the upload limit" }
  }
  const result = await validateBatch(batchId)
  revalidatePath("/admin/bulk-import")
  return result.ok ? { ok: true as const, batchId } : { ok: true as const, batchId, invalid: true }
}

export async function decideItems(formData: FormData) {
  await requireAdmin()
  const batchId = text(formData, "batchId")
  const decision = text(formData, "decision") === "rejected" ? "rejected" : "approved"
  const ids = formData.getAll("itemIds").map(String).filter(Boolean).slice(0, limits.products)
  const changed = await setDecision(batchId, ids, decision)
  redirect(back(formData, batchId, `${decision}-${changed}`))
}

export async function approveAllItems(formData: FormData) {
  await requireAdmin()
  const batchId = text(formData, "batchId")
  const changed = await approveAllValid(batchId)
  redirect(back(formData, batchId, `approved-${changed}`))
}

export async function rejectPendingItems(formData: FormData) {
  await requireAdmin()
  const batchId = text(formData, "batchId")
  const changed = await rejectAllPending(batchId)
  redirect(back(formData, batchId, `rejected-${changed}`))
}

export async function startImport(formData: FormData) {
  await requireAdmin()
  const batchId = text(formData, "batchId")
  const queued = await queueApproved(batchId, formData.get("publish") === "on")
  redirect(back(formData, batchId, queued ? `queued-${queued}` : "nothing-queued"))
}

export async function retryFailedItems(formData: FormData) {
  await requireAdmin()
  const batchId = text(formData, "batchId")
  const ids = formData.getAll("itemIds").map(String).filter(Boolean)
  const queued = await retryFailed(batchId, ids.length ? ids : undefined)
  redirect(back(formData, batchId, queued ? `queued-${queued}` : "nothing-queued"))
}

export async function pauseImport(formData: FormData) {
  await requireAdmin()
  const batchId = text(formData, "batchId")
  await pauseBatch(batchId)
  redirect(back(formData, batchId, "paused"))
}

export async function removeImportPackage(formData: FormData) {
  await requireAdmin()
  const batchId = text(formData, "batchId")
  const removed = await removeBatchPackage(batchId)
  redirect(back(formData, batchId, removed ? "package-removed" : "package-kept"))
}

export async function deleteImport(formData: FormData) {
  await requireAdmin()
  const batchId = text(formData, "batchId")
  const deleted = await deleteBatch(batchId)
  redirect(deleted ? "/admin/bulk-import?notice=deleted" : back(formData, batchId, "delete-blocked"))
}

export async function importStep(batchId: string) {
  await requireAdmin()
  const step = await runImportStep({ batchId, budgetMs: 40_000, concurrency: 2 })
  if (step.imported) revalidatePath("/", "layout")
  const [counts, remaining, batch] = await Promise.all([batchCounts(batchId), queueRemaining(batchId), getBatch(batchId)])
  return { imported: step.imported, failed: step.failed, remaining, counts, status: batch?.status ?? "completed" }
}
