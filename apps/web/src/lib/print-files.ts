import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { maxPrintFileBytes, printFileExtension } from "@/lib/print-file-rules"
import { slugify } from "@/lib/slug"
import { sanitizeObjectPath, storageMode } from "@/lib/storage"

export { checkPrintFile } from "@/lib/print-file-rules"

export const printFileBucket = "print-files"

const localRoot = path.join(process.cwd(), "storage", printFileBucket)
let bucketReady: Promise<void> | null = null

export function printFilePath(productId: string, fileName: string, stamp = Date.now()) {
  const extension = printFileExtension(fileName)
  if (!extension) throw new Error("Unsupported print file")
  const base = slugify(fileName.replace(/\.[^.]+$/, "")).slice(0, 80)
  return sanitizeObjectPath(`${slugify(productId)}/${stamp}-${base}.${extension}`)
}

export function printFileBelongsTo(objectPath: string, productId: string) {
  return objectPath.startsWith(`${slugify(productId)}/`)
}

function supabase() {
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error("Supabase storage is not configured")
  return { base, headers: { Authorization: `Bearer ${key}`, apikey: key } }
}

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { base, headers } = supabase()
      const existing = await fetch(`${base}/storage/v1/bucket/${printFileBucket}`, { headers })
      if (existing.ok) return
      const response = await fetch(`${base}/storage/v1/bucket`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: printFileBucket, name: printFileBucket, public: false, file_size_limit: maxPrintFileBytes }),
      })
      if (!response.ok) {
        const detail = await response.text()
        if (/BucketAlreadyExists|"statusCode":"409"/.test(detail)) return
        throw new Error(`Could not create the print file bucket (${response.status}): ${detail.slice(0, 180)}`)
      }
    })().catch((error) => {
      bucketReady = null
      throw error
    })
  }
  await bucketReady
}

export async function signPrintFileUpload(objectPath: string) {
  const safe = sanitizeObjectPath(objectPath)
  await ensureBucket()
  const { base, headers } = supabase()
  const response = await fetch(`${base}/storage/v1/object/upload/sign/${printFileBucket}/${safe}`, { method: "POST", headers })
  if (!response.ok) throw new Error(`Could not start the upload (${response.status})`)
  const { url } = await response.json() as { url: string }
  return `${base}/storage/v1${url}`
}

export async function printFileSize(objectPath: string) {
  const safe = sanitizeObjectPath(objectPath)
  if (storageMode() === "local") {
    const info = await stat(path.join(localRoot, safe)).catch(() => null)
    return info?.size ?? null
  }
  const { base, headers } = supabase()
  const response = await fetch(`${base}/storage/v1/object/authenticated/${printFileBucket}/${safe}`, { method: "HEAD", headers })
  if (!response.ok) return null
  return Number(response.headers.get("content-length") || 0)
}

export async function signPrintFileDownload(objectPath: string, fileName: string, expiresIn = 300) {
  const safe = sanitizeObjectPath(objectPath)
  const { base, headers } = supabase()
  const response = await fetch(`${base}/storage/v1/object/sign/${printFileBucket}/${safe}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  })
  if (!response.ok) throw new Error(`Could not sign the download (${response.status})`)
  const { signedURL } = await response.json() as { signedURL: string }
  return `${base}/storage/v1${signedURL}&download=${encodeURIComponent(fileName)}`
}

export async function saveLocalPrintFile(objectPath: string, bytes: Buffer) {
  const safe = sanitizeObjectPath(objectPath)
  const full = path.join(localRoot, safe)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, bytes)
}

export async function readLocalPrintFile(objectPath: string) {
  const safe = sanitizeObjectPath(objectPath)
  const full = path.resolve(localRoot, safe)
  if (!full.startsWith(`${localRoot}${path.sep}`)) throw new Error("Invalid storage path")
  return readFile(full)
}

export async function deletePrintFileObject(objectPath: string) {
  const safe = sanitizeObjectPath(objectPath)
  if (storageMode() === "local") {
    const full = path.resolve(localRoot, safe)
    if (full.startsWith(`${localRoot}${path.sep}`)) await unlink(full).catch(() => undefined)
    return
  }
  const { base, headers } = supabase()
  await fetch(`${base}/storage/v1/object/${printFileBucket}/${safe}`, { method: "DELETE", headers })
}
