import { apiError, apiJson, authorise, callerBatch } from "@/lib/bulk-import/api"
import { batchReport } from "@/lib/bulk-import/service"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await authorise(request)
  if (caller instanceof Response) return caller
  const { id } = await params
  if (!(await callerBatch(caller, id))) return apiError(404, "Import not found")
  return apiJson({ ok: true, ...(await batchReport(id)) })
}
