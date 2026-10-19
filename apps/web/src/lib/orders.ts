import { randomUUID } from "node:crypto"
import type Stripe from "stripe"
import { getSql } from "@/db/client"
import { sendOrderEmail } from "@/lib/email"
import { merchandiseSubtotal, quoteOrder, type PricedLine } from "@/lib/pricing"
import { nullableCents, selectShippingRate, type ShippingRate } from "@/lib/shipping"
import { getSettings } from "@/lib/settings"
import type { Address } from "@/lib/types"

export type { PricedLine }

export async function resolveShippingRate(input: {
  shippingRateId: string
  country: string
  subtotalCents: number
}) {
  const sql = getSql()
  const rows = await sql<Array<ShippingRate>>`
    select id, name, price_cents as "priceCents", countries, active,
      min_subtotal_cents as "minSubtotalCents", max_subtotal_cents as "maxSubtotalCents"
    from shipping_rates
    where active = true
    order by position asc, price_cents asc
  `
  const rates = rows.map((row) => ({
    ...row,
    priceCents: Number(row.priceCents),
    minSubtotalCents: nullableCents(row.minSubtotalCents),
    maxSubtotalCents: nullableCents(row.maxSubtotalCents),
  }))
  return selectShippingRate(rates, input.subtotalCents, input.country, input.shippingRateId)
}

export async function createPendingOrder(input: {
  email: string
  cartId: string | null
  lines: PricedLine[]
  shippingRateId: string
  address: Address
}) {
  const settings = await getSettings()
  if (input.lines.length === 0) throw new Error("Your cart is empty")
  const subtotalCents = merchandiseSubtotal(input.lines)
  const selection = await resolveShippingRate({
    shippingRateId: input.shippingRateId,
    country: input.address.country,
    subtotalCents,
  })
  const rate = selection.rate
  if (!rate) {
    throw new Error(selection.reason === "none"
      ? "No delivery option is available for this address"
      : "Choose a delivery option")
  }
  const quote = quoteOrder({
    lines: input.lines,
    shippingCents: rate.priceCents,
    gstRateBps: settings.gstRateBps,
    pricesIncludeTax: settings.pricesIncludeTax,
  })
  const sql = getSql()
  const numbers = await sql<{ next: number }[]>`select nextval('order_number_seq')::int as next`
  const id = randomUUID()
  const token = randomUUID()
  const number = `NP-${numbers[0].next}`
  await sql.begin(async (tx) => {
    await tx`
      insert into orders (
        id, number, public_token, email, status, payment_status, fulfillment_status, cart_id,
        subtotal_cents, shipping_cents, tax_cents, total_cents, currency, shipping_name, shipping_address
      ) values (
        ${id}, ${number}, ${token}, ${input.email}, 'pending', 'unpaid', 'unfulfilled', ${input.cartId},
        ${quote.subtotal}, ${quote.shipping}, ${quote.tax}, ${quote.total}, ${settings.currency},
        ${rate.name}, ${tx.json(input.address as unknown as Record<string, string>)}
      )
    `
    for (const line of input.lines) {
      await tx`
        insert into order_items (
          id, order_id, variant_id, product_title, variant_title, sku, quantity, unit_price_cents
        ) values (
          ${randomUUID()}, ${id}, ${line.variantId}, ${line.productTitle}, ${line.variantTitle},
          ${line.sku}, ${line.quantity}, ${line.unitPriceCents}
        )
      `
    }
  })
  return { id, number, token, quote, shippingName: rate.name, currency: settings.currency }
}

export async function attachStripeSession(orderId: string, sessionId: string) {
  const sql = getSql()
  await sql`update orders set stripe_session_id = ${sessionId}, updated_at = now() where id = ${orderId}`
}

export async function cancelUnpaidOrder(orderId: string) {
  const sql = getSql()
  await sql`
    update orders
    set status = 'cancelled', updated_at = now()
    where id = ${orderId} and payment_status = 'unpaid'
  `
}

type OrderRow = {
  id: string
  number: string
  publicToken: string
  email: string
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  totalCents: number
  currency: string
  shippingName: string
  shippingAddress: Address
  cartId: string | null
}

export async function fulfillPaidOrder(orderId: string, session: Stripe.Checkout.Session) {
  const sql = getSql()
  const rows = await sql<OrderRow[]>`
    select id, number, public_token as "publicToken", email, status, payment_status as "paymentStatus",
      fulfillment_status as "fulfillmentStatus", total_cents as "totalCents", currency, shipping_name as "shippingName",
      shipping_address as "shippingAddress", cart_id as "cartId"
    from orders where id = ${orderId}
  `
  const order = rows[0]
  if (!order) throw new Error("Order not found")
  if (session.metadata?.orderId !== order.id) throw new Error("Payment does not match this order")
  if (session.currency && session.currency.toLowerCase() !== order.currency.toLowerCase()) {
    throw new Error("Payment currency does not match the order")
  }
  if (session.amount_total !== Number(order.totalCents)) {
    throw new Error("Payment amount does not match the order")
  }
  if (session.payment_status !== "paid") return { already: false, paid: false }
  if (order.paymentStatus === "paid") return { already: true, paid: true }

  const items = await sql<Array<{
    variantId: string | null
    quantity: number
    productTitle: string
    variantTitle: string
    unitPriceCents: number
  }>>`
    select variant_id as "variantId", quantity, product_title as "productTitle",
      variant_title as "variantTitle", unit_price_cents as "unitPriceCents"
    from order_items where order_id = ${order.id}
  `
  let inventoryWarning = false
  await sql.begin(async (tx) => {
    for (const item of items) {
      if (!item.variantId) {
        inventoryWarning = true
        continue
      }
      const updated = await tx`
        update variants
        set inventory_qty = inventory_qty - ${item.quantity}
        where id = ${item.variantId}
          and (inventory_policy = 'continue' or inventory_qty >= ${item.quantity})
        returning id
      `
      if (updated.length === 0) inventoryWarning = true
    }
    const paymentIntent = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null
    await tx`
      update orders
      set payment_status = 'paid',
          status = 'paid',
          stripe_session_id = ${session.id},
          stripe_payment_intent_id = ${paymentIntent},
          inventory_warning = ${inventoryWarning},
          paid_at = now(),
          updated_at = now()
      where id = ${order.id} and payment_status <> 'paid'
    `
    if (order.cartId) {
      await tx`delete from cart_items where cart_id = ${order.cartId}`
    }
  })

  const emailStatus = await sendOrderEmail({
    number: order.number,
    publicToken: order.publicToken,
    email: order.email,
    totalCents: Number(order.totalCents),
    currency: order.currency,
    shippingName: order.shippingName,
    shippingAddress: order.shippingAddress,
    items: items.map((item) => ({
      productTitle: item.productTitle,
      variantTitle: item.variantTitle,
      quantity: Number(item.quantity),
      unitPriceCents: Number(item.unitPriceCents),
    })),
  })
  await sql`update orders set email_status = ${emailStatus} where id = ${order.id}`
  return { already: false, paid: true }
}

export async function markOrderFailed(orderId: string) {
  const sql = getSql()
  await sql`
    update orders
    set payment_status = 'failed', status = 'cancelled', updated_at = now()
    where id = ${orderId} and payment_status = 'unpaid'
  `
}
