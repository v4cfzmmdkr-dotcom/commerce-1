import { readLocalObject } from "@/lib/storage"

export const runtime = "nodejs"

const types: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
}

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params
  try {
    const objectPath = parts.map(decodeURIComponent).join("/")
    const bytes = await readLocalObject(objectPath)
    const extension = objectPath.split(".").pop()?.toLowerCase() || "jpg"
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": types[extension] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
