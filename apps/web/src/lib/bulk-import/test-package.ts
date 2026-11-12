import { createHash } from "node:crypto"
import { deflateSync } from "node:zlib"
import yazl from "yazl"
import { packageSchemaId } from "@/lib/bulk-import/schema"

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Buffer) {
  let c = 0xffffffff
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

export function solidPng(rgb: [number, number, number], size = 8) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 2
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).map((_, index) => rgb[index % 3])])
  const pixels = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

export function cubeStl(size = 10) {
  const v = [[0, 0, 0], [size, 0, 0], [size, size, 0], [0, size, 0], [0, 0, size], [size, 0, size], [size, size, size], [0, size, size]]
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3]]
  const bytes = Buffer.alloc(84 + faces.length * 50)
  bytes.write("cube", 0, "ascii")
  bytes.writeUInt32LE(faces.length, 80)
  faces.forEach((face, index) => {
    const offset = 84 + index * 50 + 12
    face.forEach((vertex, corner) => v[vertex].forEach((value, axis) => bytes.writeFloatLE(value, offset + corner * 12 + axis * 4)))
  })
  return bytes
}

export function zipBuffer(entries: Array<{ name: string, bytes: Buffer, compress?: boolean }>) {
  return new Promise<Buffer>((resolve, reject) => {
    const zip = new yazl.ZipFile()
    for (const entry of entries) zip.addBuffer(entry.bytes, entry.name, { compress: entry.compress ?? true, mtime: new Date(2026, 0, 1) })
    const chunks: Buffer[] = []
    zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk))
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)))
    zip.outputStream.on("error", reject)
    zip.end()
  })
}

export function cube3mf() {
  return zipBuffer([
    {
      name: "[Content_Types].xml",
      bytes: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    },
    {
      name: "_rels/.rels",
      bytes: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    },
    {
      name: "3D/3dmodel.model",
      bytes: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/><vertex x="0" y="10" z="0"/><vertex x="0" y="0" z="10"/></vertices><triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="1" v2="2" v3="3"/><triangle v1="0" v2="3" v3="2"/></triangles></mesh></object></resources><build><item objectid="1"/></build></model>'),
    },
  ])
}

export function sampleProduct(n: number, overrides: Record<string, unknown> = {}) {
  return {
    external_id: `model-${n}`,
    source: { name: "printables", url: `https://www.printables.com/model/${100000 + n}` },
    creator: { name: "Example Maker", url: "https://www.printables.com/@example" },
    licence: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      commercial_use: "allowed",
      attribution_required: true,
      notes: "Credit the designer on the listing.",
    },
    title: `Cable Clip ${n}`,
    description_html: `<p>A tidy clip for 6 mm cables. Design ${n}.</p>`,
    seo: { title: `Cable Clip ${n} | Niche Parts`, description: "Printed cable clip for 6 mm cables." },
    category: "Cable Management",
    tags: ["cable", "clip"],
    sku: `NP-IMP-${String(n).padStart(4, "0")}`,
    price_cents: 1200 + n,
    print: { filament_type: "PETG", filament_grams: 12.5, print_minutes: 45 },
    shipping_weight_grams: 40,
    images: [
      { path: `images/model-${n}/1.png`, alt: `Cable clip ${n} front view` },
      { path: `images/model-${n}/2.png`, alt: `Cable clip ${n} side view` },
    ],
    models: [
      { path: `models/model-${n}/clip.stl`, copies: 2, notes: "No supports" },
      { path: `models/model-${n}/clip.3mf` },
    ],
    ...overrides,
  }
}

export async function sampleFiles(n: number) {
  return {
    [`images/model-${n}/1.png`]: solidPng([n % 256, 120, 200]),
    [`images/model-${n}/2.png`]: solidPng([200, n % 256, 120]),
    [`models/model-${n}/clip.stl`]: cubeStl(10 + (n % 50)),
    [`models/model-${n}/clip.3mf`]: await cube3mf(),
  } as Record<string, Buffer>
}

export async function buildPackage(options: {
  products: unknown[]
  files: Record<string, Buffer>
  manifest?: Record<string, unknown>
  productsText?: string
  manifestText?: string
  withHashes?: boolean
  extra?: Array<{ name: string, bytes: Buffer, compress?: boolean }>
  packageId?: string
}) {
  const files = Object.entries(options.files).map(([path, bytes]) => ({ path, bytes }))
  const manifest = {
    schema: packageSchemaId,
    schema_version: "1.0",
    package_id: options.packageId ?? "test-package",
    generated_at: "2026-11-12T10:00:00Z",
    generator: { name: "test-suite", version: "1" },
    currency: "AUD",
    product_count: options.products.length,
    ...(options.withHashes === false ? {} : {
      files: files.map((file) => ({ path: file.path, size: file.bytes.length, sha256: createHash("sha256").update(file.bytes).digest("hex") })),
    }),
    ...options.manifest,
  }
  return zipBuffer([
    { name: "manifest.json", bytes: Buffer.from(options.manifestText ?? JSON.stringify(manifest, null, 2)) },
    { name: "products.json", bytes: Buffer.from(options.productsText ?? JSON.stringify({ schema_version: "1.0", products: options.products }, null, 2)) },
    ...files.map((file) => ({ name: file.path, bytes: file.bytes, compress: !file.path.endsWith(".png") })),
    ...(options.extra ?? []),
  ])
}
