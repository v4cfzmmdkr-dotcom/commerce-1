import { randomUUID } from "node:crypto"
import { getSql } from "@/db/client"
import {
  materialColourRules,
  materialMarkups,
  parseColours,
  parseMaterialSettings,
  planReprice,
  planVariants,
  shopMaterials,
  type PlanVariant,
} from "@/lib/product-options"

type VariantRow = PlanVariant & {
  productId: string
  costCents: number | null
  inventoryQty: number
  inventoryPolicy: string
  weightGrams: number
  taxable: boolean
  barcode: string
  available: boolean
}

async function load(productIds?: string[]) {
  const sql = getSql()
  const [settings] = await sql<Array<{ colours: unknown, materials: unknown }>>`
    select colours, materials from store_settings where id = 'default'
  `
  const products = await sql<Array<{ id: string, materials: string[] }>>`
    select id, materials from products ${productIds ? sql`where id in ${sql(productIds)}` : sql``}
  `
  const rows = products.length ? await sql<VariantRow[]>`
    select id, product_id as "productId", sku, title,
      option1_name as "option1Name", option1_value as "option1Value",
      option2_name as "option2Name", option2_value as "option2Value",
      option3_name as "option3Name", option3_value as "option3Value",
      price_cents as "priceCents", compare_at_cents as "compareAtCents", cost_cents as "costCents",
      inventory_qty as "inventoryQty", inventory_policy as "inventoryPolicy", weight_grams as "weightGrams",
      taxable, barcode, position, available
    from variants
    ${productIds ? sql`where product_id in ${sql(productIds)}` : sql``}
    order by position
  ` : []
  const byProduct = new Map<string, VariantRow[]>()
  for (const row of rows) byProduct.set(row.productId, [...(byProduct.get(row.productId) ?? []), row])
  const materialSettings = parseMaterialSettings(settings?.materials)
  return {
    colours: materialColourRules(parseColours(settings?.colours), materialSettings),
    materialSettings,
    products,
    byProduct,
  }
}

export async function syncProductOptions(productIds?: string[]) {
  const sql = getSql()
  const { colours, materialSettings, products, byProduct } = await load(productIds)
  const markups = materialMarkups(materialSettings)
  const updates: VariantRow[] = []
  const inserts: Array<Record<string, unknown>> = []
  for (const product of products) {
    const plan = planVariants(byProduct.get(product.id) ?? [], colours, shopMaterials(product.materials, materialSettings), markups)
    updates.push(...plan.updates)
    for (const variant of plan.inserts) {
      inserts.push({
        id: randomUUID(),
        product_id: variant.productId,
        sku: variant.sku,
        title: variant.title,
        option1_name: variant.option1Name,
        option1_value: variant.option1Value,
        option2_name: variant.option2Name,
        option2_value: variant.option2Value,
        option3_name: variant.option3Name,
        option3_value: variant.option3Value,
        price_cents: variant.priceCents,
        compare_at_cents: variant.compareAtCents,
        cost_cents: variant.costCents,
        inventory_qty: variant.inventoryQty,
        inventory_policy: variant.inventoryPolicy,
        weight_grams: variant.weightGrams,
        taxable: variant.taxable,
        barcode: "",
        position: variant.position,
        available: true,
      })
    }
  }
  await sql.begin(async (tx) => {
    for (const variant of updates) {
      await tx`
        update variants set
          option1_name = ${variant.option1Name}, option1_value = ${variant.option1Value},
          option2_name = ${variant.option2Name}, option2_value = ${variant.option2Value},
          option3_name = ${variant.option3Name}, option3_value = ${variant.option3Value},
          title = ${variant.title}
        where id = ${variant.id}
      `
    }
    for (let start = 0; start < inserts.length; start += 500) {
      await tx`insert into variants ${tx(inserts.slice(start, start + 500))}`
    }
  })
  return { added: inserts.length, updated: updates.length }
}

export async function repriceMaterials(productIds?: string[]) {
  const sql = getSql()
  const { materialSettings, byProduct } = await load(productIds)
  const markups = materialMarkups(materialSettings)
  const updates = [...byProduct.values()].flatMap((variants) => planReprice(variants, markups))
  await sql.begin(async (tx) => {
    for (const update of updates) {
      await tx`
        update variants set price_cents = ${update.priceCents}, compare_at_cents = ${update.compareAtCents}
        where id = ${update.id}
      `
    }
  })
  return updates.length
}
