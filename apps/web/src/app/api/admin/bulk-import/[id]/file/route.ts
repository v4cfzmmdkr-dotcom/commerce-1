import { currentAdmin } from "@/lib/auth/current"
import { getBatch } from "@/lib/bulk-import/batches"
import { contentTypeForModel, extensionOf, safeFileName, sniffImage } from "@/lib/bulk-import/files"
import { PackageError, openPackage, readPackageEntry } from "@/lib/bulk-import/package-store"
import { limits } from "@/lib/bulk-import/schema"

export const runtime = "nodejs"

// Serves one image or print file out of an uploaded package so it can be checked before import.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin()
  if (!admin) return new Response("Unauthorized", { status: 401 })
  const { id } = await params
  const wanted = new URL(request.url).searchParams.get("path") || ""
  const batch = await getBatch(id)
  const file = batch?.files.find((candidate) => candidate.path === wanted)
  if (!batch?.packagePath || !file) return new Response("Not found", { status: 404 })
  try {
    const pkg = await openPackage(batch.packagePath)
    const bytes = await readPackageEntry(pkg, `${batch.packageRoot}${file.path}`, file.kind === "image" ? limits.imageBytes : limits.modelBytes)
    const headers: Record<string, string> = {
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Length": String(bytes.length),
    }
    if (file.kind === "image") {
      const kind = sniffImage(bytes)
      if (!kind) return new Response("Not an image", { status: 415 })
      headers["Content-Type"] = kind.type
    } else {
      headers["Content-Type"] = contentTypeForModel(extensionOf(file.path))
      headers["Content-Disposition"] = `attachment; filename="${safeFileName(file.path)}"`
    }
    return new Response(new Uint8Array(bytes), { headers })
  } catch (error) {
    if (error instanceof PackageError) return new Response(error.message, { status: 404 })
    throw error
  }
}
