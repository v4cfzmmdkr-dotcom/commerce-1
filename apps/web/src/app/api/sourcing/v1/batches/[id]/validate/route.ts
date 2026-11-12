import { apiError, apiJson, authorise, callerBatch } from "@/lib/bulk-import/api"
import { batchReport, finishUpload } from "@/lib/bulk-import/service"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await authorise(request)
  if (caller instanceof Response) return caller
  const { id } = await params
  if (!(await callerBatch(caller, id))) return apiError(404, "Import not found")
  const result = await finishUpload(id)
  if (!result.ok) return apiError(409, result.error)
  return apiJson({ ok: true, ...(await batchReport(id)) })
}
