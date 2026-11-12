import yauzl from "yauzl"
import { imageExtensions, limits, modelExtensions } from "@/lib/bulk-import/schema"

export type EntryKind = "manifest" | "products" | "image" | "model"

export type PackageFile = {
  path: string
  kind: "image" | "model"
  size: number
}

export type RawEntry = {
  name: string
  compressedSize: number
  uncompressedSize: number
  isSymlink: boolean
  isEncrypted: boolean
}

const junkName = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$|\._)/i
const segment = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function extensionOf(name: string) {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ""
}

export function isJunk(name: string) {
  return junkName.test(name)
}

// Packages made by zipping a folder put everything under one top-level directory.
export function commonRoot(names: string[]) {
  const files = names.filter((name) => !name.endsWith("/") && !isJunk(name))
  if (files.some((name) => name === "manifest.json")) return ""
  const roots = new Set(files.map((name) => (name.includes("/") ? name.split("/")[0] : "")))
  if (roots.size !== 1) return ""
  const [root] = roots
  return root && files.includes(`${root}/manifest.json`) ? `${root}/` : ""
}

export function classifyPath(path: string): { kind: EntryKind } | { error: string } {
  if (path.length > limits.pathLength) return { error: `${path.slice(0, 60)}... is longer than ${limits.pathLength} characters` }
  if (path === "manifest.json") return { kind: "manifest" }
  if (path === "products.json") return { kind: "products" }
  const parts = path.split("/")
  if (parts.some((part) => !segment.test(part) || part === "." || part === "..")) {
    return { error: `${path} has an unsafe name. Use letters, numbers, dot, dash and underscore only` }
  }
  const extension = extensionOf(path)
  if (parts[0] === "images" && parts.length > 1) {
    return (imageExtensions as readonly string[]).includes(extension)
      ? { kind: "image" }
      : { error: `${path} is not a JPEG, PNG or WebP image` }
  }
  if (parts[0] === "models" && parts.length > 1) {
    return (modelExtensions as readonly string[]).includes(extension)
      ? { kind: "model" }
      : { error: `${path} is not an STL or 3MF file` }
  }
  return { error: `${path} is not allowed. Packages may only contain manifest.json, products.json, images/ and models/` }
}

export function maxBytesFor(kind: EntryKind) {
  if (kind === "manifest") return limits.manifestBytes
  if (kind === "products") return limits.productsBytes
  if (kind === "image") return limits.imageBytes
  return limits.modelBytes
}

export function checkEntries(entries: RawEntry[]) {
  const errors: string[] = []
  const warnings: string[] = []
  if (entries.length > limits.entries) {
    return { errors: [`The ZIP has ${entries.length} entries; the limit is ${limits.entries}`], warnings, files: [], root: "" }
  }
  const root = commonRoot(entries.map((entry) => entry.name))
  const files: PackageFile[] = []
  const seen = new Set<string>()
  let junk = 0
  let hasManifest = false
  let hasProducts = false
  for (const entry of entries) {
    if (entry.name.endsWith("/")) continue
    if (isJunk(entry.name)) {
      junk += 1
      continue
    }
    if (entry.isSymlink) {
      errors.push(`${entry.name} is a symbolic link. Links are not allowed`)
      continue
    }
    if (entry.isEncrypted) {
      errors.push(`${entry.name} is encrypted. Packages must not use a ZIP password`)
      continue
    }
    if (root && !entry.name.startsWith(root)) {
      errors.push(`${entry.name} is outside the package folder`)
      continue
    }
    const path = entry.name.slice(root.length)
    const kind = classifyPath(path)
    if ("error" in kind) {
      errors.push(kind.error)
      continue
    }
    const key = path.toLowerCase()
    if (seen.has(key)) {
      errors.push(`${path} appears more than once (names are compared without case)`)
      continue
    }
    seen.add(key)
    const max = maxBytesFor(kind.kind)
    if (entry.uncompressedSize > max) {
      errors.push(`${path} is ${(entry.uncompressedSize / 1024 / 1024).toFixed(1)}MB; the limit for this file type is ${max / 1024 / 1024}MB`)
      continue
    }
    if (entry.uncompressedSize > 1024 * 1024 && entry.uncompressedSize > entry.compressedSize * limits.compressionRatio) {
      errors.push(`${path} expands ${Math.round(entry.uncompressedSize / Math.max(1, entry.compressedSize))} times when unzipped, which looks like a ZIP bomb`)
      continue
    }
    if (kind.kind === "manifest") hasManifest = true
    else if (kind.kind === "products") hasProducts = true
    else files.push({ path, kind: kind.kind, size: entry.uncompressedSize })
  }
  if (!hasManifest) errors.unshift("manifest.json is missing from the top of the ZIP")
  if (!hasProducts) errors.unshift("products.json is missing from the top of the ZIP")
  if (junk) warnings.push(`Ignored ${junk} system ${junk === 1 ? "file" : "files"} such as .DS_Store or __MACOSX`)
  return { errors, warnings, files, root }
}

export function sniffImage(bytes: Buffer): { type: string, extension: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", extension: "jpg" }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { type: "image/png", extension: "png" }
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { type: "image/webp", extension: "webp" }
  }
  return null
}

export function checkStl(bytes: Buffer) {
  if (bytes.length >= 84) {
    const triangles = bytes.readUInt32LE(80)
    if (triangles > 0 && bytes.length === 84 + triangles * 50) return null
  }
  const head = bytes.subarray(0, Math.min(bytes.length, 4096)).toString("latin1")
  if (/^\s*solid\b/i.test(head) && /\bfacet\b/i.test(head)) {
    const tail = bytes.subarray(Math.max(0, bytes.length - 1024)).toString("latin1")
    if (/\bendsolid\b/i.test(tail)) return null
  }
  return "is not a valid STL file"
}

export async function check3mf(bytes: Buffer) {
  if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) return "is not a valid 3MF file"
  let zip: yauzl.ZipFile | null = null
  try {
    zip = await yauzl.fromBufferPromise(bytes, { lazyEntries: true, validateEntrySizes: true })
    if (zip.entryCount > 10_000) return "contains too many parts"
    let contentTypes = false
    let model = false
    for await (const entry of zip.eachEntry()) {
      if (entry.fileName === "[Content_Types].xml") contentTypes = true
      if (/\.model$/i.test(entry.fileName)) model = true
    }
    return contentTypes && model ? null : "is not a valid 3MF file (no 3D model inside)"
  } catch {
    return "is not a valid 3MF file"
  } finally {
    zip?.close()
  }
}

export function contentTypeForModel(extension: string) {
  return extension === "3mf" ? "model/3mf" : "model/stl"
}

export function safeFileName(path: string) {
  const base = path.split("/").pop() || "file"
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120)
}
