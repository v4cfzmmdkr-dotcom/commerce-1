import { NextResponse } from "next/server"
import { apiKeyFromRequest } from "@/lib/api-keys"
import { getBatch } from "@/lib/bulk-import/batches"

export type ApiCaller = { id: string, name: string }

export function apiError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } })
}

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export function apiCreatedBy(caller: ApiCaller) {
  return `api:${caller.id}:${caller.name}`
}

export async function authorise(request: Request) {
  const caller = await apiKeyFromRequest(request)
  return caller ?? apiError(401, "Missing or revoked API key. Create one under Admin > Bulk Importer > Connected apps")
}

// Apps only see the imports they started; uploads from the admin page stay private to it.
export async function callerBatch(caller: ApiCaller, batchId: string) {
  const batch = await getBatch(batchId)
  if (!batch || !batch.createdBy.startsWith(`api:${caller.id}:`)) return null
  return batch
}
