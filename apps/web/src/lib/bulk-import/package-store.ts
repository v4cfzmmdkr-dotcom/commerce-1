import { createWriteStream } from "node:fs"
import { mkdir, rename, stat, unlink } from "node:fs/promises"
import path from "node:path"
import { PassThrough, Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream as WebReadableStream } from "node:stream/web"
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import yauzl from "yauzl"
import { objectStorage, printFilesBucket } from "@/lib/object-storage"
import { sanitizeObjectPath, storageMode } from "@/lib/storage"
import { saveLocalPrintFile } from "@/lib/print-files"
import { limits } from "@/lib/bulk-import/schema"

// Not under storage/, which /api/media serves publicly in local mode.
const localRoot = path.join(process.cwd(), "private-storage", "bulk-imports")
const blockSize = 1024 * 1024
const maxBlocks = 24

export class PackageError extends Error {}

export function packageStorageSupported() {
  return storageMode() !== "supabase"
}

export function packageObjectPath(batchId: string) {
  return sanitizeObjectPath(`bulk-imports/${batchId}/package.zip`)
}

function localPackageFile(objectPath: string) {
  const full = path.resolve(localRoot, sanitizeObjectPath(objectPath))
  if (!full.startsWith(`${localRoot}${path.sep}`)) throw new PackageError("Invalid package path")
  return full
}

export async function signPackageUpload(objectPath: string) {
  return getSignedUrl(objectStorage(), new PutObjectCommand({
    Bucket: printFilesBucket(),
    Key: sanitizeObjectPath(objectPath),
    ContentType: "application/zip",
  }), { expiresIn: 3 * 3600 })
}

export async function writeLocalPackage(objectPath: string, body: ReadableStream<Uint8Array>, maxBytes = limits.packageBytes) {
  const file = localPackageFile(objectPath)
  await mkdir(path.dirname(file), { recursive: true })
  const partial = `${file}.part`
  let size = 0
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length
      if (size > maxBytes) callback(new PackageError(`The package is larger than ${Math.round(maxBytes / 1024 / 1024)}MB`))
      else callback(null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(body as WebReadableStream<Uint8Array>), counter, createWriteStream(partial))
    await rename(partial, file)
  } catch (error) {
    await unlink(partial).catch(() => undefined)
    throw error
  }
  return size
}

export async function packageSize(objectPath: string) {
  if (storageMode() === "local") {
    const info = await stat(localPackageFile(objectPath)).catch(() => null)
    return info?.size ?? null
  }
  const head = await objectStorage()
    .send(new HeadObjectCommand({ Bucket: printFilesBucket(), Key: sanitizeObjectPath(objectPath) }))
    .catch(() => null)
  return head?.ContentLength ?? null
}

export async function deletePackage(objectPath: string | null) {
  if (!objectPath) return
  forgetPackage(objectPath)
  if (storageMode() === "local") {
    await unlink(localPackageFile(objectPath)).catch(() => undefined)
    return
  }
  await objectStorage().send(new DeleteObjectCommand({ Bucket: printFilesBucket(), Key: sanitizeObjectPath(objectPath) }))
}

class ObjectRangeReader extends yauzl.RandomAccessReader {
  private blocks = new Map<number, Promise<Buffer>>()

  constructor(private key: string, private size: number) {
    super()
  }

  private async fetchRange(start: number, end: number) {
    const object = await objectStorage().send(new GetObjectCommand({
      Bucket: printFilesBucket(),
      Key: this.key,
      Range: `bytes=${start}-${end - 1}`,
    }))
    if (!object.Body) throw new PackageError("The package could not be read from storage")
    return object.Body as Readable
  }

  private block(index: number) {
    let cached = this.blocks.get(index)
    if (cached) {
      this.blocks.delete(index)
      this.blocks.set(index, cached)
      return cached
    }
    const start = index * blockSize
    const end = Math.min(this.size, start + blockSize)
    cached = this.fetchRange(start, end).then(async (stream) => {
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(Buffer.from(chunk))
      return Buffer.concat(chunks)
    })
    cached.catch(() => this.blocks.delete(index))
    this.blocks.set(index, cached)
    while (this.blocks.size > maxBlocks) this.blocks.delete(this.blocks.keys().next().value!)
    return cached
  }

  _readStreamForRange(start: number, end: number) {
    const out = new PassThrough()
    this.fetchRange(start, end).then(
      (stream) => {
        stream.on("error", (error) => out.destroy(error))
        stream.pipe(out)
      },
      (error) => out.destroy(error),
    )
    return out
  }

  read(buffer: Buffer, offset: number, length: number, position: number, callback: (error: Error | null) => void) {
    const first = Math.floor(position / blockSize)
    const last = Math.floor((position + length - 1) / blockSize)
    const indexes = Array.from({ length: last - first + 1 }, (_, index) => first + index)
    Promise.all(indexes.map((index) => this.block(index))).then((blocks) => {
      let written = 0
      for (const [n, block] of blocks.entries()) {
        const blockStart = (first + n) * blockSize
        const from = Math.max(0, position + written - blockStart)
        const take = Math.min(block.length - from, length - written)
        block.copy(buffer, offset + written, from, from + take)
        written += take
      }
      callback(written === length ? null : new PackageError("Unexpected end of package"))
    }, (error: Error) => callback(error))
  }
}

export type OpenPackage = {
  zip: yauzl.ZipFile
  list: yauzl.Entry[]
  entries: Map<string, yauzl.Entry>
  size: number
}

export function rawEntry(entry: yauzl.Entry) {
  return {
    name: entry.fileName,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
    isSymlink: ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000,
    isEncrypted: entry.isEncrypted(),
  }
}

function zipReadError(message: string) {
  if (/invalid relative path|absolute path|invalid characters in fileName/i.test(message)) {
    return `The ZIP contains an unsafe file path (${message}). Paths must be relative and must not contain .. or backslashes`
  }
  if (/end of central directory record signature not found/i.test(message)) return "That file is not a ZIP archive, or it is damaged"
  return `The ZIP could not be read: ${message}`
}

const zipOptions = { lazyEntries: true, autoClose: false, validateEntrySizes: true, strictFileNames: true } as const

async function openZip(objectPath: string) {
  if (storageMode() === "local") {
    const file = localPackageFile(objectPath)
    const info = await stat(file).catch(() => null)
    if (!info) throw new PackageError("The package file is missing. Upload it again")
    return { zip: await yauzl.openPromise(file, zipOptions), size: info.size }
  }
  const key = sanitizeObjectPath(objectPath)
  const size = await packageSize(key)
  if (!size) throw new PackageError("The package file is missing from storage. Upload it again")
  return { zip: await yauzl.fromRandomAccessReaderPromise(new ObjectRangeReader(key, size), size, zipOptions), size }
}

const opened = new Map<string, { at: number, value: Promise<OpenPackage> }>()
const openTtlMs = 5 * 60 * 1000

function forgetPackage(objectPath: string) {
  const current = opened.get(objectPath)
  opened.delete(objectPath)
  current?.value.then((value) => value.zip.close(), () => undefined)
}

// Reading the central directory takes a few round trips, so keep it for repeat previews.
export function openPackage(objectPath: string) {
  const current = opened.get(objectPath)
  if (current && Date.now() - current.at < openTtlMs) return current.value
  if (current) forgetPackage(objectPath)
  const value = (async () => {
    let zip: yauzl.ZipFile | null = null
    try {
      const result = await openZip(objectPath)
      zip = result.zip
      if (zip.entryCount > limits.entries) {
        throw new PackageError(`The ZIP has ${zip.entryCount} entries; the limit is ${limits.entries}`)
      }
      const list: yauzl.Entry[] = []
      const entries = new Map<string, yauzl.Entry>()
      for await (const entry of zip.eachEntry()) {
        list.push(entry)
        if (!entries.has(entry.fileName)) entries.set(entry.fileName, entry)
      }
      return { zip, list, entries, size: result.size }
    } catch (error) {
      zip?.close()
      if (error instanceof PackageError) throw error
      throw new PackageError(zipReadError(error instanceof Error ? error.message : String(error)))
    }
  })()
  value.catch(() => opened.delete(objectPath))
  opened.set(objectPath, { at: Date.now(), value })
  return value
}

export async function readPackageEntry(pkg: OpenPackage, name: string, maxBytes: number) {
  const entry = pkg.entries.get(name)
  if (!entry) throw new PackageError(`${name} is missing from the package`)
  if (entry.uncompressedSize > maxBytes) throw new PackageError(`${name} is larger than ${Math.round(maxBytes / 1024 / 1024)}MB`)
  const stream = await pkg.zip.openReadStreamPromise(entry)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    size += chunk.length
    if (size > maxBytes) {
      stream.destroy()
      throw new PackageError(`${name} is larger than ${Math.round(maxBytes / 1024 / 1024)}MB`)
    }
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

export async function savePrivateFile(objectPath: string, bytes: Buffer, contentType: string) {
  const safe = sanitizeObjectPath(objectPath)
  if (storageMode() === "local") {
    await saveLocalPrintFile(safe, bytes)
    return safe
  }
  await objectStorage().send(new PutObjectCommand({
    Bucket: printFilesBucket(),
    Key: safe,
    Body: bytes,
    ContentType: contentType,
  }))
  return safe
}
