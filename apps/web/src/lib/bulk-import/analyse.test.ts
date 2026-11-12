import { describe, expect, it } from "vitest"
import { analysePackage } from "@/lib/bulk-import/analyse"
import type { PackageFile } from "@/lib/bulk-import/files"
import { packageSchemaId } from "@/lib/bulk-import/schema"
import { sampleProduct } from "@/lib/bulk-import/test-package"

function filesFor(...numbers: number[]): PackageFile[] {
  return numbers.flatMap((n) => [
    { path: `images/model-${n}/1.png`, kind: "image" as const, size: 100 },
    { path: `images/model-${n}/2.png`, kind: "image" as const, size: 100 },
    { path: `models/model-${n}/clip.stl`, kind: "model" as const, size: 684 },
    { path: `models/model-${n}/clip.3mf`, kind: "model" as const, size: 900 },
  ])
}

function manifest(count: number, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ schema: packageSchemaId, schema_version: "1.0", package_id: "run-1", product_count: count, ...extra })
}

function run(products: unknown[], files = filesFor(...products.map((_, index) => index + 1)), manifestText = manifest(products.length)) {
  return analysePackage({
    files,
    manifestText,
    productsText: JSON.stringify({ schema_version: "1.0", products }),
    shopMaterials: ["PETG", "ASA"],
  })
}

describe("analysePackage", () => {
  it("accepts a valid single product", () => {
    const result = run([sampleProduct(1)])
    expect(result.errors).toEqual([])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ sourceName: "printables", externalId: "model-1", sku: "NP-IMP-0001", errors: [], blocked: false })
    expect(result.items[0].data?.models[1].copies).toBe(1)
  })

  it("accepts products without print files", () => {
    const withoutField = sampleProduct(2) as Record<string, unknown>
    delete withoutField.models
    const files = filesFor(1, 2).filter((file) => file.kind !== "model")
    const result = run([sampleProduct(1, { models: [] }), withoutField], files)
    expect(result.errors).toEqual([])
    expect(result.items.map((item) => [item.errors, item.data?.models])).toEqual([[[], []], [[], []]])
  })

  it("rejects invalid JSON with a clear message", () => {
    const bad = analysePackage({ files: [], manifestText: manifest(1), productsText: "{\"products\": [", shopMaterials: [] })
    expect(bad.errors[0]).toMatch(/^products.json is not valid JSON/)
    const badManifest = analysePackage({ files: [], manifestText: "nope", productsText: "{}", shopMaterials: [] })
    expect(badManifest.errors[0]).toMatch(/^manifest.json is not valid JSON/)
  })

  it("rejects the wrong schema and unsupported versions", () => {
    expect(run([sampleProduct(1)], filesFor(1), JSON.stringify({ schema: "other", schema_version: "1.0", package_id: "x", product_count: 1 })).errors[0])
      .toMatch(/manifest.json: schema must be "nicheparts.product-package"/)
    expect(run([sampleProduct(1)], filesFor(1), manifest(1, { schema_version: "2.0" })).errors[0]).toMatch(/2.0 is not supported/)
    const newer = analysePackage({
      files: filesFor(1),
      manifestText: manifest(1, { schema_version: "1.3" }),
      productsText: JSON.stringify({ schema_version: "1.3", products: [sampleProduct(1)] }),
      shopMaterials: [],
    })
    expect(newer.errors).toEqual([])
    expect(newer.warnings[0]).toMatch(/newer than 1.0/)
  })

  it("rejects incomplete packages", () => {
    expect(run([sampleProduct(1)], filesFor(1), manifest(2)).errors[0]).toMatch(/says 2 products but products.json lists 1/)
    const hashes = manifest(1, { files: [{ path: "images/model-1/1.png", size: 5, sha256: "a".repeat(64) }] })
    const errors = run([sampleProduct(1)], filesFor(1), hashes).errors.join("\n")
    expect(errors).toMatch(/is 100 bytes but manifest.json says 5/)
    expect(errors).toMatch(/3 files are in the ZIP but not in manifest.json/)
  })

  it("marks products with missing images or models invalid", () => {
    const files = filesFor(1).filter((file) => !file.path.endsWith("2.png") && !file.path.endsWith(".3mf"))
    const result = run([sampleProduct(1)], files)
    expect(result.errors).toEqual([])
    expect(result.items[0].errors).toEqual([
      "images/model-1/2.png is listed but is not in the ZIP",
      "models/model-1/clip.3mf is listed but is not in the ZIP",
    ])
  })

  it("reports field errors with their path", () => {
    const result = run([sampleProduct(1, { price_cents: 12.5, sku: "bad sku", images: [], licence: { name: "x" } })])
    const errors = result.items[0].errors.join("\n")
    expect(result.items[0].data).toBeNull()
    expect(errors).toMatch(/price_cents must be whole cents/)
    expect(errors).toMatch(/sku may only use/)
    expect(errors).toMatch(/images needs at least one image/)
    expect(errors).toMatch(/licence.commercial_use/)
  })

  it("rejects duplicate source IDs and SKUs inside one package", () => {
    const duplicateId = run([sampleProduct(1), sampleProduct(2, { external_id: "model-1" })])
    expect(duplicateId.errors[0]).toMatch(/share the external ID printables:model-1/)
    const duplicateSku = run([sampleProduct(1), sampleProduct(2, { sku: "np-imp-0001" })])
    expect(duplicateSku.errors[0]).toMatch(/share the SKU/)
  })

  it("blocks licences that forbid commercial use and flags unknown ones", () => {
    const result = run([
      sampleProduct(1, { licence: { name: "CC BY-NC 4.0", commercial_use: "not_allowed" } }),
      sampleProduct(2, { licence: { name: "Custom", commercial_use: "unknown" } }),
    ])
    expect(result.items[0].blocked).toBe(true)
    expect(result.items[0].errors[0]).toMatch(/does not allow commercial use/)
    expect(result.items[1].blocked).toBe(false)
    expect(result.items[1].warnings.join("\n")).toMatch(/Commercial use is not confirmed/)
  })

  it("warns about unused files, foreign materials and long SEO text", () => {
    const result = run(
      [sampleProduct(1, { print: { filament_type: "TPU", filament_grams: 5, print_minutes: 20 }, seo: { title: "x".repeat(80), description: "" } })],
      [...filesFor(1), { path: "images/spare.png", kind: "image", size: 1 }],
    )
    expect(result.warnings.join("\n")).toMatch(/1 file is in the ZIP but not used/)
    expect(result.items[0].warnings.join("\n")).toMatch(/TPU is not one of the shop's materials/)
    expect(result.items[0].warnings.join("\n")).toMatch(/SEO title is 80 characters/)
  })

  it("rejects a model file listed as an image", () => {
    const result = run([sampleProduct(1, { images: [{ path: "models/model-1/clip.stl", alt: "" }] })])
    expect(result.items[0].errors[0]).toMatch(/must be in the images\/ folder/)
  })
})
