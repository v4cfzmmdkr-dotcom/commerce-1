import { getSql, databaseConfigured } from "@/db/client"
import { isPurchasable } from "@/lib/money"
import type { ProductMetadata } from "@/lib/types"

export type ProductCard = {
  id: string
  handle: string
  title: string
  priceCents: number
  compareAtCents: number | null
  imageUrl: string | null
  imageAlt: string
  purchasable: boolean
}

export type CatalogQuery = {
  q?: string
  sort?: string
  tag?: string
  collectionId?: string
  inStock?: boolean
  minCents?: number | null
  maxCents?: number | null
  page?: number
  pageSize?: number
}

export type PublicVariant = {
  id: string
  title: string
  sku: string
  option1Name: string
  option1Value: string
  option2Name: string
  option2Value: string
  option3Name: string
  option3Value: string
  priceCents: number
  compareAtCents: number | null
  inventoryQty: number
  inventoryPolicy: string
  available: boolean
}

export type PublicProduct = {
  id: string
  handle: string
  title: string
  descriptionHtml: string
  tags: string[]
  seoTitle: string
  seoDescription: string
  metadata: ProductMetadata
  images: Array<{ id: string, url: string, alt: string }>
  variants: PublicVariant[]
}

function likeTerm(value: string) {
  return `%${value.replace(/[%_\\]/g, "")}%`
}

function orderSql(sort: string | undefined, sql: ReturnType<typeof getSql>) {
  if (sort === "price-asc") return sql`order by pr.min_price asc, p.title asc`
  if (sort === "price-desc") return sql`order by pr.min_price desc, p.title asc`
  if (sort === "title") return sql`order by p.title asc`
  return sql`order by p.created_at desc`
}

export async function listProducts(query: CatalogQuery) {
  if (!databaseConfigured()) return { items: [] as ProductCard[], total: 0, page: 1, pageCount: 1 }
  const sql = getSql()
  const pageSize = query.pageSize ?? 24
  const page = Math.max(1, query.page ?? 1)
  const offset = (page - 1) * pageSize
  const search = query.q?.trim()
    ? sql`and (
        p.title ilike ${likeTerm(query.q.trim())}
        or p.handle ilike ${likeTerm(query.q.trim())}
        or p.product_type ilike ${likeTerm(query.q.trim())}
        or exists (
          select 1 from variants v
          where v.product_id = p.id and v.sku ilike ${likeTerm(query.q.trim())}
        )
        or exists (
          select 1 from unnest(p.tags) tag
          where tag ilike ${likeTerm(query.q.trim())}
        )
      )`
    : sql``
  const tag = query.tag ? sql`and ${query.tag} = any(p.tags)` : sql``
  const collection = query.collectionId
    ? sql`and exists (
        select 1 from collection_products cp
        where cp.product_id = p.id and cp.collection_id = ${query.collectionId}
      )`
    : sql``
  const stock = query.inStock ? sql`and pr.purchasable` : sql``
  const min = query.minCents != null ? sql`and pr.min_price >= ${query.minCents}` : sql``
  const max = query.maxCents != null ? sql`and pr.min_price <= ${query.maxCents}` : sql``
  const where = sql`p.status = 'active' ${search} ${tag} ${collection} ${stock} ${min} ${max}`

  const rows = await sql<ProductCard[]>`
    select
      p.id,
      p.handle,
      p.title,
      pr.min_price as "priceCents",
      pr.compare_at as "compareAtCents",
      img.url as "imageUrl",
      coalesce(img.alt, '') as "imageAlt",
      pr.purchasable as "purchasable"
    from products p
    join (
      select
        product_id,
        min(price_cents) as min_price,
        min(compare_at_cents) as compare_at,
        bool_or(available and (inventory_policy = 'continue' or inventory_qty > 0)) as purchasable
      from variants
      group by product_id
    ) pr on pr.product_id = p.id
    left join lateral (
      select url, alt from product_images i
      where i.product_id = p.id
      order by position asc
      limit 1
    ) img on true
    where ${where}
    ${orderSql(query.sort, sql)}
    limit ${pageSize} offset ${offset}
  `
  const countRows = await sql<{ total: number }[]>`
    select count(*)::int as total
    from products p
    join (
      select product_id, min(price_cents) as min_price,
        bool_or(available and (inventory_policy = 'continue' or inventory_qty > 0)) as purchasable
      from variants
      group by product_id
    ) pr on pr.product_id = p.id
    where ${where}
  `
  const total = countRows[0]?.total ?? 0
  return {
    items: rows.map((row) => ({
      ...row,
      priceCents: Number(row.priceCents),
      compareAtCents: row.compareAtCents == null ? null : Number(row.compareAtCents),
      purchasable: Boolean(row.purchasable),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

const homeFirstBrands = ["dewalt", "makita", "milwaukee", "ryobi"]

export type HomeCollection = { handle: string, title: string, imageUrl: string | null }

export type HomeCollectionGroup = {
  id: "brands" | "fit" | "home"
  heading: string
  intro: string
  layout: "brands" | "mosaic" | "grid"
  collections: HomeCollection[]
}

function collectionKey(collection: { handle: string, title: string }) {
  return `${collection.handle} ${collection.title}`.toLowerCase()
}

function homeCollectionRank(collection: { handle: string, title: string }) {
  const haystack = collectionKey(collection)
  const index = homeFirstBrands.findIndex((brand) => haystack.includes(brand))
  return index === -1 ? homeFirstBrands.length : index
}

function isBrandCollection(collection: HomeCollection) {
  return homeFirstBrands.some((brand) => collectionKey(collection).includes(brand))
}

function isFitCollection(collection: HomeCollection) {
  const haystack = collectionKey(collection)
  if (haystack.includes("yamaha")) return false
  return ["adapter", "jig", "insert", "wall-mount", "wall mount", "home-tool", "home tool"]
    .some((term) => haystack.includes(term))
    || collection.handle === "gears"
    || collection.title.toLowerCase() === "gears"
}

const fitOrder = ["adapter", "jig", "insert", "wall", "home tool", "home-tool", "gear"]

function fitRank(collection: HomeCollection) {
  const haystack = collectionKey(collection)
  const index = fitOrder.findIndex((term) => haystack.includes(term))
  return index === -1 ? fitOrder.length : index
}

export function groupHomeCollections(collections: HomeCollection[]): HomeCollectionGroup[] {
  const brands = collections.filter(isBrandCollection).sort((left, right) => homeCollectionRank(left) - homeCollectionRank(right))
  const fit = collections.filter((collection) => !isBrandCollection(collection) && isFitCollection(collection))
    .sort((left, right) => fitRank(left) - fitRank(right) || left.title.localeCompare(right.title))
  const used = new Set([...brands, ...fit].map((collection) => collection.handle))
  const home = collections
    .filter((collection) => !used.has(collection.handle))
    .sort((left, right) => left.title.localeCompare(right.title))

  const groups: HomeCollectionGroup[] = []
  if (brands.length) {
    groups.push({
      id: "brands",
      heading: "Shop by brand",
      intro: "Parts for the tools already in the shed.",
      layout: "brands",
      collections: brands,
    })
  }
  if (fit.length) {
    groups.push({
      id: "fit",
      heading: "Made to fit",
      intro: "Adapters, jigs, inserts, and mounts we print to order.",
      layout: "mosaic",
      collections: fit,
    })
  }
  if (home.length) {
    groups.push({
      id: "home",
      heading: "Around the home",
      intro: "Coffee, networking, gaming, and the odd one-off.",
      layout: "grid",
      collections: home,
    })
  }
  return groups
}

export async function listHomeCollections() {
  if (!databaseConfigured()) return [] as HomeCollection[]
  try {
    const sql = getSql()
    const rows = await sql<HomeCollection[]>`
      select handle, title, image_url as "imageUrl"
      from collections
      where published = true and show_on_home = true
      order by position asc, title asc
    `
    return rows
  } catch {
    return []
  }
}

export async function listNavCollections() {
  if (!databaseConfigured()) return []
  try {
    const sql = getSql()
    return await sql<Array<{ handle: string, title: string }>>`
      select handle, title from collections
      where published = true
      order by position asc, title asc
    `
  } catch {
    return []
  }
}

export async function getCollection(handle: string) {
  if (!databaseConfigured()) return null
  const sql = getSql()
  const rows = await sql<Array<{ id: string, handle: string, title: string, descriptionHtml: string, imageUrl: string | null }>>`
    select id, handle, title, description_html as "descriptionHtml", image_url as "imageUrl"
    from collections
    where handle = ${handle} and published = true
    limit 1
  `
  return rows[0] ?? null
}

export async function popularTags(collectionId?: string) {
  if (!databaseConfigured()) return []
  const sql = getSql()
  if (collectionId) {
    return sql<{ tag: string, count: number }[]>`
      select tag, count(*)::int as count
      from products p
      join collection_products cp on cp.product_id = p.id and cp.collection_id = ${collectionId}
      cross join lateral unnest(p.tags) as tag
      where p.status = 'active'
      group by tag
      order by count desc, tag asc
      limit 30
    `
  }
  return sql<{ tag: string, count: number }[]>`
    select tag, count(*)::int as count
    from products p
    cross join lateral unnest(p.tags) as tag
    where p.status = 'active'
    group by tag
    order by count desc, tag asc
    limit 30
  `
}

export async function getPublicProduct(handle: string): Promise<PublicProduct | null> {
  if (!databaseConfigured()) return null
  const sql = getSql()
  const rows = await sql<Array<{
    id: string
    handle: string
    title: string
    descriptionHtml: string
    tags: string[]
    seoTitle: string
    seoDescription: string
    metadata: ProductMetadata
  }>>`
    select id, handle, title, description_html as "descriptionHtml", tags,
      seo_title as "seoTitle", seo_description as "seoDescription", metadata
    from products
    where handle = ${handle} and status = 'active'
    limit 1
  `
  const product = rows[0]
  if (!product) return null
  const images = await sql<Array<{ id: string, url: string, alt: string }>>`
    select id, url, alt from product_images
    where product_id = ${product.id}
    order by position asc
  `
  const variants = await sql<PublicVariant[]>`
    select id, title, sku,
      option1_name as "option1Name", option1_value as "option1Value",
      option2_name as "option2Name", option2_value as "option2Value",
      option3_name as "option3Name", option3_value as "option3Value",
      price_cents as "priceCents", compare_at_cents as "compareAtCents",
      inventory_qty as "inventoryQty", inventory_policy as "inventoryPolicy",
      available
    from variants
    where product_id = ${product.id}
    order by position asc
  `
  return {
    ...product,
    tags: product.tags ?? [],
    metadata: product.metadata ?? {},
    images,
    variants: variants.map((variant) => ({
      ...variant,
      priceCents: Number(variant.priceCents),
      compareAtCents: variant.compareAtCents == null ? null : Number(variant.compareAtCents),
      inventoryQty: Number(variant.inventoryQty),
      available: Boolean(variant.available),
    })),
  }
}

export async function listFeaturedProducts() {
  if (!databaseConfigured()) return []
  try {
    const sql = getSql()
    const featuredRows = await sql<ProductCard[]>`
      select
        p.id, p.handle, p.title,
        pr.min_price as "priceCents",
        pr.compare_at as "compareAtCents",
        img.url as "imageUrl",
        coalesce(img.alt, '') as "imageAlt",
        pr.purchasable as "purchasable"
      from products p
      join (
        select product_id, min(price_cents) as min_price, min(compare_at_cents) as compare_at,
          bool_or(available and (inventory_policy = 'continue' or inventory_qty > 0)) as purchasable
        from variants group by product_id
      ) pr on pr.product_id = p.id
      left join lateral (
        select url, alt from product_images i where i.product_id = p.id order by position asc limit 1
      ) img on true
      where p.status = 'active' and p.featured = true
      order by p.updated_at desc
      limit 8
    `
    if (featuredRows.length) {
      return featuredRows.map((row) => ({
        ...row,
        priceCents: Number(row.priceCents),
        compareAtCents: row.compareAtCents == null ? null : Number(row.compareAtCents),
        purchasable: Boolean(row.purchasable),
      }))
    }
    const latest = await listProducts({ pageSize: 8 })
    return latest.items
  } catch {
    return []
  }
}

export function productPurchasable(product: PublicProduct) {
  return product.variants.some((variant) => isPurchasable(variant))
}

export async function handlesForSitemap() {
  if (!databaseConfigured()) return { products: [] as string[], collections: [] as string[] }
  try {
    const sql = getSql()
    const products = await sql<{ handle: string }[]>`select handle from products where status = 'active'`
    const collections = await sql<{ handle: string }[]>`select handle from collections where published = true`
    return {
      products: products.map((row) => row.handle),
      collections: collections.map((row) => row.handle),
    }
  } catch {
    return { products: [], collections: [] }
  }
}
