"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createApiKey, revokeApiKey } from "@/lib/api-keys"
import { requireAdmin } from "@/lib/auth/current"
import { archivePreviousListings, restorePreviousListings } from "@/lib/bulk-import/archive"
import {
  approveAllValid,
  deleteBatch,
  pauseBatch,
  queueApproved,
  rejectAllPending,
  removeBatchPackage,
  retryFailed,
  setDecision,
} from "@/lib/bulk-import/batches"
import { limits } from "@/lib/bulk-import/schema"
import { beginUpload, finishUpload, runStep, type StartResult } from "@/lib/bulk-import/service"

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
  return beginUpload(fileName, size, admin.email, (batchId) => `/api/admin/bulk-import/${batchId}/package`)
}

export async function finishBulkImport(batchId: string) {
  await requireAdmin()
  const result = await finishUpload(batchId)
  return result.ok ? { ok: true as const, batchId, invalid: result.invalid } : result
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

export async function createConnectedAppKey(_previous: unknown, formData: FormData) {
  const admin = await requireAdmin()
  const name = text(formData, "name") || "Niche Parts Sourcing"
  const { key } = await createApiKey(name, admin.email)
  return { key, name }
}

export async function revokeConnectedAppKey(formData: FormData) {
  await requireAdmin()
  await revokeApiKey(text(formData, "keyId"))
  redirect("/admin/bulk-import?notice=key-revoked")
}

export async function archivePreviousListingsAction(formData: FormData) {
  await requireAdmin()
  if (formData.get("confirm") !== "on") redirect("/admin/bulk-import?notice=archive-unconfirmed")
  const archived = await archivePreviousListings()
  revalidatePath("/", "layout")
  redirect(`/admin/bulk-import?notice=archived-${archived}`)
}

export async function restorePreviousListingsAction() {
  await requireAdmin()
  const restored = await restorePreviousListings()
  revalidatePath("/", "layout")
  redirect(`/admin/bulk-import?notice=restored-${restored}`)
}

export async function importStep(batchId: string) {
  await requireAdmin()
  return runStep(batchId)
}
