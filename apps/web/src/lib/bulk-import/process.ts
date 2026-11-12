import { createHash, randomUUID } from "node:crypto"
import type { TransactionSql } from "postgres"
import { getSql, textArrayLiteral } from "@/db/client"
import { getBatch, refreshBatchStatus, type Batch, type BatchFile } from "@/lib/bulk-import/batches"
import { categorise, loadCategoriser, type Categorisation } from "@/lib/bulk-import/categorise"
import { check3mf, checkStl, contentTypeForModel, extensionOf, safeFileName, sniffImage } from "@/lib/bulk-import/files"
import { PackageError, openPackage, readPackageEntry, savePrivateFile } from "@/lib/bulk-import/package-store"
import { limits, type PackageProduct } from "@/lib/bulk-import/schema"
import { basePriceTargets, baseVariant } from "@/lib/bulk-import/variants"
import { cleanHtml } from "@/lib/html"
import { deletePrintFileObject } from "@/lib/print-files"
import { repriceMaterials, shopEnabledMaterials, syncProductOptions } from "@/lib/product-options-sync"
import { slugify } from "@/lib/slug"
import { deleteObject, saveObject } from "@/lib/storage"

export const leaseSeconds = 120
export const maxAttempts = 3

// Problems with the package itself; retrying will not help.
export class ItemError extends Error {}

type ClaimedItem = {
  id: string
  batchId: string
  data: PackageProduct | string
  matchProductId: string | null
  productId: string | null
  attempts: number
  sourceName: string
  externalId: string
}

type StoredImage = { hash: string, path: string, url: string, type: string, size: number, alt: string }
type StoredModel = { hash: string, path: string, type: string, size: number, fileName: string, copies: number, notes: string }

type Tx = TransactionSql

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex")
}

function parseData(value: PackageProduct | string) {
  return (typeof value === "string" ? JSON.parse(value) : value) as PackageProduct
}

async function appendLog(itemId: string, message: string) {
  const sql = getSql()
  await sql`
    update import_batch_items
    set log = log || ${sql.json([{ at: new Date().toISOString(), message: message.slice(0, 500) }])}
    where id = ${itemId}
  `
}

export async function claimNextItem(batchId?: string) {
  const sql = getSql()
  const rows = await sql<ClaimedItem[]>`
    update import_batch_items set
      status = 'processing',
      locked_until = now() + make_interval(secs => ${leaseSeconds}),
      attempts = attempts + 1,
      updated_at = now()
    where id = (
      select i.id from import_batch_items i
      join import_batches b on b.id = i.batch_id
      where b.status = 'importing'
        and i.decision = 'approved'
        and (i.status = 'queued' or (i.status = 'processing' and i.locked_until < now()))
        ${batchId ? sql`and i.batch_id = ${batchId}` : sql``}
      order by b.created_at, i.position
      limit 1
      for update of i skip locked
    )
    returning id, batch_id as "batchId", data, match_product_id as "matchProductId", product_id as "productId",
      attempts, source_name as "sourceName", external_id as "externalId"
  `
  return rows[0] ?? null
}

async function targetProductId(item: ClaimedItem) {
  const sql = getSql()
  const [source] = await sql<Array<{ productId: string }>>`
    select product_id as "productId" from product_sources
    where source_name = ${item.sourceName} and external_id = ${item.externalId}
  `
  if (source) return source.productId
  if (item.matchProductId) {
    const [match] = await sql<Array<{ id: string }>>`select id from products where id = ${item.matchProductId}`
    if (match) return match.id
  }
  const planned = item.productId ?? randomUUID()
  if (!item.productId) await sql`update import_batch_items set product_id = ${planned} where id = ${item.id}`
  return planned
}

function fileFor(batch: Batch, path: string): BatchFile {
  const file = batch.files.find((candidate) => candidate.path.toLowerCase() === path.toLowerCase())
  if (!file) throw new ItemError(`${path} is not in the package`)
  return file
}

async function readFile(batch: Batch, path: string, maxBytes: number) {
  if (!batch.packagePath) throw new ItemError("The package file was removed. Upload it again to import this product")
  const file = fileFor(batch, path)
  const pkg = await openPackage(batch.packagePath)
  let bytes: Buffer
  try {
    bytes = await readPackageEntry(pkg, `${batch.packageRoot}${file.path}`, maxBytes)
  } catch (error) {
    if (error instanceof PackageError) throw new ItemError(error.message)
    throw error
  }
  const hash = sha256(bytes)
  if (file.sha256 && file.sha256 !== hash) throw new ItemError(`${file.path} does not match the SHA-256 in manifest.json. The file is damaged`)
  return { bytes, hash, file }
}

async function storeImages(batch: Batch, productId: string, data: PackageProduct) {
  const sql = getSql()
  const existing = await sql<Array<{ hash: string, path: string | null, url: string, type: string, size: number }>>`
    select content_hash as hash, storage_path as path, url, content_type as type, size_bytes::float8 as size
    from product_images where product_id = ${productId} and content_hash is not null
  `
  const known = new Map(existing.map((row) => [row.hash, row]))
  const stored: StoredImage[] = []
  let uploaded = 0
  for (const image of data.images) {
    const { bytes, hash, file } = await readFile(batch, image.path, limits.imageBytes)
    const kind = sniffImage(bytes)
    if (!kind) throw new ItemError(`${file.path} is not a real JPEG, PNG or WebP image`)
    if (stored.some((item) => item.hash === hash)) continue
    const alt = image.alt || data.title
    const previous = known.get(hash)
    if (previous?.path) {
      stored.push({ hash, path: previous.path, url: previous.url, type: kind.type, size: bytes.length, alt })
      continue
    }
    const saved = await saveObject(`imports/${slugify(productId)}/${hash.slice(0, 32)}.${kind.extension}`, bytes, kind.type)
    uploaded += 1
    stored.push({ hash, path: saved.path, url: saved.url, type: kind.type, size: bytes.length, alt })
  }
  return { stored, uploaded }
}

async function storeModels(batch: Batch, productId: string, data: PackageProduct) {
  const sql = getSql()
  const existing = await sql<Array<{ hash: string, path: string }>>`
    select content_hash as hash, storage_path as path
    from product_print_files where product_id = ${productId} and content_hash is not null
  `
  const known = new Map(existing.map((row) => [row.hash, row.path]))
  const stored: StoredModel[] = []
  let uploaded = 0
  for (const model of data.models) {
    const { bytes, hash, file } = await readFile(batch, model.path, limits.modelBytes)
    const extension = extensionOf(file.path)
    const problem = extension === "3mf" ? await check3mf(bytes) : checkStl(bytes)
    if (problem) throw new ItemError(`${file.path} ${problem}`)
    if (stored.some((item) => item.hash === hash)) continue
    const type = contentTypeForModel(extension)
    const meta = { hash, type, size: bytes.length, fileName: safeFileName(file.path), copies: model.copies, notes: model.notes }
    const previous = known.get(hash)
    if (previous) {
      stored.push({ ...meta, path: previous })
      continue
    }
    const path = await savePrivateFile(`${slugify(productId)}/import-${hash.slice(0, 32)}.${extension}`, bytes, type)
    uploaded += 1
    stored.push({ ...meta, path })
  }
  return { stored, uploaded }
}

async function uniqueHandle(tx: Tx, wanted: string) {
  const rows = await tx<Array<{ handle: string }>>`
    select handle from products where handle = ${wanted} or handle like ${`${wanted}-%`}
  `
  const taken = new Set(rows.map((row) => row.handle))
  if (!taken.has(wanted)) return wanted
  for (let n = 2; ; n += 1) {
    if (!taken.has(`${wanted}-${n}`)) return `${wanted}-${n}`
  }
}

function metadataPatch(data: PackageProduct) {
  return {
    sourceUrl: data.source.url,
    print: {
      filamentType: data.print.filament_type,
      filamentGrams: data.print.filament_grams,
      printMinutes: data.print.print_minutes,
    },
  }
}

type WriteResult = {
  productId: string
  action: "created" | "updated"
  filed: string[]
  staleImages: string[]
  staleModels: string[]
  warnings: string[]
}

async function writeProduct(
  item: ClaimedItem,
  batch: Batch,
  plannedId: string,
  data: PackageProduct,
  images: StoredImage[],
  models: StoredModel[],
  placement: Categorisation,
) {
  const sql = getSql()
  const materials = await shopEnabledMaterials()
  const dataHash = sha256(Buffer.from(JSON.stringify(data)))
  return sql.begin(async (tx): Promise<WriteResult> => {
    await tx`select pg_advisory_xact_lock(hashtext(${`bulk-import:${item.sourceName}:${item.externalId}`}))`
    const [source] = await tx<Array<{ productId: string }>>`
      select product_id as "productId" from product_sources
      where source_name = ${item.sourceName} and external_id = ${item.externalId}
    `
    const productId = source?.productId ?? plannedId
    const warnings: string[] = []
    const [existing] = await tx<Array<{ id: string }>>`select id from products where id = ${productId} for update`
    const description = cleanHtml(data.description_html)
    const seoTitle = data.seo.title || data.title
    const compareAt = data.compare_at_price_cents ?? null
    let action: WriteResult["action"]
    if (existing) {
      action = "updated"
      await tx`
        update products set
          title = ${data.title},
          description_html = ${description},
          product_type = ${data.category},
          tags = ${textArrayLiteral(data.tags)}::text[],
          seo_title = ${seoTitle},
          seo_description = ${data.seo.description},
          metadata = metadata || ${sql.json(metadataPatch(data))},
          updated_at = now()
        where id = ${productId}
      `
      const variants = await tx<Array<{
        id: string, sku: string, position: number,
        option1Name: string, option1Value: string, option2Name: string, option2Value: string, option3Name: string, option3Value: string
      }>>`
        select id, sku, position, option1_name as "option1Name", option1_value as "option1Value",
          option2_name as "option2Name", option2_value as "option2Value", option3_name as "option3Name", option3_value as "option3Value"
        from variants where product_id = ${productId}
      `
      await tx`update variants set weight_grams = ${data.shipping_weight_grams} where product_id = ${productId}`
      const targets = basePriceTargets(variants)
      if (targets === null) {
        warnings.push("This product has size or style options, so its prices were left unchanged")
      } else if (targets.length) {
        await tx`
          update variants set price_cents = ${data.price_cents}, compare_at_cents = ${compareAt}
          where product_id = ${productId} and id = any(${textArrayLiteral(targets)}::text[])
        `
      }
      const base = baseVariant(variants)
      if (base && base.sku.toLowerCase() !== data.sku.toLowerCase() && !variants.some((variant) => variant.sku.toLowerCase() === data.sku.toLowerCase())) {
        await tx`update variants set sku = ${data.sku} where id = ${base.id}`
      }
      if (!variants.length) {
        await tx`
          insert into variants (id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
            price_cents, compare_at_cents, inventory_qty, inventory_policy, weight_grams, position)
          values (${randomUUID()}, ${productId}, ${data.sku}, 'Black / PETG', 'Colour', 'Black', 'Material', 'PETG',
            ${data.price_cents}, ${compareAt}, 0, 'continue', ${data.shipping_weight_grams}, 0)
        `
      }
    } else {
      action = "created"
      const handle = await uniqueHandle(tx, data.handle || slugify(data.title))
      await tx`
        insert into products (id, handle, title, description_html, product_type, tags, status, seo_title, seo_description, metadata, materials)
        values (
          ${productId}, ${handle}, ${data.title}, ${description}, ${data.category}, ${textArrayLiteral(data.tags)}::text[],
          ${batch.publish ? "active" : "draft"}, ${seoTitle}, ${data.seo.description},
          ${sql.json(metadataPatch(data))}, ${textArrayLiteral(materials)}::text[]
        )
      `
      await tx`
        insert into variants (id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
          price_cents, compare_at_cents, inventory_qty, inventory_policy, weight_grams, position)
        values (${randomUUID()}, ${productId}, ${data.sku}, 'Black / PETG', 'Colour', 'Black', 'Material', 'PETG',
          ${data.price_cents}, ${compareAt}, 0, 'continue', ${data.shipping_weight_grams}, 0)
      `
    }

    const currentImages = await tx<Array<{ id: string, hash: string, path: string | null }>>`
      select id, content_hash as hash, storage_path as path from product_images
      where product_id = ${productId} and content_hash is not null
    `
    for (const [index, image] of images.entries()) {
      const match = currentImages.find((row) => row.hash === image.hash)
      if (match) {
        await tx`update product_images set alt = ${image.alt}, position = ${index + 1} where id = ${match.id}`
      } else {
        await tx`
          insert into product_images (id, product_id, url, storage_path, alt, position, content_hash, content_type, size_bytes)
          values (${randomUUID()}, ${productId}, ${image.url}, ${image.path}, ${image.alt}, ${index + 1}, ${image.hash}, ${image.type}, ${image.size})
        `
      }
    }
    const keepImages = new Set(images.map((image) => image.hash))
    const dropImages = currentImages.filter((row) => !keepImages.has(row.hash))
    if (dropImages.length) {
      await tx`delete from product_images where id = any(${textArrayLiteral(dropImages.map((row) => row.id))}::text[])`
    }

    const currentModels = await tx<Array<{ id: string, hash: string, path: string }>>`
      select id, content_hash as hash, storage_path as path from product_print_files
      where product_id = ${productId} and content_hash is not null
    `
    for (const [index, model] of models.entries()) {
      const match = currentModels.find((row) => row.hash === model.hash)
      if (match) {
        await tx`
          update product_print_files set file_name = ${model.fileName}, copies = ${model.copies}, notes = ${model.notes}, position = ${index}
          where id = ${match.id}
        `
      } else {
        await tx`
          insert into product_print_files (id, product_id, file_name, storage_path, size_bytes, copies, notes, position, content_hash, content_type)
          values (${randomUUID()}, ${productId}, ${model.fileName}, ${model.path}, ${model.size}, ${model.copies}, ${model.notes}, ${index}, ${model.hash}, ${model.type})
        `
      }
    }
    const keepModels = new Set(models.map((model) => model.hash))
    // Packages without models keep the files already on the product.
    const dropModels = models.length ? currentModels.filter((row) => !keepModels.has(row.hash)) : []
    if (dropModels.length) {
      await tx`delete from product_print_files where id = any(${textArrayLiteral(dropModels.map((row) => row.id))}::text[])`
    }

    await tx`
      insert into product_sources (
        id, product_id, source_name, external_id, source_url, creator_name, creator_url, licence_name, licence_url,
        commercial_use, attribution_required, licence_notes, last_batch_id, data_hash
      ) values (
        ${randomUUID()}, ${productId}, ${item.sourceName}, ${item.externalId}, ${data.source.url}, ${data.creator.name},
        ${data.creator.url ?? ""}, ${data.licence.name}, ${data.licence.url ?? ""}, ${data.licence.commercial_use},
        ${data.licence.attribution_required}, ${data.licence.notes}, ${batch.id}, ${dataHash}
      )
      on conflict (source_name, external_id) do update set
        source_url = excluded.source_url,
        creator_name = excluded.creator_name,
        creator_url = excluded.creator_url,
        licence_name = excluded.licence_name,
        licence_url = excluded.licence_url,
        commercial_use = excluded.commercial_use,
        attribution_required = excluded.attribution_required,
        licence_notes = excluded.licence_notes,
        last_batch_id = excluded.last_batch_id,
        data_hash = excluded.data_hash,
        updated_at = now()
    `

    const filed: string[] = []
    const [{ linked }] = await tx<Array<{ linked: number }>>`select count(*)::int as linked from collection_products where product_id = ${productId}`
    if (placement.method === "category" || (placement.method === "auto" && !linked)) {
      for (const collection of placement.collections) {
        const added = await tx`
          insert into collection_products (collection_id, product_id, position)
          select id, ${productId}, coalesce((select max(position) + 1 from collection_products where collection_id = ${collection.id}), 0)
          from collections where id = ${collection.id}
          on conflict do nothing
          returning collection_id
        `
        if (added.length) filed.push(collection.title)
      }
    }
    if (placement.method === "none" && !linked) {
      warnings.push(`No collection matched "${data.title}", so it is not in any collection yet. Add it to one in the product editor`)
    }

    await tx`
      insert into product_import_events (id, product_id, batch_id, item_id, action, detail)
      values (${randomUUID()}, ${productId}, ${batch.id}, ${item.id}, ${action}, ${sql.json({
        source: `${item.sourceName}:${item.externalId}`,
        sku: data.sku,
        priceCents: data.price_cents,
        images: images.length,
        models: models.length,
        collections: filed,
        categorised: placement.method,
        dataHash,
      })})
    `
    return {
      productId,
      action,
      filed,
      staleImages: dropImages.map((row) => row.path).filter((path): path is string => Boolean(path)),
      staleModels: dropModels.map((row) => row.path),
      warnings,
    }
  })
}

async function removeUnused(images: string[], models: string[]) {
  const sql = getSql()
  for (const path of images) {
    const [used] = await sql`select 1 from product_images where storage_path = ${path} limit 1`
    if (!used) await deleteObject(path).catch(() => undefined)
  }
  for (const path of models) {
    const [used] = await sql`select 1 from product_print_files where storage_path = ${path} limit 1`
    if (!used) await deletePrintFileObject(path).catch(() => undefined)
  }
}

export async function importItem(item: ClaimedItem, batch: Batch) {
  const data = parseData(item.data)
  const productId = await targetProductId(item)
  const images = await storeImages(batch, productId, data)
  const models = await storeModels(batch, productId, data)
  const placement = categorise(await loadCategoriser(), {
    title: data.title,
    category: data.category,
    tags: data.tags,
    description: data.description_html,
  })
  const result = await writeProduct(item, batch, productId, data, images.stored, models.stored, placement)
  await syncProductOptions([result.productId])
  await repriceMaterials([result.productId])
  await removeUnused(result.staleImages, result.staleModels)
  const sql = getSql()
  const filedNote = result.filed.length
    ? ` Added to ${result.filed.join(" and ")}${placement.method === "auto" ? " (matched automatically)" : ""}.`
    : ""
  const note = `${result.action === "created" ? "Created" : "Updated"} the product. Uploaded ${images.uploaded} of ${images.stored.length} images and ${models.uploaded} of ${models.stored.length} print files; the rest were already stored.${filedNote}`
  await sql`
    update import_batch_items set
      status = 'imported',
      product_id = ${result.productId},
      locked_until = null,
      imported_at = now(),
      errors = '[]'::jsonb,
      warnings = warnings || ${sql.json(result.warnings)},
      log = log || ${sql.json([{ at: new Date().toISOString(), message: note }])},
      updated_at = now()
    where id = ${item.id}
  `
  return result
}

async function failItem(item: ClaimedItem, error: unknown) {
  const permanent = error instanceof ItemError
  const message = error instanceof Error ? error.message : "Import failed"
  if (!permanent) console.error("[bulk-import] item failed", item.id, error)
  const retry = !permanent && item.attempts < maxAttempts
  const sql = getSql()
  await sql`
    update import_batch_items set
      status = ${retry ? "queued" : "failed"},
      locked_until = null,
      errors = ${sql.json([permanent ? message : `Attempt ${item.attempts} failed: ${message.slice(0, 300)}`])},
      updated_at = now()
    where id = ${item.id}
  `
  await appendLog(item.id, `${retry ? "Will retry" : "Failed"}: ${message}`)
}

export type StepResult = {
  imported: number
  failed: number
  batches: string[]
}

// Runs until the time budget is spent or the queue is empty. Each product is claimed with a lease,
// so a step that is cut off leaves its product to be picked up again once the lease expires.
export async function runImportStep(options: { batchId?: string, budgetMs: number, concurrency?: number }) {
  const started = Date.now()
  const result: StepResult = { imported: 0, failed: 0, batches: [] }
  const batches = new Map<string, Batch | null>()
  const worker = async () => {
    while (Date.now() - started < options.budgetMs) {
      const item = await claimNextItem(options.batchId)
      if (!item) return
      if (!batches.has(item.batchId)) batches.set(item.batchId, await getBatch(item.batchId))
      const batch = batches.get(item.batchId)
      try {
        if (!batch) throw new ItemError("Import not found")
        if (item.attempts > maxAttempts) throw new ItemError(`Stopped after ${maxAttempts} attempts. The product may be too large to import in one step`)
        await importItem(item, batch)
        result.imported += 1
      } catch (error) {
        await failItem(item, error)
        if (error instanceof ItemError || item.attempts >= maxAttempts) result.failed += 1
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 2) }, worker))
  for (const id of batches.keys()) await refreshBatchStatus(id)
  if (options.batchId && !batches.has(options.batchId)) await refreshBatchStatus(options.batchId)
  result.batches = [...batches.keys()]
  return result
}

export async function queueRemaining(batchId?: string) {
  const sql = getSql()
  const [row] = await sql<Array<{ waiting: number }>>`
    select count(*)::int as waiting from import_batch_items i
    join import_batches b on b.id = i.batch_id
    where b.status = 'importing' and i.decision = 'approved' and i.status in ('queued', 'processing')
      ${batchId ? sql`and i.batch_id = ${batchId}` : sql``}
  `
  return row.waiting
}
