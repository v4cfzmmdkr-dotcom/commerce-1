import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { rename } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { buildPackage, sampleFiles, sampleProduct, solidPng, zipBuffer } from "@/lib/bulk-import/test-package"

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))

// Runs against a throwaway Postgres database, for example:
// BULK_IMPORT_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/bulktest pnpm test
const url = process.env.BULK_IMPORT_TEST_DATABASE_URL

type Libs = {
  batches: typeof import("@/lib/bulk-import/batches")
  worker: typeof import("@/lib/bulk-import/process")
  store: typeof import("@/lib/bulk-import/package-store")
}

describe.skipIf(!url)("bulk import end to end", () => {
  const original = process.cwd()
  const work = mkdtempSync(path.join(tmpdir(), "bulk-import-test-"))
  let libs: Libs
  let sql: ReturnType<typeof import("@/db/client")["getSql"]>

  async function upload(zip: Buffer, name = "package.zip") {
    const batch = await libs.batches.createBatch(name, zip.length, "owner@example.com")
    await libs.store.writeLocalPackage(batch.objectPath, new Blob([new Uint8Array(zip)]).stream())
    const result = await libs.batches.validateBatch(batch.id)
    return { id: batch.id, objectPath: batch.objectPath, result, batch: (await libs.batches.getBatch(batch.id))! }
  }

  async function drain(batchId: string) {
    for (let step = 0; step < 500; step += 1) {
      await libs.worker.runImportStep({ batchId, budgetMs: 60_000, concurrency: 3 })
      if (!(await libs.worker.queueRemaining(batchId))) return
    }
    throw new Error("Import did not finish")
  }

  async function importAll(batchId: string, publish = true) {
    await libs.batches.approveAllValid(batchId)
    await libs.batches.queueApproved(batchId, publish)
    await drain(batchId)
    return libs.batches.batchCounts(batchId)
  }

  async function items(batchId: string) {
    return sql<Array<{ id: string, externalId: string, status: string, decision: string, action: string, errors: string[], warnings: string[], productId: string | null, attempts: number, blocked: boolean }>>`
      select id, external_id as "externalId", status, decision, action, errors, warnings, product_id as "productId", attempts, blocked
      from import_batch_items where batch_id = ${batchId} order by position
    `
  }

  async function packageFor(numbers: number[], options: { packageId?: string, tweak?: (n: number) => Record<string, unknown> } = {}) {
    const files: Record<string, Buffer> = {}
    for (const n of numbers) Object.assign(files, await sampleFiles(n))
    return buildPackage({ products: numbers.map((n) => sampleProduct(n, options.tweak?.(n))), files, packageId: options.packageId })
  }

  beforeAll(async () => {
    if (!/test/i.test(new URL(url!).pathname)) throw new Error("BULK_IMPORT_TEST_DATABASE_URL must point at a database with test in its name")
    process.env.DATABASE_URL = url
    for (const key of ["DATABASE_URL_UNPOOLED", "STORAGE_ENDPOINT", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY", "STORAGE_BUCKET", "STORAGE_PUBLIC_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
      delete process.env[key]
    }
    const { getSql } = await import("@/db/client")
    const { migrate } = await import("@/db/migrate")
    sql = getSql()
    await sql.unsafe("drop schema public cascade; create schema public;")
    await migrate(sql)
    await sql`insert into store_settings (id, name, theme) values ('default', 'Test shop', '{}'::jsonb)`
    await sql`insert into collections (id, handle, title) values ('col-cable', 'cable-management', 'Cable Management')`
    await sql`insert into collections (id, handle, title) values ('col-wall', 'wall-mounts', 'Wall Mounts')`
    process.chdir(work)
    libs = {
      batches: await import("@/lib/bulk-import/batches"),
      worker: await import("@/lib/bulk-import/process"),
      store: await import("@/lib/bulk-import/package-store"),
    }
  })

  afterAll(async () => {
    process.chdir(original)
    rmSync(work, { recursive: true, force: true })
    await sql?.end({ timeout: 5 })
  })

  it("imports a single product with images, print files, source and history", async () => {
    const { id, result } = await upload(await packageFor([1], { packageId: "single" }))
    expect(result).toMatchObject({ ok: true, products: 1, invalid: 0 })
    const counts = await importAll(id)
    expect(counts).toMatchObject({ total: 1, imported: 1, failed: 0, creates: 1 })

    const [item] = await items(id)
    const [product] = await sql<Array<{ title: string, status: string, productType: string, seoTitle: string, metadata: { print: { filamentGrams: number } } }>>`
      select title, status, product_type as "productType", seo_title as "seoTitle", metadata from products where id = ${item.productId}
    `
    expect(product).toMatchObject({ title: "Cable Clip 1", status: "active", productType: "Cable Management", seoTitle: "Cable Clip 1 | Niche Parts" })
    expect(product.metadata.print.filamentGrams).toBe(12.5)

    const variants = await sql<Array<{ sku: string, priceCents: number, weightGrams: number, option1Value: string, option2Value: string }>>`
      select sku, price_cents as "priceCents", weight_grams as "weightGrams", option1_value as "option1Value", option2_value as "option2Value"
      from variants where product_id = ${item.productId} order by position
    `
    expect(variants[0]).toMatchObject({ sku: "NP-IMP-0001", priceCents: 1201, weightGrams: 40, option1Value: "Black", option2Value: "PETG" })
    expect(variants.length).toBeGreaterThan(2)
    expect(variants.every((variant) => variant.weightGrams === 40)).toBe(true)

    const images = await sql<Array<{ storagePath: string, contentType: string, sizeBytes: number, alt: string }>>`
      select storage_path as "storagePath", content_type as "contentType", size_bytes::int as "sizeBytes", alt from product_images where product_id = ${item.productId} order by position
    `
    expect(images).toHaveLength(2)
    expect(images[0]).toMatchObject({ contentType: "image/png", alt: "Cable clip 1 front view" })
    expect(images.every((image) => existsSync(path.join(work, "storage", image.storagePath)))).toBe(true)

    const files = await sql<Array<{ fileName: string, storagePath: string, copies: number, contentType: string }>>`
      select file_name as "fileName", storage_path as "storagePath", copies, content_type as "contentType" from product_print_files where product_id = ${item.productId} order by position
    `
    expect(files.map((file) => [file.fileName, file.copies, file.contentType])).toEqual([["clip.stl", 2, "model/stl"], ["clip.3mf", 1, "model/3mf"]])
    expect(files.every((file) => existsSync(path.join(work, "storage", "print-files", file.storagePath)))).toBe(true)

    const [source] = await sql`select * from product_sources where product_id = ${item.productId}`
    expect(source).toMatchObject({ source_name: "printables", external_id: "model-1", commercial_use: "allowed", licence_name: "CC BY 4.0", creator_name: "Example Maker" })
    const events = await sql`select action from product_import_events where product_id = ${item.productId}`
    expect(events.map((event) => event.action)).toEqual(["created"])
    const linked = await sql`select 1 from collection_products where collection_id = 'col-cable' and product_id = ${item.productId}`
    expect(linked).toHaveLength(1)
    expect((await libs.batches.getBatch(id))!.status).toBe("completed")
  })

  it("updates instead of duplicating when the same package is imported again", async () => {
    const before = await sql<Array<{ count: number }>>`select count(*)::int as count from products`
    const { id, result } = await upload(await packageFor([1], { packageId: "single" }))
    expect(result.ok).toBe(true)
    expect((await libs.batches.getBatch(id))!.warnings.join("\n")).toMatch(/was uploaded on/)
    const [planned] = await items(id)
    expect(planned.action).toBe("update")
    await importAll(id)
    const after = await sql<Array<{ count: number }>>`select count(*)::int as count from products`
    expect(after[0].count).toBe(before[0].count)
    const [item] = await items(id)
    expect(await sql`select 1 from product_images where product_id = ${item.productId}`).toHaveLength(2)
    expect(await sql`select 1 from product_print_files where product_id = ${item.productId}`).toHaveLength(2)
    const [log] = await sql<Array<{ log: Array<{ message: string }> }>>`select log from import_batch_items where id = ${item.id}`
    expect(log.log.at(-1)!.message).toMatch(/Uploaded 0 of 2 images and 0 of 2 print files/)
    const events = await sql`select action from product_import_events where product_id = ${item.productId} order by created_at`
    expect(events.map((event) => event.action)).toEqual(["created", "updated"])
  })

  it("applies product updates and replaces only imported files", async () => {
    const files = await sampleFiles(1)
    const replacement = solidPng([9, 9, 9])
    files["images/model-1/2.png"] = replacement
    delete files["models/model-1/clip.3mf"]
    const zip = await buildPackage({
      products: [sampleProduct(1, { title: "Cable Clip One", price_cents: 1500, shipping_weight_grams: 55, models: [{ path: "models/model-1/clip.stl" }] })],
      files,
      packageId: "update",
    })
    const [{ productId }] = await sql<Array<{ productId: string }>>`select product_id as "productId" from product_sources where external_id = 'model-1'`
    const [oldImage] = await sql<Array<{ storagePath: string }>>`select storage_path as "storagePath" from product_images where product_id = ${productId} order by position offset 1`
    await sql`insert into product_images (id, product_id, url, storage_path, alt, position) values ('manual-image', ${productId}, '/manual.png', null, 'Owner photo', 9)`
    await sql`update products set status = 'draft' where id = ${productId}`

    const { id } = await upload(zip)
    await importAll(id)
    const [product] = await sql<Array<{ title: string, status: string }>>`select title, status from products where id = ${productId}`
    expect(product).toEqual({ title: "Cable Clip One", status: "draft" })
    const variants = await sql<Array<{ option2Value: string, option1Value: string, priceCents: number, weightGrams: number }>>`
      select option1_value as "option1Value", option2_value as "option2Value", price_cents as "priceCents", weight_grams as "weightGrams"
      from variants where product_id = ${productId}
    `
    expect(variants.filter((variant) => variant.option2Value === "PETG").every((variant) => variant.priceCents === 1500)).toBe(true)
    const asa = variants.find((variant) => variant.option2Value === "ASA")
    expect(asa?.priceCents).toBeGreaterThanOrEqual(1500)
    expect(variants.every((variant) => variant.weightGrams === 55)).toBe(true)
    const images = await sql<Array<{ id: string, storagePath: string | null }>>`select id, storage_path as "storagePath" from product_images where product_id = ${productId} order by position`
    expect(images).toHaveLength(3)
    expect(images.some((image) => image.id === "manual-image")).toBe(true)
    expect(existsSync(path.join(work, "storage", oldImage.storagePath))).toBe(false)
    expect(await sql`select 1 from product_print_files where product_id = ${productId}`).toHaveLength(1)
  })

  it("imports 500 products in resumable steps", async () => {
    const numbers = Array.from({ length: 500 }, (_, index) => 1000 + index)
    const zip = await packageFor(numbers, { packageId: "five-hundred" })
    const started = Date.now()
    const { id, result } = await upload(zip)
    expect(result).toMatchObject({ ok: true, products: 500, invalid: 0 })
    await libs.batches.approveAllValid(id)
    await libs.batches.queueApproved(id, false)
    let steps = 0
    while (await libs.worker.queueRemaining(id)) {
      await libs.worker.runImportStep({ batchId: id, budgetMs: 1_000, concurrency: 3 })
      steps += 1
    }
    const counts = await libs.batches.batchCounts(id)
    expect(counts).toMatchObject({ total: 500, imported: 500, failed: 0 })
    expect(steps).toBeGreaterThan(1)
    const [created] = await sql<Array<{ count: number }>>`select count(*)::int as count from product_sources where last_batch_id = ${id}`
    expect(created.count).toBe(500)
    const [drafts] = await sql<Array<{ count: number }>>`select count(*)::int as count from products p join product_sources s on s.product_id = p.id where s.last_batch_id = ${id} and p.status = 'draft'`
    expect(drafts.count).toBe(500)
    console.info(`[bulk-import test] 500 products validated and imported in ${((Date.now() - started) / 1000).toFixed(1)}s over ${steps} steps`)
  }, 600_000)

  it("rejects invalid JSON", async () => {
    const zip = await buildPackage({ products: [sampleProduct(1)], files: await sampleFiles(1), productsText: "{ \"schema_version\": \"1.0\", \"products\": [ { ,] }" })
    const { id, result } = await upload(zip)
    expect(result.ok).toBe(false)
    const batch = await libs.batches.getBatch(id)
    expect(batch!.status).toBe("invalid")
    expect(batch!.errors[0]).toMatch(/^products.json is not valid JSON/)
    expect(await items(id)).toHaveLength(0)
  })

  it("marks products with missing images or models invalid and imports the rest", async () => {
    const files = { ...(await sampleFiles(2001)), ...(await sampleFiles(2002)), ...(await sampleFiles(2003)) }
    delete files["images/model-2002/2.png"]
    delete files["models/model-2003/clip.stl"]
    const zip = await buildPackage({ products: [2001, 2002, 2003].map((n) => sampleProduct(n)), files, withHashes: false })
    const { id } = await upload(zip)
    const list = await items(id)
    expect(list.map((item) => item.status)).toEqual(["ready", "invalid", "invalid"])
    expect(list[1].errors[0]).toBe("images/model-2002/2.png is listed but is not in the ZIP")
    expect(list[2].errors[0]).toBe("models/model-2003/clip.stl is listed but is not in the ZIP")
    expect(await libs.batches.setDecision(id, [list[1].id], "approved")).toBe(0)
    const counts = await importAll(id)
    expect(counts).toMatchObject({ imported: 1, invalid: 2 })
  })

  it("rejects oversized files, ZIP bombs and unsafe paths", async () => {
    const big = Buffer.concat([solidPng([1, 1, 1]), Buffer.alloc(13 * 1024 * 1024)])
    const oversized = await upload(await buildPackage({ products: [sampleProduct(1)], files: { ...(await sampleFiles(1)), "images/model-1/1.png": big }, withHashes: false }))
    expect(oversized.batch.errors.join("\n")).toMatch(/images\/model-1\/1.png is 13.0MB; the limit for this file type is 12MB/)

    const bomb = await upload(await buildPackage({ products: [sampleProduct(1)], files: { ...(await sampleFiles(1)), "models/model-1/clip.stl": Buffer.alloc(30 * 1024 * 1024) }, withHashes: false }))
    expect(bomb.batch.errors.join("\n")).toMatch(/looks like a ZIP bomb/)

    const crafted = await buildPackage({ products: [sampleProduct(1)], files: await sampleFiles(1), withHashes: false, extra: [{ name: "aa/evil.png", bytes: solidPng([0, 0, 0]) }] })
    const malicious = Buffer.from(crafted.toString("latin1").replaceAll("aa/evil.png", "../evil.png"), "latin1")
    const traversal = await upload(malicious)
    expect(traversal.batch.status).toBe("invalid")
    expect(traversal.batch.errors[0]).toMatch(/unsafe file path/)
    expect(existsSync(path.join(work, "private-storage", "evil.png"))).toBe(false)
  })

  it("resumes an import that was interrupted mid-product", async () => {
    const { id } = await upload(await packageFor([3001, 3002], { packageId: "interrupted" }))
    await libs.batches.approveAllValid(id)
    await libs.batches.queueApproved(id, true)
    const claimed = await libs.worker.claimNextItem(id)
    expect(claimed).not.toBeNull()
    expect(await libs.worker.runImportStep({ batchId: id, budgetMs: 10_000 })).toMatchObject({ imported: 1 })
    const stuck = (await items(id)).find((item) => item.id === claimed!.id)!
    expect(stuck.status).toBe("processing")
    await sql`update import_batch_items set locked_until = now() - interval '1 second' where id = ${claimed!.id}`
    await drain(id)
    const list = await items(id)
    expect(list.every((item) => item.status === "imported")).toBe(true)
    expect(list.find((item) => item.id === claimed!.id)!.attempts).toBe(2)
    expect((await libs.batches.getBatch(id))!.status).toBe("completed")
  })

  it("fails bad files permanently and retries transient failures", async () => {
    const files = await sampleFiles(4001)
    files["models/model-4001/clip.stl"] = Buffer.from("MZ".padEnd(684, "x"))
    const bad = await upload(await buildPackage({ products: [sampleProduct(4001)], files, packageId: "bad-stl" }))
    expect(await importAll(bad.id)).toMatchObject({ failed: 1, imported: 0 })
    const [failed] = await items(bad.id)
    expect(failed.errors[0]).toBe("models/model-4001/clip.stl is not a valid STL file")
    expect(failed.attempts).toBe(1)

    const good = await upload(await packageFor([4002], { packageId: "transient" }))
    await rename(path.join(work, "storage"), path.join(work, "storage-moved"))
    writeFileSync(path.join(work, "storage"), "blocks the folder")
    expect(await importAll(good.id)).toMatchObject({ failed: 1, imported: 0 })
    const [retried] = await items(good.id)
    expect(retried.attempts).toBe(3)
    expect(retried.errors[0]).toMatch(/^Attempt 3 failed/)
    rmSync(path.join(work, "storage"))
    await rename(path.join(work, "storage-moved"), path.join(work, "storage"))
    expect(await libs.batches.retryFailed(good.id)).toBe(1)
    await drain(good.id)
    expect((await items(good.id))[0].status).toBe("imported")

    const missing = await upload(await packageFor([4003], { packageId: "missing-package" }))
    await libs.batches.approveAllValid(missing.id)
    await libs.batches.queueApproved(missing.id, true)
    await sql`update import_batches set package_path = 'bulk-imports/gone/package.zip' where id = ${missing.id}`
    await drain(missing.id)
    const [lost] = await items(missing.id)
    expect(lost.status).toBe("failed")
    expect(lost.errors[0]).toMatch(/package file is missing/)
    await sql`update import_batches set package_path = ${missing.objectPath} where id = ${missing.id}`
    await libs.batches.retryFailed(missing.id)
    await drain(missing.id)
    expect((await items(missing.id))[0].status).toBe("imported")
  })

  it("matches existing products by SKU and refuses SKU clashes", async () => {
    await sql`insert into products (id, handle, title) values ('manual-product', 'manual-product', 'Hand made listing')`
    await sql`insert into variants (id, product_id, sku, price_cents, option1_name, option1_value, option2_name, option2_value) values ('manual-variant', 'manual-product', 'MANUAL-1', 900, 'Colour', 'Black', 'Material', 'PETG')`
    const zip = await buildPackage({
      products: [
        sampleProduct(5001, { sku: "MANUAL-1" }),
        sampleProduct(5002, { sku: "NP-IMP-1000" }),
      ],
      files: { ...(await sampleFiles(5001)), ...(await sampleFiles(5002)) },
    })
    const { id } = await upload(zip)
    const list = await items(id)
    expect(list[0]).toMatchObject({ action: "update", status: "ready" })
    expect(list[0].warnings.join("\n")).toMatch(/Matched the existing product "Hand made listing" by SKU/)
    expect(list[1].status).toBe("invalid")
    expect(list[1].errors[0]).toMatch(/SKU NP-IMP-1000 belongs to "Cable Clip 1000", which was imported from printables:model-1000/)
    await importAll(id)
    const [source] = await sql`select product_id from product_sources where external_id = 'model-5001'`
    expect(source.product_id).toBe("manual-product")
    expect(await sql`select 1 from products where title = 'Cable Clip 5001'`).toHaveLength(1)
    const [manual] = await sql`select title from products where id = 'manual-product'`
    expect(manual.title).toBe("Cable Clip 5001")
  })

  it("only imports approved products and never ones whose licence forbids sale", async () => {
    const zip = await buildPackage({
      products: [
        sampleProduct(6001),
        sampleProduct(6002),
        sampleProduct(6003, { licence: { name: "CC BY-NC 4.0", commercial_use: "not_allowed" } }),
      ],
      files: { ...(await sampleFiles(6001)), ...(await sampleFiles(6002)), ...(await sampleFiles(6003)) },
    })
    const { id } = await upload(zip)
    const list = await items(id)
    expect(list[2]).toMatchObject({ blocked: true, decision: "rejected", status: "invalid" })
    expect(await libs.batches.setDecision(id, [list[2].id], "approved")).toBe(0)
    await libs.batches.setDecision(id, [list[0].id], "approved")
    await libs.batches.setDecision(id, [list[1].id], "rejected")
    await libs.batches.queueApproved(id, true)
    await drain(id)
    expect((await items(id)).map((item) => item.status)).toEqual(["imported", "ready", "invalid"])
    expect(await sql`select 1 from product_sources where external_id in ('model-6002', 'model-6003')`).toHaveLength(0)
  })

  it("keeps working when the package is wrapped in a folder", async () => {
    const files = await sampleFiles(7001)
    const inner = await buildPackage({ products: [sampleProduct(7001)], files })
    const { default: yauzl } = await import("yauzl")
    const zip = await yauzl.fromBufferPromise(inner, { lazyEntries: true })
    const entries: Array<{ name: string, bytes: Buffer }> = []
    for await (const entry of zip.eachEntry()) {
      const stream = await zip.openReadStreamPromise(entry)
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      entries.push({ name: `export-2026/${entry.fileName}`, bytes: Buffer.concat(chunks) })
    }
    entries.push({ name: "__MACOSX/export-2026/._manifest.json", bytes: Buffer.from("junk") })
    const { id, batch } = await upload(await zipBuffer(entries))
    expect(batch.packageRoot).toBe("export-2026/")
    expect(await importAll(id)).toMatchObject({ imported: 1 })
  })

  it("lets the sourcing app upload, import and categorise a package with an API key", async () => {
    const { createApiKey, revokeApiKey } = await import("@/lib/api-keys")
    const ping = await import("@/app/api/sourcing/v1/route")
    const batches = await import("@/app/api/sourcing/v1/batches/route")
    const report = await import("@/app/api/sourcing/v1/batches/[id]/route")
    const upload = await import("@/app/api/sourcing/v1/batches/[id]/package/route")
    const validate = await import("@/app/api/sourcing/v1/batches/[id]/validate/route")
    const start = await import("@/app/api/sourcing/v1/batches/[id]/import/route")
    const step = await import("@/app/api/sourcing/v1/batches/[id]/step/route")
    const base = "http://shop.test/api/sourcing/v1"
    const { id: keyId, key } = await createApiKey("Sourcing app", "owner@example.com")
    const { key: otherKey } = await createApiKey("Another app", "owner@example.com")
    const auth = (value = key) => ({ authorization: `Bearer ${value}` })
    const call = async (response: Response | Promise<Response>) => {
      const result = await response
      return { status: result.status, body: await result.json() }
    }

    expect((await call(ping.GET(new Request(base)))).status).toBe(401)
    expect((await call(ping.GET(new Request(base, { headers: auth("np_" + "x".repeat(43)) })))).status).toBe(401)
    const hello = await call(ping.GET(new Request(base, { headers: auth() })))
    expect(hello.body).toMatchObject({ ok: true, key: "Sourcing app", uploads: true, schemaVersion: "1.0" })
    expect(hello.body.collections.map((row: { handle: string }) => row.handle)).toContain("wall-mounts")

    const files = { ...(await sampleFiles(8001)), ...(await sampleFiles(8002)) }
    const zip = await buildPackage({
      products: [
        sampleProduct(8001),
        sampleProduct(8002, { title: "Wall bracket for a home router", category: "Brackets", tags: ["router", "bracket"] }),
      ],
      files,
      packageId: "sourcing-app-test",
    })
    const created = await call(batches.POST(new Request(`${base}/batches`, {
      method: "POST",
      headers: { ...auth(), "content-type": "application/json" },
      body: JSON.stringify({ fileName: "sourcing-app-test.zip", size: zip.length }),
    })))
    expect(created.status).toBe(201)
    expect(created.body.upload).toMatchObject({ method: "PUT", authorization: true })
    const batchId = created.body.batchId as string
    const params = Promise.resolve({ id: batchId })

    const put = await call(upload.PUT(new Request(created.body.upload.url, {
      method: "PUT",
      headers: { ...auth(), "content-type": "application/zip" },
      body: new Uint8Array(zip),
    }), { params }))
    expect(put.body).toMatchObject({ ok: true, size: zip.length })

    expect((await call(report.GET(new Request(`${base}/batches/${batchId}`, { headers: auth(otherKey) }), { params }))).status).toBe(404)

    const checked = await call(validate.POST(new Request(`${base}/batches/${batchId}/validate`, { method: "POST", headers: auth() }), { params }))
    expect(checked.body).toMatchObject({ ok: true, status: "review", counts: { total: 2, invalid: 0 } })
    expect(checked.body.items[1].warnings.join(" ")).toMatch(/added to Wall Mounts, matched automatically/)

    const queued = await call(start.POST(new Request(`${base}/batches/${batchId}/import`, {
      method: "POST",
      headers: { ...auth(), "content-type": "application/json" },
      body: JSON.stringify({ publish: true }),
    }), { params }))
    expect(queued.body).toMatchObject({ ok: true, approved: 2, queued: 2 })

    let remaining = 2
    for (let attempt = 0; attempt < 10 && remaining; attempt += 1) {
      const result = await call(step.POST(new Request(`${base}/batches/${batchId}/step`, { method: "POST", headers: auth() }), { params }))
      remaining = result.body.remaining
    }
    const done = await call(report.GET(new Request(`${base}/batches/${batchId}`, { headers: auth() }), { params }))
    expect(done.body).toMatchObject({ status: "completed", counts: { imported: 2, failed: 0 } })
    const [clip, bracket] = done.body.items
    expect(clip).toMatchObject({ externalId: "model-8001", status: "imported", productStatus: "active", collections: ["Cable Management"] })
    expect(bracket.collections).toEqual(["Wall Mounts"])
    expect(bracket.handle).toBe("wall-bracket-for-a-home-router")
    const [{ printFiles }] = await sql`select count(*)::int as "printFiles" from product_print_files where product_id = ${bracket.productId}`
    expect(printFiles).toBe(2)

    await revokeApiKey(keyId)
    expect((await call(report.GET(new Request(`${base}/batches/${batchId}`, { headers: auth() }), { params }))).status).toBe(401)
  })

  it("archives previous listings and restores them exactly", async () => {
    const { archivePreviousListings, previousListingSummary, restorePreviousListings } = await import("@/lib/bulk-import/archive")
    await sql`
      insert into products (id, handle, title, status) values
        ('old-live', 'old-live', 'Old live listing', 'active'),
        ('old-draft', 'old-draft', 'Old draft listing', 'draft'),
        ('old-hidden', 'old-hidden', 'Already archived listing', 'archived')
    `
    const statuses = async () => Object.fromEntries((await sql<Array<{ id: string, status: string }>>`
      select p.id, p.status from products p
      where p.id like 'old-%' or exists (select 1 from product_sources s where s.product_id = p.id)
    `).map((row) => [row.id, row.status]))
    const before = await statuses()
    const sourced = Object.keys(before).filter((id) => !id.startsWith("old-"))
    expect(sourced.length).toBeGreaterThan(0)

    const summary = await previousListingSummary()
    expect(summary.archivedByTool).toBe(0)
    const archived = await archivePreviousListings()
    expect(archived).toBe(summary.active + summary.draft)
    const after = await statuses()
    expect(after).toMatchObject({ "old-live": "archived", "old-draft": "archived", "old-hidden": "archived" })
    for (const id of sourced) expect(after[id]).toBe(before[id])
    expect((await previousListingSummary()).archivedByTool).toBe(archived)

    expect(await restorePreviousListings()).toBe(archived)
    expect(await statuses()).toEqual(before)
    const [{ leftovers }] = await sql`select count(*)::int as leftovers from products where metadata ? 'archivedPreviousStatus'`
    expect(leftovers).toBe(0)
  })

  // Checks a package made by another tool: BULK_IMPORT_TEST_PACKAGE=/path/to/package.zip
  it.runIf(process.env.BULK_IMPORT_TEST_PACKAGE)("imports an external package without errors", async () => {
    const zip = readFileSync(path.resolve(original, process.env.BULK_IMPORT_TEST_PACKAGE!))
    const { id, result, batch } = await upload(zip, path.basename(process.env.BULK_IMPORT_TEST_PACKAGE!))
    expect(batch.errors).toEqual([])
    expect(result).toMatchObject({ ok: true, invalid: 0 })
    const counts = await importAll(id)
    const problems = (await items(id)).filter((item) => item.status !== "imported")
    expect(problems.map((item) => `${item.externalId}: ${item.errors.join("; ")}`)).toEqual([])
    expect(counts.imported).toBe(counts.total)
  })
})
