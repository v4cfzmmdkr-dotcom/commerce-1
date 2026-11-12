import { currentAdmin } from "@/lib/auth/current"
import { getBatch } from "@/lib/bulk-import/batches"
import { PackageError, writeLocalPackage } from "@/lib/bulk-import/package-store"
import { limits } from "@/lib/bulk-import/schema"
import { storageMode } from "@/lib/storage"

export const runtime = "nodejs"

// Only used without object storage, where the browser cannot upload straight to a bucket.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin()
  if (!admin) return new Response("Unauthorized", { status: 401 })
  if (storageMode() !== "local") return new Response("Upload to object storage instead", { status: 409 })
  const { id } = await params
  const batch = await getBatch(id)
  if (!batch?.packagePath || batch.status !== "uploading") return new Response("Not found", { status: 404 })
  const declared = Number(request.headers.get("content-length") || 0)
  if (declared > limits.packageBytes) return new Response("Package too large", { status: 413 })
  if (!request.body) return new Response("Empty upload", { status: 400 })
  try {
    const size = await writeLocalPackage(batch.packagePath, request.body)
    return Response.json({ ok: true, size })
  } catch (error) {
    const message = error instanceof PackageError ? error.message : "Upload failed"
    return new Response(message, { status: error instanceof PackageError ? 413 : 500 })
  }
}
