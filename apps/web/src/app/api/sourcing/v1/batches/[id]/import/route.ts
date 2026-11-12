import { apiError, apiJson, authorise, callerBatch } from "@/lib/bulk-import/api"
import { approveAllValid, queueApproved } from "@/lib/bulk-import/batches"
import { batchReport } from "@/lib/bulk-import/service"

export const dynamic = "force-dynamic"

// Approves every valid product (licences that forbid selling are already blocked) and queues them.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await authorise(request)
  if (caller instanceof Response) return caller
  const { id } = await params
  const batch = await callerBatch(caller, id)
  if (!batch) return apiError(404, "Import not found")
  if (batch.status !== "review" && batch.status !== "importing") return apiError(409, `This import is ${batch.status}`)
  const body = await request.json().catch(() => ({})) as { publish?: unknown }
  const approved = await approveAllValid(id)
  const queued = await queueApproved(id, body.publish === true)
  return apiJson({ ok: true, approved, queued, ...(await batchReport(id)) })
}
