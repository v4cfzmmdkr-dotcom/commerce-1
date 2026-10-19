import { readLocalObject } from "@/lib/storage"

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

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params
  try {
    const objectPath = parts.map(decodeURIComponent).join("/")
    const bytes = await readLocalObject(objectPath)
    const extension = objectPath.split(".").pop()?.toLowerCase() || "jpg"
    const type = types[extension] || "application/octet-stream"
    const body = new Uint8Array(bytes)
    const headers = {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
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
