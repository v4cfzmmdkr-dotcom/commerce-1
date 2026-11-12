import { randomUUID } from "node:crypto"
import { getSql, textArrayLiteral } from "@/db/client"
import { analysePackage, type ItemPlan } from "@/lib/bulk-import/analyse"
import { categorise, loadCategoriser } from "@/lib/bulk-import/categorise"
import { checkEntries, type PackageFile } from "@/lib/bulk-import/files"
import {
  PackageError,
  deletePackage,
  openPackage,
  packageObjectPath,
  rawEntry,
  readPackageEntry,
} from "@/lib/bulk-import/package-store"
import { limits, type PackageProduct } from "@/lib/bulk-import/schema"
import { shopEnabledMaterials } from "@/lib/product-options-sync"

export type BatchStatus = "uploading" | "validating" | "invalid" | "review" | "importing" | "completed"
export type ItemStatus = "invalid" | "ready" | "queued" | "processing" | "imported" | "failed"
export type ItemDecision = "pending" | "approved" | "rejected"

export type BatchFile = PackageFile & { sha256?: string }

export type Batch = {
  id: string
  status: BatchStatus
  fileName: string
  packagePath: string | null
  packageBytes: number
  packageRoot: string
  packageId: string
  schemaVersion: string
  generator: string
  publish: boolean
  files: BatchFile[]
  errors: string[]
  warnings: string[]
  productCount: number
  createdBy: string
  createdAt: Date
  validatedAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
}

export type BatchCounts = {
  total: number
  invalid: number
  pending: number
  approved: number
  rejected: number
  queued: number
  processing: number
  imported: number
  failed: number
  creates: number
  updates: number
  approvedReady: number
}

const batchColumns = (sql: ReturnType<typeof getSql>) => sql`
  id, status, file_name as "fileName", package_path as "packagePath", package_bytes::float8 as "packageBytes",
  package_root as "packageRoot", package_id as "packageId", schema_version as "schemaVersion", generator, publish,
  files, errors, warnings, product_count as "productCount", created_by as "createdBy", created_at as "createdAt",
  validated_at as "validatedAt", started_at as "startedAt", completed_at as "completedAt"
`

function json<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return (value ?? fallback) as T
}

export function normaliseBatch(row: Batch): Batch {
  return {
    ...row,
    packageBytes: Number(row.packageBytes),
    files: json(row.files, []),
    errors: json(row.errors, []),
    warnings: json(row.warnings, []),
  }
}

export async function getBatch(id: string) {
  const sql = getSql()
  const rows = await sql<Batch[]>`select ${batchColumns(sql)} from import_batches where id = ${id}`
  return rows[0] ? normaliseBatch(rows[0]) : null
}

export async function listBatches(limit = 50) {
  const sql = getSql()
  const rows = await sql<Array<Batch & BatchCounts>>`
    select ${batchColumns(sql)},
      (select count(*) from import_batch_items i where i.batch_id = b.id)::int as total,
      (select count(*) from import_batch_items i where i.batch_id = b.id and i.status = 'imported')::int as imported,
      (select count(*) from import_batch_items i where i.batch_id = b.id and i.status = 'failed')::int as failed,
      (select count(*) from import_batch_items i where i.batch_id = b.id and i.status in ('queued', 'processing'))::int as queued
    from import_batches b
    order by created_at desc
    limit ${limit}
  `
  return rows.map((row) => ({ ...normaliseBatch(row), total: row.total, imported: row.imported, failed: row.failed, queued: row.queued }))
}

export async function batchCounts(batchId: string): Promise<BatchCounts> {
  const [row] = await getSql()<BatchCounts[]>`
    select
      count(*)::int as total,
      count(*) filter (where status = 'invalid')::int as invalid,
      count(*) filter (where decision = 'pending' and status <> 'invalid')::int as pending,
      count(*) filter (where decision = 'approved')::int as approved,
      count(*) filter (where decision = 'rejected')::int as rejected,
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'processing')::int as processing,
      count(*) filter (where status = 'imported')::int as imported,
      count(*) filter (where status = 'failed')::int as failed,
      count(*) filter (where action = 'create' and status <> 'invalid')::int as creates,
      count(*) filter (where action = 'update' and status <> 'invalid')::int as updates,
      count(*) filter (where decision = 'approved' and status = 'ready')::int as "approvedReady"
    from import_batch_items where batch_id = ${batchId}
  `
  return row
}

export async function createBatch(fileName: string, size: number, createdBy: string) {
  const id = randomUUID()
  const objectPath = packageObjectPath(id)
  await getSql()`
    insert into import_batches (id, status, file_name, package_path, package_bytes, created_by)
    values (${id}, 'uploading', ${fileName.slice(0, 200)}, ${objectPath}, ${size}, ${createdBy.slice(0, 200)})
  `
  return { id, objectPath }
}

async function failBatch(batchId: string, errors: string[], warnings: string[] = []) {
  const sql = getSql()
  await sql`
    update import_batches set status = 'invalid', errors = ${sql.json(errors.slice(0, 200))},
      warnings = ${sql.json(warnings.slice(0, 200))}, validated_at = now(), updated_at = now()
    where id = ${batchId}
  `
  return { ok: false as const, errors }
}

function decodeUtf8(bytes: Buffer, name: string) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    throw new PackageError(`${name} is not UTF-8 text`)
  }
}

type Match = { action: "create" | "update", productId: string | null, errors: string[], warnings: string[] }

export async function matchExisting(items: ItemPlan[]) {
  const sql = getSql()
  const valid = items.filter((item) => item.data)
  const identities = valid.map((item) => `${item.sourceName}\u001f${item.externalId}`)
  const skus = valid.map((item) => item.sku.toLowerCase())
  const [sources, owners] = await Promise.all([
    identities.length ? sql<Array<{ sourceName: string, externalId: string, productId: string }>>`
      select source_name as "sourceName", external_id as "externalId", product_id as "productId"
      from product_sources
      where source_name || chr(31) || external_id = any(${textArrayLiteral(identities)}::text[])
    ` : [],
    skus.length ? sql<Array<{ sku: string, productId: string, title: string, sourceName: string | null, externalId: string | null }>>`
      select distinct lower(v.sku) as sku, v.product_id as "productId", p.title,
        s.source_name as "sourceName", s.external_id as "externalId"
      from variants v
      join products p on p.id = v.product_id
      left join product_sources s on s.product_id = p.id
      where lower(v.sku) = any(${textArrayLiteral(skus)}::text[])
    ` : [],
  ])
  const bySource = new Map(sources.map((row) => [`${row.sourceName}\u001f${row.externalId}`, row.productId]))
  const bySku = new Map<string, Array<(typeof owners)[number]>>()
  for (const row of owners) bySku.set(row.sku, [...(bySku.get(row.sku) ?? []), row])
  const matches = new Map<number, Match>()
  for (const item of valid) {
    const sourceProduct = bySource.get(`${item.sourceName}\u001f${item.externalId}`) ?? null
    const skuOwners = bySku.get(item.sku.toLowerCase()) ?? []
    const others = skuOwners.filter((owner) => owner.productId !== sourceProduct)
    const match: Match = { action: "create", productId: null, errors: [], warnings: [] }
    if (sourceProduct) {
      match.action = "update"
      match.productId = sourceProduct
      if (others.length) match.errors.push(`SKU ${item.sku} is already used by "${others[0].title}", a different product`)
    } else if (others.length > 1 && new Set(others.map((owner) => owner.productId)).size > 1) {
      match.errors.push(`SKU ${item.sku} is used by more than one existing product, so the match is ambiguous`)
    } else if (others.length) {
      const owner = others[0]
      if (owner.sourceName && owner.externalId) {
        match.errors.push(`SKU ${item.sku} belongs to "${owner.title}", which was imported from ${owner.sourceName}:${owner.externalId}`)
      } else {
        match.action = "update"
        match.productId = owner.productId
        match.warnings.push(`Matched the existing product "${owner.title}" by SKU; importing updates it`)
      }
    }
    matches.set(item.position, match)
  }
  return matches
}

async function collectionNotes() {
  const model = await loadCategoriser()
  return (data: PackageProduct) => {
    const placement = categorise(model, { title: data.title, category: data.category, tags: data.tags, description: data.description_html })
    const names = placement.collections.map((collection) => collection.title).join(" and ")
    if (placement.method === "category") return null
    if (placement.method === "auto") return `Category "${data.category}" is not a collection; it will be added to ${names}, matched automatically`
    return `No collection matches "${data.category}" or the product details; it will not be in a collection until you add it to one`
  }
}

export async function validateBatch(batchId: string) {
  const sql = getSql()
  const batch = await getBatch(batchId)
  if (!batch?.packagePath) throw new PackageError("Import not found")
  await sql`update import_batches set status = 'validating', updated_at = now() where id = ${batchId}`
  try {
    const pkg = await openPackage(batch.packagePath)
    const entries = checkEntries(pkg.list.map(rawEntry))
    if (entries.errors.length) return await failBatch(batchId, entries.errors, entries.warnings)
    const manifestText = decodeUtf8(await readPackageEntry(pkg, `${entries.root}manifest.json`, limits.manifestBytes), "manifest.json")
    const productsText = decodeUtf8(await readPackageEntry(pkg, `${entries.root}products.json`, limits.productsBytes), "products.json")
    const analysis = analysePackage({ files: entries.files, manifestText, productsText, shopMaterials: await shopEnabledMaterials() })
    const warnings = [...entries.warnings, ...analysis.warnings]
    if (analysis.errors.length) return await failBatch(batchId, analysis.errors, warnings)
    const manifest = analysis.manifest!
    const hashes = new Map((manifest.files ?? []).map((file) => [file.path.toLowerCase(), file.sha256]))
    const files: BatchFile[] = entries.files.map((file) => {
      const sha256 = hashes.get(file.path.toLowerCase())
      return sha256 ? { ...file, sha256 } : file
    })

    const earlier = await sql<Array<{ createdAt: Date }>>`
      select created_at as "createdAt" from import_batches
      where package_id = ${manifest.package_id} and id <> ${batchId} and status in ('review', 'importing', 'completed')
      order by created_at desc limit 1
    `
    if (earlier[0]) {
      warnings.push(`A package with the ID ${manifest.package_id} was uploaded on ${new Date(earlier[0].createdAt).toLocaleDateString("en-AU")}. Products it created are matched and updated, not duplicated`)
    }

    const matches = await matchExisting(analysis.items)
    const categoryNote = await collectionNotes()
    const rows = analysis.items.map((item) => {
      const match = matches.get(item.position)
      const errors = [...item.errors, ...(match?.errors ?? [])]
      const itemWarnings = [...item.warnings, ...(match?.warnings ?? [])]
      const category = item.data ? categoryNote(item.data) : null
      if (category) itemWarnings.push(category)
      const invalid = errors.length > 0 || !item.data
      return {
        id: randomUUID(),
        batch_id: batchId,
        position: item.position,
        source_name: item.sourceName,
        external_id: item.externalId,
        sku: item.sku.slice(0, 64),
        title: item.title.slice(0, 250),
        data: sql.json(item.data ?? {}),
        action: match?.action ?? "create",
        match_product_id: match?.productId ?? null,
        decision: item.blocked ? "rejected" : "pending",
        status: invalid ? "invalid" : "ready",
        blocked: item.blocked,
        errors: sql.json(errors),
        warnings: sql.json(itemWarnings),
      }
    })
    await sql.begin(async (tx) => {
      await tx`delete from import_batch_items where batch_id = ${batchId}`
      for (let start = 0; start < rows.length; start += 200) {
        await tx`insert into import_batch_items ${tx(rows.slice(start, start + 200))}`
      }
      await tx`
        update import_batches set
          status = 'review',
          package_bytes = ${pkg.size},
          package_root = ${entries.root},
          package_id = ${manifest.package_id},
          schema_version = ${manifest.schema_version},
          generator = ${manifest.generator ? `${manifest.generator.name} ${manifest.generator.version}`.trim() : ""},
          files = ${sql.json(files)},
          errors = '[]'::jsonb,
          warnings = ${sql.json(warnings.slice(0, 200))},
          product_count = ${rows.length},
          validated_at = now(),
          updated_at = now()
        where id = ${batchId}
      `
    })
    return { ok: true as const, products: rows.length, invalid: rows.filter((row) => row.status === "invalid").length }
  } catch (error) {
    if (error instanceof PackageError) return failBatch(batchId, [error.message])
    console.error("[bulk-import] validation failed", error)
    return failBatch(batchId, ["The package could not be checked. Try again, and if it keeps failing upload it again"])
  }
}

export async function setDecision(batchId: string, itemIds: string[], decision: "approved" | "rejected") {
  if (!itemIds.length) return 0
  const sql = getSql()
  const ids = textArrayLiteral(itemIds)
  const rows = decision === "approved"
    ? await sql`
        update import_batch_items set decision = 'approved', updated_at = now()
        where batch_id = ${batchId} and id = any(${ids}::text[]) and status in ('ready', 'failed') and not blocked
        returning id
      `
    : await sql`
        update import_batch_items set decision = 'rejected', status = case when status = 'queued' then 'ready' else status end, updated_at = now()
        where batch_id = ${batchId} and id = any(${ids}::text[]) and status in ('ready', 'queued', 'failed')
        returning id
      `
  return rows.length
}

export async function approveAllValid(batchId: string) {
  const rows = await getSql()`
    update import_batch_items set decision = 'approved', updated_at = now()
    where batch_id = ${batchId} and decision = 'pending' and status = 'ready' and not blocked
    returning id
  `
  return rows.length
}

export async function rejectAllPending(batchId: string) {
  const rows = await getSql()`
    update import_batch_items set decision = 'rejected', updated_at = now()
    where batch_id = ${batchId} and decision = 'pending' and status in ('ready', 'invalid')
    returning id
  `
  return rows.length
}

export async function queueApproved(batchId: string, publish: boolean) {
  const sql = getSql()
  return sql.begin(async (tx) => {
    const rows = await tx`
      update import_batch_items set status = 'queued', attempts = 0, locked_until = null, updated_at = now()
      where batch_id = ${batchId} and decision = 'approved' and status in ('ready', 'failed')
      returning id
    `
    if (rows.length) {
      await tx`
        update import_batches set status = 'importing', publish = ${publish},
          started_at = coalesce(started_at, now()), completed_at = null, updated_at = now()
        where id = ${batchId} and status in ('review', 'completed', 'importing')
      `
    }
    return rows.length
  })
}

export async function retryFailed(batchId: string, itemIds?: string[]) {
  const sql = getSql()
  return sql.begin(async (tx) => {
    const rows = await tx`
      update import_batch_items set status = 'queued', attempts = 0, locked_until = null, updated_at = now()
      where batch_id = ${batchId} and status = 'failed' and decision = 'approved'
        ${itemIds ? tx`and id = any(${textArrayLiteral(itemIds)}::text[])` : tx``}
      returning id
    `
    if (rows.length) {
      await tx`
        update import_batches set status = 'importing', completed_at = null, updated_at = now()
        where id = ${batchId} and status in ('review', 'completed', 'importing')
      `
    }
    return rows.length
  })
}

export async function pauseBatch(batchId: string) {
  const sql = getSql()
  await sql.begin(async (tx) => {
    await tx`update import_batch_items set status = 'ready', updated_at = now() where batch_id = ${batchId} and status = 'queued'`
    await tx`update import_batches set status = 'review', updated_at = now() where id = ${batchId} and status = 'importing'`
  })
}

export async function refreshBatchStatus(batchId: string) {
  await getSql()`
    update import_batches b set
      status = case
        when exists (select 1 from import_batch_items i where i.batch_id = b.id and i.status in ('queued', 'processing')) then 'importing'
        else 'completed'
      end,
      completed_at = case
        when exists (select 1 from import_batch_items i where i.batch_id = b.id and i.status in ('queued', 'processing')) then null
        else coalesce(b.completed_at, now())
      end,
      updated_at = now()
    where b.id = ${batchId} and b.status = 'importing'
  `
}

export async function removeBatchPackage(batchId: string) {
  const batch = await getBatch(batchId)
  if (!batch || batch.status === "importing") return false
  await deletePackage(batch.packagePath)
  await getSql()`update import_batches set package_path = null, updated_at = now() where id = ${batchId}`
  return true
}

export async function deleteBatch(batchId: string) {
  const sql = getSql()
  const batch = await getBatch(batchId)
  if (!batch) return false
  const [{ imported }] = await sql<Array<{ imported: number }>>`
    select count(*)::int as imported from import_batch_items where batch_id = ${batchId} and status in ('imported', 'processing')
  `
  if (imported > 0) return false
  await deletePackage(batch.packagePath).catch(() => undefined)
  await sql`delete from import_batches where id = ${batchId}`
  return true
}
