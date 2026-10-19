import { createHash, randomUUID } from "node:crypto"
import { getSql } from "@/db/client"
import { cleanHtml } from "@/lib/html"
import { extensionFor, saveObject } from "@/lib/storage"
import { fetchShopifyCollections, type RemoteCollection } from "@/lib/shopify/collections"
import { decodeCsvBuffer, parseShopifyCsv, variantLabel, type ParsedProduct } from "@/lib/shopify/parse"
import type { ImportReport, ParseIssue } from "@/lib/types"

type ExistingVariant = {
  id: string
  sku: string
  option1Value: string
  option2Value: string
  option3Value: string
}

function emptyReport(encoding: string): ImportReport {
  return {
    encoding,
    productsCreated: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    variantsImported: 0,
    imagesStored: 0,
    imagesFailed: 0,
    imagesPending: 0,
    collectionsSynced: 0,
    failures: [],
    skipped: [],
    warnings: [],
  }
}

function push(report: ImportReport, issue: ParseIssue) {
  if (issue.level === "skipped") report.skipped.push(issue)
  else if (issue.level === "warning") report.warnings.push(issue)
  else report.failures.push(issue)
}

function signature(variant: { sku: string, option1Value: string, option2Value: string, option3Value: string }, position: number, seen: Set<string>) {
  const base = variant.sku.trim()
    ? `sku:${variant.sku.trim().toLowerCase()}`
    : `opt:${variant.option1Value.trim().toLowerCase()}|${variant.option2Value.trim().toLowerCase()}|${variant.option3Value.trim().toLowerCase()}`
  const key = seen.has(base) ? `${base}#${position}` : base
  seen.add(key)
  return key
}

async function downloadToStorage(url: string, handle: string, position: number) {
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const contentType = (response.headers.get("content-type") || "application/octet-stream").split(";")[0].trim()
  if (!contentType.startsWith("image/")) throw new Error(`Not an image (${contentType})`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 32) throw new Error("Image file is empty")
  if (bytes.length > 20_000_000) throw new Error("Image is larger than 20MB")
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 12)
  return saveObject(`${handle}/${position}-${hash}.${extensionFor(contentType)}`, bytes, contentType)
}

async function upsertProduct(product: ParsedProduct, report: ImportReport) {
  const sql = getSql()
  const existing = await sql<{ id: string }[]>`select id from products where handle = ${product.handle}`
  const id = existing[0]?.id ?? randomUUID()
  const description = cleanHtml(product.descriptionHtml)
  if (existing[0]) {
    await sql`
      update products set
        title = ${product.title},
        description_html = ${description},
        vendor = ${product.vendor},
        product_type = ${product.productType},
        tags = ${product.tags},
        status = ${product.status},
        seo_title = ${product.seoTitle},
        seo_description = ${product.seoDescription},
        metadata = ${sql.json(product.metadata)},
        updated_at = now()
      where id = ${id}
    `
    report.productsUpdated += 1
  } else {
    await sql`
      insert into products (
        id, handle, title, description_html, vendor, product_type, tags, status,
        seo_title, seo_description, metadata
      ) values (
        ${id}, ${product.handle}, ${product.title}, ${description}, ${product.vendor},
        ${product.productType}, ${product.tags}, ${product.status}, ${product.seoTitle},
        ${product.seoDescription}, ${sql.json(product.metadata)}
      )
    `
    report.productsCreated += 1
  }

  const current = await sql<ExistingVariant[]>`
    select id, sku, option1_value as "option1Value", option2_value as "option2Value", option3_value as "option3Value"
    from variants where product_id = ${id}
    order by position asc
  `
  const seen = new Set<string>()
  const currentByKey = new Map<string, ExistingVariant>()
  current.forEach((variant, index) => {
    currentByKey.set(signature(variant, index, seen), variant)
  })
  const incomingSeen = new Set<string>()
  const kept = new Set<string>()

  for (const [index, variant] of product.variants.entries()) {
    const key = signature(variant, index, incomingSeen)
    const match = currentByKey.get(key)
    const variantId = match?.id ?? randomUUID()
    kept.add(variantId)
    const title = variantLabel(variant)
    if (match) {
      await sql`
        update variants set
          sku = ${variant.sku},
          title = ${title},
          option1_name = ${variant.option1Name},
          option1_value = ${variant.option1Value},
          option2_name = ${variant.option2Name},
          option2_value = ${variant.option2Value},
          option3_name = ${variant.option3Name},
          option3_value = ${variant.option3Value},
          price_cents = ${variant.priceCents},
          compare_at_cents = ${variant.compareAtCents},
          cost_cents = ${variant.costCents},
          inventory_qty = ${variant.inventoryQty},
          inventory_policy = ${variant.inventoryPolicy},
          weight_grams = ${variant.weightGrams},
          taxable = ${variant.taxable},
          barcode = ${variant.barcode},
          position = ${index},
          available = true
        where id = ${variantId}
      `
    } else {
      await sql`
        insert into variants (
          id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
          option3_name, option3_value, price_cents, compare_at_cents, cost_cents, inventory_qty,
          inventory_policy, weight_grams, taxable, barcode, position, available
        ) values (
          ${variantId}, ${id}, ${variant.sku}, ${title}, ${variant.option1Name}, ${variant.option1Value},
          ${variant.option2Name}, ${variant.option2Value}, ${variant.option3Name}, ${variant.option3Value},
          ${variant.priceCents}, ${variant.compareAtCents}, ${variant.costCents}, ${variant.inventoryQty},
          ${variant.inventoryPolicy}, ${variant.weightGrams}, ${variant.taxable}, ${variant.barcode},
          ${index}, true
        )
      `
    }
    report.variantsImported += 1
  }

  for (const variant of current) {
    if (kept.has(variant.id)) continue
    const used = await sql<{ id: string }[]>`
      select id from order_items where variant_id = ${variant.id} limit 1
    `
    if (used.length) {
      await sql`update variants set available = false, inventory_policy = 'deny' where id = ${variant.id}`
    } else {
      await sql`delete from variants where id = ${variant.id}`
    }
  }

  for (const image of product.images) {
    const found = await sql<{ id: string, storagePath: string | null }[]>`
      select id, storage_path as "storagePath"
      from product_images
      where product_id = ${id} and source_url = ${image.src}
      limit 1
    `
    if (found[0]) {
      await sql`
        update product_images
        set alt = ${image.alt}, position = ${image.position}
        where id = ${found[0].id}
      `
      if (!found[0].storagePath) report.imagesPending += 1
      continue
    }
    await sql`
      insert into product_images (id, product_id, url, source_url, alt, position)
      values (${randomUUID()}, ${id}, ${image.src}, ${image.src}, ${image.alt}, ${image.position})
    `
    report.imagesPending += 1
  }

  const incomingSrc = product.images.map((image) => image.src)
  if (incomingSrc.length === 0) {
    await sql`delete from product_images where product_id = ${id} and storage_path is null`
  } else {
    await sql`
      delete from product_images
      where product_id = ${id}
        and storage_path is null
        and source_url is not null
        and not (source_url = any(${incomingSrc}))
    `
  }
}

export async function importShopifyCsv(buffer: Buffer, filename = "upload.csv") {
  const decoded = decodeCsvBuffer(buffer)
  const parsed = parseShopifyCsv(decoded.text)
  const report = emptyReport(decoded.encoding)
  for (const issue of parsed.issues) push(report, issue)
  report.productsSkipped = parsed.issues.filter((issue) => issue.level === "skipped").length

  for (const product of parsed.products) {
    try {
      await upsertProduct(product, report)
    } catch (error) {
      report.failures.push({
        record: 0,
        handle: product.handle,
        level: "error",
        message: error instanceof Error ? error.message : "Could not save product",
      })
    }
  }

  const sql = getSql()
  const id = randomUUID()
  await sql`
    insert into import_runs (id, filename, report)
    values (${id}, ${filename}, ${sql.json(report)})
  `
  return { id, report }
}

export async function migrateRemoteImages(options: { limit: number, budgetMs?: number }) {
  const sql = getSql()
  const rows = await sql<Array<{ id: string, sourceUrl: string, position: number, handle: string }>>`
    select i.id, i.source_url as "sourceUrl", i.position, p.handle
    from product_images i
    join products p on p.id = i.product_id
    where i.storage_path is null and i.source_url is not null
    order by p.handle, i.position
    limit ${options.limit}
  `
  const started = Date.now()
  let stored = 0
  let failed = 0
  const failures: ParseIssue[] = []
  for (const row of rows) {
    if (options.budgetMs && Date.now() - started > options.budgetMs) break
    try {
      const saved = await downloadToStorage(row.sourceUrl, row.handle, Number(row.position))
      await sql`
        update product_images
        set url = ${saved.url}, storage_path = ${saved.path}
        where id = ${row.id}
      `
      stored += 1
    } catch (error) {
      failed += 1
      failures.push({
        record: 0,
        handle: row.handle,
        level: "error",
        message: error instanceof Error ? error.message : "Image download failed",
      })
    }
  }
  const pendingRows = await sql<{ count: number }[]>`
    select count(*)::int as count from product_images where storage_path is null and source_url is not null
  `
  return { stored, failed, pending: pendingRows[0]?.count ?? 0, failures }
}

export async function syncCollections(
  storeUrl: string,
  downloadImages: boolean,
  preset?: RemoteCollection[],
) {
  const collections = preset ?? await fetchShopifyCollections(storeUrl)
  const sql = getSql()
  let synced = 0
  for (const collection of collections) {
    const existing = await sql<{ id: string }[]>`select id from collections where handle = ${collection.handle}`
    const id = existing[0]?.id ?? randomUUID()
    let imageUrl = collection.imageUrl
    let imagePath: string | null = null
    if (downloadImages && collection.imageUrl) {
      try {
        const saved = await downloadToStorage(collection.imageUrl, `collections/${collection.handle}`, collection.position)
        imageUrl = saved.url
        imagePath = saved.path
      } catch {
        imageUrl = collection.imageUrl
      }
    }
    if (existing[0]) {
      await sql`
        update collections set
          title = ${collection.title},
          description_html = ${cleanHtml(collection.descriptionHtml)},
          image_url = coalesce(${imageUrl}, image_url),
          image_path = coalesce(${imagePath}, image_path),
          position = ${collection.position},
          updated_at = now()
        where id = ${id}
      `
    } else {
      await sql`
        insert into collections (id, handle, title, description_html, image_url, image_path, position, show_on_home, published)
        values (
          ${id}, ${collection.handle}, ${collection.title}, ${cleanHtml(collection.descriptionHtml)},
          ${imageUrl}, ${imagePath}, ${collection.position}, true, true
        )
      `
    }
    await sql`delete from collection_products where collection_id = ${id}`
    let position = 0
    for (const handle of collection.productHandles) {
      const product = await sql<{ id: string }[]>`select id from products where handle = ${handle}`
      if (!product[0]) continue
      await sql`
        insert into collection_products (collection_id, product_id, position)
        values (${id}, ${product[0].id}, ${position})
        on conflict do nothing
      `
      position += 1
    }
    synced += 1
  }
  return synced
}
