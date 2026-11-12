import { apiError, apiJson, authorise, callerBatch } from "@/lib/bulk-import/api"
import { runStep } from "@/lib/bulk-import/service"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Imports for up to 40 seconds. Call again while "remaining" is above zero.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await authorise(request)
  if (caller instanceof Response) return caller
  const { id } = await params
  if (!(await callerBatch(caller, id))) return apiError(404, "Import not found")
  return apiJson({ ok: true, ...(await runStep(id)) })
}
