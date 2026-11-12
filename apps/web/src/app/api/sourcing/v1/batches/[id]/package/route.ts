import { apiError, apiJson, authorise, callerBatch } from "@/lib/bulk-import/api"
import { PackageError, writeLocalPackage } from "@/lib/bulk-import/package-store"
import { limits } from "@/lib/bulk-import/schema"
import { storageMode } from "@/lib/storage"

export const runtime = "nodejs"

// Only used without object storage; otherwise the app uploads straight to the bucket.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await authorise(request)
  if (caller instanceof Response) return caller
  if (storageMode() !== "local") return apiError(409, "Upload to object storage instead")
  const { id } = await params
  const batch = await callerBatch(caller, id)
  if (!batch?.packagePath || batch.status !== "uploading") return apiError(404, "Import not found")
  if (Number(request.headers.get("content-length") || 0) > limits.packageBytes) return apiError(413, "Package too large")
  if (!request.body) return apiError(400, "Empty upload")
  try {
    return apiJson({ ok: true, size: await writeLocalPackage(batch.packagePath, request.body) })
  } catch (error) {
    if (error instanceof PackageError) return apiError(413, error.message)
    throw error
  }
}
