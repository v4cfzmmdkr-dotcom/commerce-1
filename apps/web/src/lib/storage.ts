import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

const root = path.join(process.cwd(), "storage")
let bucketReady: Promise<void> | null = null

export function storageMode() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase" as const
  return "local" as const
}

export function sanitizeObjectPath(value: string) {
  const cleaned = value.replace(/\\/g, "/").replace(/^\/+/, "")
  if (!cleaned || cleaned.includes("..") || !/^[a-zA-Z0-9._/-]+$/.test(cleaned)) {
    throw new Error("Invalid storage path")
  }
  return cleaned
}

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const base = process.env.SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!base || !key) return
      const response = await fetch(`${base}/storage/v1/bucket`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: "product-images", name: "product-images", public: true }),
      })
      if (!response.ok && response.status !== 409) {
        const detail = await response.text()
        throw new Error(`Could not create the image bucket (${response.status}): ${detail.slice(0, 180)}`)
      }
    })().catch((error) => {
      bucketReady = null
      throw error
    })
  }
  await bucketReady
}

export async function saveObject(objectPath: string, bytes: Buffer, contentType: string) {
  const safe = sanitizeObjectPath(objectPath)
  if (storageMode() === "supabase") {
    await ensureBucket()
    const base = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const response = await fetch(`${base}/storage/v1/object/product-images/${safe}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key || "",
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: new Uint8Array(bytes),
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Image upload failed (${response.status}): ${detail.slice(0, 180)}`)
    }
    return {
      path: safe,
      url: `${base}/storage/v1/object/public/product-images/${safe}`,
    }
  }

  const full = path.join(root, safe)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, bytes)
  const url = `/api/media/${safe.split("/").map(encodeURIComponent).join("/")}`
  return { path: safe, url }
}

export async function readLocalObject(objectPath: string) {
  const safe = sanitizeObjectPath(objectPath)
  const full = path.resolve(root, safe)
  if (!full.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage path")
  return readFile(full)
}

export async function deleteObject(objectPath: string | null) {
  if (!objectPath) return
  const safe = sanitizeObjectPath(objectPath)
  if (storageMode() === "supabase") {
    const base = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    await fetch(`${base}/storage/v1/object/product-images/${safe}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key || "",
      },
    })
    return
  }
  const full = path.resolve(root, safe)
  if (!full.startsWith(`${root}${path.sep}`)) return
  await unlink(full).catch(() => undefined)
}

export function extensionFor(contentType: string) {
  if (contentType.includes("png")) return "png"
  if (contentType.includes("webp")) return "webp"
  if (contentType.includes("gif")) return "gif"
  if (contentType.includes("mp4")) return "mp4"
  if (contentType.includes("webm")) return "webm"
  return "jpg"
}
