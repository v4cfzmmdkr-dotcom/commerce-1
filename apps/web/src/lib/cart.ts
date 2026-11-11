import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"
import { getSql } from "@/db/client"
import { isPurchasable, maxPurchasable } from "@/lib/money"
import { materialColourRules, shopMaterials, variantOffered } from "@/lib/product-options"
import { getSettings } from "@/lib/settings"
import { dataApiEnabled, supabaseMutate, supabaseRest } from "@/lib/supabase-rest"

const cartCookie = "np_cart"
const idPattern = /^[A-Za-z0-9-]{1,64}$/

export async function cartId() {
  const jar = await cookies()
  const value = jar.get(cartCookie)?.value
  return value && idPattern.test(value) ? value : null
}

async function rememberCart(id: string) {
  const jar = await cookies()
  jar.set(cartCookie, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

type RestCartItem = {
  id: string
  variant_id: string
  quantity: number
  variants: {
    price_cents: number
    sku: string
    title: string
    inventory_qty: number
    inventory_policy: string
    available: boolean
    taxable: boolean
    products: {
      title: string
      handle: string
      status: string
      product_images?: Array<{ url: string, position: number }>
    }
  }
}

function linesFromRest(rows: RestCartItem[]): CartLine[] {
  return rows.flatMap((row) => {
    const variant = row.variants
    const product = variant?.products
    if (!variant || !product || product.status !== "active") return []
    const image = [...(product.product_images ?? [])].sort((left, right) => left.position - right.position)[0]
    return [{
      id: row.id,
      variantId: row.variant_id,
      quantity: Number(row.quantity),
      unitPriceCents: Number(variant.price_cents),
      sku: variant.sku,
      productTitle: product.title,
      productHandle: product.handle,
      variantTitle: variant.title,
      imageUrl: image?.url ?? null,
      inventoryQty: Number(variant.inventory_qty),
      inventoryPolicy: variant.inventory_policy,
      available: Boolean(variant.available),
      taxable: Boolean(variant.taxable),
    }]
  })
}

export async function getOrCreateCart() {
  const existing = await cartId()
  if (dataApiEnabled()) {
    if (existing) {
      const found = await supabaseRest<Array<{ id: string }>>(`carts?id=eq.${existing}&select=id`)
      if (found?.data[0]) return found.data[0].id
    }
    const id = randomUUID()
    const created = await supabaseMutate<Array<{ id: string }>>("carts", "POST", { id })
    if (!created?.data[0]) throw new Error("Could not create a cart")
    await rememberCart(id)
    return id
  }
  const sql = getSql()
  if (existing) {
    const rows = await sql<{ id: string }[]>`select id from carts where id = ${existing}`
    if (rows[0]) return rows[0].id
  }
  const id = randomUUID()
  await sql`insert into carts (id) values (${id})`
  await rememberCart(id)
  return id
}

export type CartLine = {
  id: string
  variantId: string
  quantity: number
  unitPriceCents: number
  sku: string
  productTitle: string
  productHandle: string
  variantTitle: string
  imageUrl: string | null
  inventoryQty: number
  inventoryPolicy: string
  available: boolean
  taxable: boolean
}

export async function getCart() {
  const id = await cartId()
  if (!id) return { id: null, lines: [] as CartLine[] }
  if (dataApiEnabled()) {
    const result = await supabaseRest<RestCartItem[]>(
      `cart_items?cart_id=eq.${id}&select=id,variant_id,quantity,variants(price_cents,sku,title,inventory_qty,inventory_policy,available,taxable,products(title,handle,status,product_images(url,position)))&order=id.asc`,
    )
    return { id, lines: linesFromRest(result?.data ?? []) }
  }
  const sql = getSql()
  const lines = await sql<CartLine[]>`
    select
      ci.id,
      ci.variant_id as "variantId",
      ci.quantity,
      v.price_cents as "unitPriceCents",
      v.sku,
      p.title as "productTitle",
      p.handle as "productHandle",
      v.title as "variantTitle",
      img.url as "imageUrl",
      v.inventory_qty as "inventoryQty",
      v.inventory_policy as "inventoryPolicy",
      v.available,
      v.taxable
    from cart_items ci
    join variants v on v.id = ci.variant_id
    join products p on p.id = v.product_id
    left join lateral (
      select url from product_images i where i.product_id = p.id order by position asc limit 1
    ) img on true
    where ci.cart_id = ${id} and p.status = 'active'
    order by ci.id
  `
  return {
    id,
    lines: lines.map((line) => ({
      ...line,
      quantity: Number(line.quantity),
      unitPriceCents: Number(line.unitPriceCents),
      inventoryQty: Number(line.inventoryQty),
      available: Boolean(line.available),
      taxable: Boolean(line.taxable),
    })),
  }
}

export type CartPreviewLine = Pick<
  CartLine,
  "id" | "quantity" | "unitPriceCents" | "productTitle" | "productHandle" | "variantTitle" | "imageUrl"
>

export type CartSummary = {
  count: number
  subtotalCents: number
  lines: CartPreviewLine[]
}

export async function cartSummary(): Promise<CartSummary> {
  try {
    const cart = await getCart()
    return {
      count: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotalCents: cart.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
      lines: cart.lines.map((line) => ({
        id: line.id,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        productTitle: line.productTitle,
        productHandle: line.productHandle,
        variantTitle: line.variantTitle,
        imageUrl: line.imageUrl,
      })),
    }
  } catch {
    return { count: 0, subtotalCents: 0, lines: [] }
  }
}

type OfferedCheck = {
  option1Name: string
  option1Value: string
  option2Name: string
  option2Value: string
  option3Name: string
  option3Value: string
  materials: unknown
}

async function stillOffered(variant: OfferedCheck) {
  const settings = await getSettings()
  return variantOffered(variant, materialColourRules(settings.colours, settings.materials), shopMaterials(variant.materials, settings.materials))
}

export async function addVariantToCart(variantId: string, quantity: number) {
  if (!idPattern.test(variantId)) throw new Error("That option is not available")
  if (dataApiEnabled()) {
    const result = await supabaseRest<Array<{
      id: string
      price_cents: number
      inventory_qty: number
      inventory_policy: string
      available: boolean
      option1_name: string
      option1_value: string
      option2_name: string
      option2_value: string
      option3_name: string
      option3_value: string
      products: { status: string, materials: string[] | null }
    }>>(`variants?id=eq.${variantId}&select=id,price_cents,inventory_qty,inventory_policy,available,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value,products(status,materials)`)
    const row = result?.data[0]
    const variant = row
      ? {
        id: row.id,
        priceCents: Number(row.price_cents),
        inventoryQty: Number(row.inventory_qty),
        inventoryPolicy: row.inventory_policy,
        available: Boolean(row.available),
        status: row.products?.status,
        option1Name: row.option1_name,
        option1Value: row.option1_value,
        option2Name: row.option2_name,
        option2Value: row.option2_value,
        option3Name: row.option3_name,
        option3Value: row.option3_value,
        materials: row.products?.materials,
      }
      : null
    if (!variant || variant.status !== "active" || !isPurchasable(variant) || !(await stillOffered(variant))) {
      throw new Error("That option is not available")
    }
    const qty = Math.max(1, Math.min(quantity, maxPurchasable(variant)))
    const cart = await getOrCreateCart()
    const existing = await supabaseRest<Array<{ id: string, quantity: number }>>(`cart_items?cart_id=eq.${cart}&variant_id=eq.${variantId}&select=id,quantity`)
    const current = existing?.data[0]
    const nextQty = (current ? Number(current.quantity) : 0) + qty
    if (nextQty > maxPurchasable(variant)) {
      throw new Error(`Only ${maxPurchasable(variant)} available`)
    }
    if (current) {
      const updated = await supabaseMutate("cart_items?id=eq." + current.id, "PATCH", { quantity: nextQty })
      if (!updated) throw new Error("Could not update the cart")
      return
    }
    const inserted = await supabaseMutate("cart_items", "POST", {
      id: randomUUID(),
      cart_id: cart,
      variant_id: variantId,
      quantity: qty,
    })
    if (!inserted) throw new Error("Could not add that part to the cart")
    return
  }
  const sql = getSql()
  const rows = await sql<Array<{
    id: string
    priceCents: number
    inventoryQty: number
    inventoryPolicy: string
    available: boolean
    status: string
  } & OfferedCheck>>`
    select v.id, v.price_cents as "priceCents", v.inventory_qty as "inventoryQty",
      v.inventory_policy as "inventoryPolicy", v.available, p.status,
      v.option1_name as "option1Name", v.option1_value as "option1Value",
      v.option2_name as "option2Name", v.option2_value as "option2Value",
      v.option3_name as "option3Name", v.option3_value as "option3Value",
      p.materials
    from variants v
    join products p on p.id = v.product_id
    where v.id = ${variantId}
  `
  const variant = rows[0]
  if (!variant || variant.status !== "active" || !isPurchasable(variant) || !(await stillOffered(variant))) {
    throw new Error("That option is not available")
  }
  const qty = Math.max(1, Math.min(quantity, maxPurchasable(variant)))
  const cart = await getOrCreateCart()
  const existing = await sql<{ id: string, quantity: number }[]>`
    select id, quantity from cart_items where cart_id = ${cart} and variant_id = ${variantId}
  `
  const nextQty = (existing[0] ? Number(existing[0].quantity) : 0) + qty
  if (nextQty > maxPurchasable(variant)) {
    throw new Error(`Only ${maxPurchasable(variant)} available`)
  }
  if (existing[0]) {
    await sql`update cart_items set quantity = ${nextQty} where id = ${existing[0].id}`
  } else {
    await sql`
      insert into cart_items (id, cart_id, variant_id, quantity)
      values (${randomUUID()}, ${cart}, ${variantId}, ${qty})
    `
  }
}

export async function updateCartQuantity(itemId: string, quantity: number) {
  const id = await cartId()
  if (!id || !idPattern.test(itemId)) return
  if (dataApiEnabled()) {
    if (quantity <= 0) {
      await supabaseMutate(`cart_items?id=eq.${itemId}&cart_id=eq.${id}`, "DELETE")
      return
    }
    const result = await supabaseRest<Array<{
      variants: { inventory_qty: number, inventory_policy: string, available: boolean }
    }>>(`cart_items?id=eq.${itemId}&cart_id=eq.${id}&select=variants(inventory_qty,inventory_policy,available)`)
    const variant = result?.data[0]?.variants
    if (!variant) return
    const next = Math.min(quantity, maxPurchasable({
      inventoryQty: Number(variant.inventory_qty),
      inventoryPolicy: variant.inventory_policy,
      available: Boolean(variant.available),
    }))
    if (next <= 0) {
      await supabaseMutate(`cart_items?id=eq.${itemId}&cart_id=eq.${id}`, "DELETE")
      return
    }
    await supabaseMutate(`cart_items?id=eq.${itemId}&cart_id=eq.${id}`, "PATCH", { quantity: next })
    return
  }
  const sql = getSql()
  if (quantity <= 0) {
    await sql`delete from cart_items where id = ${itemId} and cart_id = ${id}`
    return
  }
  const rows = await sql<Array<{ inventoryQty: number, inventoryPolicy: string, available: boolean }>>`
    select v.inventory_qty as "inventoryQty", v.inventory_policy as "inventoryPolicy", v.available
    from cart_items ci
    join variants v on v.id = ci.variant_id
    where ci.id = ${itemId} and ci.cart_id = ${id}
  `
  const variant = rows[0]
  if (!variant) return
  const next = Math.min(quantity, maxPurchasable({
    ...variant,
    inventoryQty: Number(variant.inventoryQty),
    available: Boolean(variant.available),
  }))
  if (next <= 0) {
    await sql`delete from cart_items where id = ${itemId} and cart_id = ${id}`
    return
  }
  await sql`update cart_items set quantity = ${next} where id = ${itemId} and cart_id = ${id}`
}

export async function clearCart(id: string) {
  if (dataApiEnabled()) {
    await supabaseMutate(`cart_items?cart_id=eq.${id}`, "DELETE")
    return
  }
  const sql = getSql()
  await sql`delete from cart_items where cart_id = ${id}`
}
