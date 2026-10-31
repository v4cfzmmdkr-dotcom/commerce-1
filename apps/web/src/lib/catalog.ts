import { getSql, databaseConfigured } from "@/db/client"
import { isPurchasable } from "@/lib/money"
import { keepBlackWhiteColours } from "@/lib/product-colours"
import { dataApiEnabled, supabaseRest } from "@/lib/supabase-rest"
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

function catalogViaHttps() {
  return dataApiEnabled()
}

type RestProduct = {
  id: string
  handle: string
  title: string
  created_at?: string
  product_images?: Array<{ url: string, alt: string | null, position: number }>
  variants?: Array<{
    price_cents: number
    compare_at_cents: number | null
    available: boolean
    inventory_policy: string
    inventory_qty: number
  }>
}

function cardsFromRest(rows: RestProduct[]): ProductCard[] {
  return rows.flatMap((row) => {
    const variants = row.variants ?? []
    if (!variants.length) return []
    const prices = variants.map((variant) => Number(variant.price_cents))
    const compares = variants.map((variant) => variant.compare_at_cents).filter((value): value is number => value != null)
    const image = [...(row.product_images ?? [])].sort((left, right) => left.position - right.position)[0]
    return [{
      id: row.id,
      handle: row.handle,
      title: row.title,
      priceCents: Math.min(...prices),
      compareAtCents: compares.length ? Math.min(...compares.map(Number)) : null,
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? "",
      purchasable: variants.some((variant) => variant.available && (variant.inventory_policy === "continue" || Number(variant.inventory_qty) > 0)),
    }]
  })
}

async function listProductsFromRest(query: CatalogQuery) {
  const pageSize = query.pageSize ?? 24
  const page = Math.max(1, query.page ?? 1)
  const offset = (page - 1) * pageSize
  let collectionIds: string[] | null = null
  if (query.collectionId) {
    const links = await supabaseRest<Array<{ product_id: string }>>(
      `collection_products?collection_id=eq.${encodeURIComponent(query.collectionId)}&select=product_id&order=position.asc`,
    )
    if (!links) return null
    collectionIds = links.data.map((row) => row.product_id)
    if (!collectionIds.length) {
      return { items: [] as ProductCard[], total: 0, page, pageCount: 1 }
    }
  }
  const params = new URLSearchParams()
  params.set("status", "eq.active")
  params.set("select", "id,handle,title,created_at,product_images(url,alt,position),variants!inner(price_cents,compare_at_cents,available,inventory_policy,inventory_qty)")
  if (query.sort === "price-asc") params.set("order", "variants(price_cents).asc")
  else if (query.sort === "price-desc") params.set("order", "variants(price_cents).desc")
  else if (query.sort === "title") params.set("order", "title.asc")
  else params.set("order", "created_at.desc")
  if (query.q?.trim()) {
    const term = `*${query.q.trim().replace(/[,()]/g, "")}*`
    params.set("or", `(title.ilike.${term},handle.ilike.${term})`)
  }
  if (query.tag) {
    const tag = query.tag.replace(/[{},]/g, "")
    params.set("tags", `cs.{${tag}}`)
  }
  if (collectionIds) {
    params.set("id", `in.(${collectionIds.join(",")})`)
  }
  const useCollectionOrder = Boolean(collectionIds) && (!query.sort || query.sort === "newest")
  const result = await supabaseRest<RestProduct[]>(`products?${params.toString()}`, {
    Prefer: "count=exact",
    ...(useCollectionOrder ? {} : { Range: `${offset}-${offset + pageSize - 1}` }),
  })
  if (!result) return null
  let items = cardsFromRest(result.data)
  if (useCollectionOrder && collectionIds) {
    const byId = new Map(items.map((item) => [item.id, item]))
    items = collectionIds.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    })
  }
  const total = collectionIds && !query.q?.trim() && !query.tag
    ? collectionIds.length
    : (result.total || items.length)
  const paged = useCollectionOrder ? items.slice(offset, offset + pageSize) : items
  return {
    items: paged,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function listProducts(query: CatalogQuery) {
  if (catalogViaHttps()) {
    return await listProductsFromRest(query) ?? { items: [] as ProductCard[], total: 0, page: 1, pageCount: 1 }
  }
  if (!databaseConfigured()) {
    return { items: [] as ProductCard[], total: 0, page: 1, pageCount: 1 }
  }
  try {
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : "query failed"
    console.error(`Catalog query failed: ${detail}`)
    return await listProductsFromRest(query) ?? { items: [] as ProductCard[], total: 0, page: 1, pageCount: 1 }
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

async function homeCollectionsFromRest() {
  const rest = await supabaseRest<Array<{ handle: string, title: string, image_url: string | null }>>("collections?published=eq.true&show_on_home=eq.true&select=handle,title,image_url&order=position.asc,title.asc")
  return (rest?.data ?? []).map((row) => ({ handle: row.handle, title: row.title, imageUrl: row.image_url }))
}

export async function listHomeCollections() {
  if (catalogViaHttps()) return homeCollectionsFromRest()
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : "query failed"
    console.error(`Home collections query failed: ${detail}`)
    return homeCollectionsFromRest()
  }
}

export async function listNavCollections() {
  if (catalogViaHttps()) {
    const rest = await supabaseRest<Array<{ handle: string, title: string }>>("collections?published=eq.true&select=handle,title&order=position.asc,title.asc")
    return rest?.data ?? []
  }
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
  if (catalogViaHttps()) {
    const rest = await supabaseRest<Array<{ id: string, handle: string, title: string, description_html: string, image_url: string | null }>>(`collections?handle=eq.${encodeURIComponent(handle)}&published=eq.true&select=id,handle,title,description_html,image_url&limit=1`)
    const row = rest?.data?.[0]
    if (!row) return null
    return { id: row.id, handle: row.handle, title: row.title, descriptionHtml: row.description_html, imageUrl: row.image_url }
  }
  if (!databaseConfigured()) return null
  try {
    const sql = getSql()
    const rows = await sql<Array<{ id: string, handle: string, title: string, descriptionHtml: string, imageUrl: string | null }>>`
      select id, handle, title, description_html as "descriptionHtml", image_url as "imageUrl"
      from collections
      where handle = ${handle} and published = true
      limit 1
    `
    return rows[0] ?? null
  } catch (error) {
    const detail = error instanceof Error ? error.message : "query failed"
    console.error(`Collection query failed: ${detail}`)
    return null
  }
}

export async function popularTags(collectionId?: string) {
  if (catalogViaHttps()) return []
  if (!databaseConfigured()) return []
  try {
  const sql = getSql()
  if (collectionId) {
    return await sql<{ tag: string, count: number }[]>`
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
  return await sql<{ tag: string, count: number }[]>`
    select tag, count(*)::int as count
    from products p
    cross join lateral unnest(p.tags) as tag
    where p.status = 'active'
    group by tag
    order by count desc, tag asc
    limit 30
  `
  } catch (error) {
    const detail = error instanceof Error ? error.message : "query failed"
    console.error(`Tag query failed: ${detail}`)
    return []
  }
}

export async function getPublicProduct(handle: string): Promise<PublicProduct | null> {
  if (catalogViaHttps()) {
    const rest = await supabaseRest<Array<{
      id: string
      handle: string
      title: string
      description_html: string
      tags: string[]
      seo_title: string
      seo_description: string
      metadata: ProductMetadata
      product_images?: Array<{ id: string, url: string, alt: string | null, position: number }>
      variants?: Array<{
        id: string
        title: string
        sku: string
        option1_name: string
        option1_value: string
        option2_name: string
        option2_value: string
        option3_name: string
        option3_value: string
        price_cents: number
        compare_at_cents: number | null
        inventory_qty: number
        inventory_policy: string
        available: boolean
      }>
    }>>(`products?handle=eq.${encodeURIComponent(handle)}&status=eq.active&select=id,handle,title,description_html,tags,seo_title,seo_description,metadata,product_images(id,url,alt,position),variants(id,title,sku,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value,price_cents,compare_at_cents,inventory_qty,inventory_policy,available)&limit=1`)
    const product = rest?.data?.[0]
    if (!product) return null
    const images = [...(product.product_images ?? [])].sort((left, right) => left.position - right.position)
    return {
      id: product.id,
      handle: product.handle,
      title: product.title,
      descriptionHtml: product.description_html,
      tags: product.tags ?? [],
      seoTitle: product.seo_title,
      seoDescription: product.seo_description,
      metadata: product.metadata ?? {},
      images: images.map((image) => ({ id: image.id, url: image.url, alt: image.alt ?? "" })),
      variants: keepBlackWhiteColours((product.variants ?? []).map((variant) => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        option1Name: variant.option1_name,
        option1Value: variant.option1_value,
        option2Name: variant.option2_name,
        option2Value: variant.option2_value,
        option3Name: variant.option3_name,
        option3Value: variant.option3_value,
        priceCents: Number(variant.price_cents),
        compareAtCents: variant.compare_at_cents == null ? null : Number(variant.compare_at_cents),
        inventoryQty: Number(variant.inventory_qty),
        inventoryPolicy: variant.inventory_policy,
        available: Boolean(variant.available),
      }))),
    }
  }
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
    variants: keepBlackWhiteColours(variants.map((variant) => ({
      ...variant,
      priceCents: Number(variant.priceCents),
      compareAtCents: variant.compareAtCents == null ? null : Number(variant.compareAtCents),
      inventoryQty: Number(variant.inventoryQty),
      available: Boolean(variant.available),
    }))),
  }
}

export async function listFeaturedProducts() {
  if (catalogViaHttps()) {
    const latest = await listProductsFromRest({ pageSize: 8 })
    return latest?.items ?? []
  }
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
