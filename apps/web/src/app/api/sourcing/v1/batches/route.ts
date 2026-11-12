import { apiCreatedBy, apiError, apiJson, authorise } from "@/lib/bulk-import/api"
import { beginUpload } from "@/lib/bulk-import/service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const caller = await authorise(request)
  if (caller instanceof Response) return caller
  const body = await request.json().catch(() => null) as { fileName?: unknown, size?: unknown } | null
  if (!body || typeof body.fileName !== "string" || typeof body.size !== "number") {
    return apiError(400, "Send JSON with fileName and size")
  }
  const origin = new URL(request.url).origin
  const result = await beginUpload(body.fileName, body.size, apiCreatedBy(caller), (id) => `${origin}/api/sourcing/v1/batches/${id}/package`)
  if (!result.ok) return apiError(400, result.error)
  return apiJson({
    ok: true,
    batchId: result.batchId,
    upload: {
      method: "PUT",
      url: result.uploadUrl,
      headers: { "Content-Type": "application/zip" },
      authorization: result.mode === "local",
    },
  }, 201)
}
