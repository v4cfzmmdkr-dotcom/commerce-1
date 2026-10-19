import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"
import { getSql } from "@/db/client"
import { isPurchasable, maxPurchasable } from "@/lib/money"

const cartCookie = "np_cart"

export async function cartId() {
  const jar = await cookies()
  return jar.get(cartCookie)?.value ?? null
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

export async function getOrCreateCart() {
  const sql = getSql()
  const existing = await cartId()
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

export async function cartCount() {
  try {
    const cart = await getCart()
    return cart.lines.reduce((sum, line) => sum + line.quantity, 0)
  } catch {
    return 0
  }
}

export async function addVariantToCart(variantId: string, quantity: number) {
  const sql = getSql()
  const rows = await sql<Array<{
    id: string
    priceCents: number
    inventoryQty: number
    inventoryPolicy: string
    available: boolean
    status: string
  }>>`
    select v.id, v.price_cents as "priceCents", v.inventory_qty as "inventoryQty",
      v.inventory_policy as "inventoryPolicy", v.available, p.status
    from variants v
    join products p on p.id = v.product_id
    where v.id = ${variantId}
  `
  const variant = rows[0]
  if (!variant || variant.status !== "active" || !isPurchasable(variant)) {
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
  if (!id) return
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
  const sql = getSql()
  await sql`delete from cart_items where cart_id = ${id}`
}
