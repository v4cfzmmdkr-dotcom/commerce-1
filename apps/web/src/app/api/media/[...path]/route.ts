import { GetObjectCommand } from "@aws-sdk/client-s3"
import { objectStorage, objectStorageConfigured } from "@/lib/object-storage"
import { readLocalObject, sanitizeObjectPath } from "@/lib/storage"

export const runtime = "nodejs"

const types: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp4: "video/mp4",
  webm: "video/webm",
}

// Object paths are unique per upload, so the CDN and browsers can keep them forever.
const cacheHeaders = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "CDN-Cache-Control": "public, max-age=31536000, immutable",
}

async function fromBucket(objectPath: string, range: string | null) {
  const object = await objectStorage().send(new GetObjectCommand({
    Bucket: process.env.STORAGE_BUCKET,
    Key: objectPath,
    Range: range ?? undefined,
  }))
  if (!object.Body) return new Response("Not found", { status: 404 })
  const headers: Record<string, string> = {
    ...cacheHeaders,
    "Content-Type": object.ContentType || "application/octet-stream",
    "Accept-Ranges": "bytes",
  }
  if (object.ContentLength !== undefined) headers["Content-Length"] = String(object.ContentLength)
  if (object.ETag) headers.ETag = object.ETag
  if (object.ContentRange) headers["Content-Range"] = object.ContentRange
  return new Response(object.Body.transformToWebStream(), { status: object.ContentRange ? 206 : 200, headers })
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params
  try {
    const objectPath = sanitizeObjectPath(parts.map(decodeURIComponent).join("/"))
    if (objectStorageConfigured()) return await fromBucket(objectPath, request.headers.get("range"))
    const bytes = await readLocalObject(objectPath)
    const extension = objectPath.split(".").pop()?.toLowerCase() || "jpg"
    const type = types[extension] || "application/octet-stream"
    const body = new Uint8Array(bytes)
    const headers = {
      ...cacheHeaders,
      "Content-Type": type,
      "Accept-Ranges": "bytes",
    }
    const range = request.headers.get("range")
    const match = range && type.startsWith("video/") ? /bytes=(\d+)-(\d*)/.exec(range) : null
    if (match) {
      const start = Number(match[1])
      const end = match[2] ? Math.min(Number(match[2]), body.length - 1) : body.length - 1
      if (start > end || start >= body.length) return new Response("Range not satisfiable", { status: 416 })
      const slice = body.slice(start, end + 1)
      return new Response(slice, {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${body.length}`,
          "Content-Length": String(slice.length),
        },
      })
    }
    return new Response(body, { headers })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
