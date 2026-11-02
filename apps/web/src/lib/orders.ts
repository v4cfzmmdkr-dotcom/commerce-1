import { randomUUID } from "node:crypto"
import type Stripe from "stripe"
import { getSql } from "@/db/client"
import { sendOrderEmail } from "@/lib/email"
import { merchandiseSubtotal, quoteOrder, type PricedLine } from "@/lib/pricing"
import { nullableCents, selectShippingRate, type ShippingRate } from "@/lib/shipping"
import { getSettings } from "@/lib/settings"
import { dataApiEnabled, supabaseMutate, supabaseRest, supabaseRpc } from "@/lib/supabase-rest"
import type { Address } from "@/lib/types"

export type { PricedLine }

export async function listActiveShippingRates() {
  if (dataApiEnabled()) {
    const result = await supabaseRest<Array<{
      id: string
      name: string
      description?: string
      price_cents: number
      countries: string
      active: boolean
      min_subtotal_cents: number | null
      max_subtotal_cents: number | null
    }>>("shipping_rates?active=eq.true&select=id,name,description,price_cents,countries,active,min_subtotal_cents,max_subtotal_cents&order=position.asc,price_cents.asc")
    return (result?.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      priceCents: Number(row.price_cents),
      countries: row.countries,
      active: row.active,
      minSubtotalCents: nullableCents(row.min_subtotal_cents),
      maxSubtotalCents: nullableCents(row.max_subtotal_cents),
    }))
  }
  const sql = getSql()
  const rows = await sql<Array<ShippingRate & { description?: string }>>`
    select id, name, description, price_cents as "priceCents", countries, active,
      min_subtotal_cents as "minSubtotalCents", max_subtotal_cents as "maxSubtotalCents"
    from shipping_rates
    where active = true
    order by position asc, price_cents asc
  `
  return rows.map((row) => ({
    ...row,
    description: row.description ?? "",
    priceCents: Number(row.priceCents),
    minSubtotalCents: nullableCents(row.minSubtotalCents),
    maxSubtotalCents: nullableCents(row.maxSubtotalCents),
  }))
}

export async function resolveShippingRate(input: {
  shippingRateId: string
  country: string
  subtotalCents: number
}) {
  if (dataApiEnabled()) {
    const rates = await listActiveShippingRates()
    return selectShippingRate(rates, input.subtotalCents, input.country, input.shippingRateId)
  }
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
  const id = randomUUID()
  const token = randomUUID()
  if (dataApiEnabled()) {
    const next = await supabaseRpc<number>("next_order_number")
    if (next?.data == null) throw new Error("Could not allocate an order number")
    const number = `NP-${next.data}`
    const created = await supabaseMutate<Array<{ id: string }>>("orders", "POST", {
      id,
      number,
      public_token: token,
      email: input.email,
      status: "pending",
      payment_status: "unpaid",
      fulfillment_status: "unfulfilled",
      cart_id: input.cartId,
      subtotal_cents: quote.subtotal,
      shipping_cents: quote.shipping,
      tax_cents: quote.tax,
      total_cents: quote.total,
      currency: settings.currency,
      shipping_name: rate.name,
      shipping_address: input.address,
    })
    if (!created?.data[0]) throw new Error("Could not create the order")
    const items = input.lines.map((line) => ({
      id: randomUUID(),
      order_id: id,
      variant_id: line.variantId,
      product_title: line.productTitle,
      variant_title: line.variantTitle,
      sku: line.sku,
      quantity: line.quantity,
      unit_price_cents: line.unitPriceCents,
    }))
    const inserted = await supabaseMutate("order_items", "POST", items)
    if (!inserted) throw new Error("Could not save the order items")
    return { id, number, token, quote, shippingName: rate.name, currency: settings.currency }
  }
  const sql = getSql()
  const numbers = await sql<{ next: number }[]>`select nextval('order_number_seq')::int as next`
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
  if (dataApiEnabled()) {
    await supabaseMutate(`orders?id=eq.${orderId}`, "PATCH", { stripe_session_id: sessionId, updated_at: new Date().toISOString() })
    return
  }
  const sql = getSql()
  await sql`update orders set stripe_session_id = ${sessionId}, updated_at = now() where id = ${orderId}`
}

export async function cancelUnpaidOrder(orderId: string) {
  if (dataApiEnabled()) {
    await supabaseMutate(`orders?id=eq.${orderId}&payment_status=eq.unpaid`, "PATCH", {
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    return
  }
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

// A refunded order must not be marked paid again by a replayed checkout event.
const claimable = ["unpaid", "failed"]

export async function fulfillPaidOrder(orderId: string, session: Stripe.Checkout.Session) {
  if (dataApiEnabled()) {
    const result = await supabaseRest<Array<{
      id: string
      number: string
      public_token: string
      email: string
      status: string
      payment_status: string
      fulfillment_status: string
      total_cents: number
      currency: string
      shipping_name: string
      shipping_address: Address
      cart_id: string | null
    }>>(`orders?id=eq.${orderId}&select=id,number,public_token,email,status,payment_status,fulfillment_status,total_cents,currency,shipping_name,shipping_address,cart_id`)
    const order = result?.data[0]
    if (!order) throw new Error("Order not found")
    if (session.metadata?.orderId !== order.id) throw new Error("Payment does not match this order")
    if (session.currency && session.currency.toLowerCase() !== order.currency.toLowerCase()) {
      throw new Error("Payment currency does not match the order")
    }
    if (session.amount_total !== Number(order.total_cents)) {
      throw new Error("Payment amount does not match the order")
    }
    if (session.payment_status !== "paid") return { already: false, paid: false }
    if (!claimable.includes(order.payment_status)) return { already: true, paid: true }
    const paymentIntent = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null
    // The webhook and the return page can confirm the same order at once.
    // Only the request that flips payment_status adjusts stock and sends email.
    const claimed = await supabaseMutate<Array<{ id: string }>>(`orders?id=eq.${order.id}&payment_status=in.(${claimable.join(",")})`, "PATCH", {
      payment_status: "paid",
      status: "paid",
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (!claimed) throw new Error("Could not record the payment")
    if (claimed.data.length === 0) return { already: true, paid: true }
    const itemRows = await supabaseRest<Array<{
      quantity: number
      product_title: string
      variant_title: string
      unit_price_cents: number
    }>>(`order_items?order_id=eq.${order.id}&select=quantity,product_title,variant_title,unit_price_cents`)
    const items = itemRows?.data ?? []
    if (order.cart_id) {
      await supabaseMutate(`cart_items?cart_id=eq.${order.cart_id}`, "DELETE")
    }
    const emailStatus = await sendOrderEmail({
      number: order.number,
      publicToken: order.public_token,
      email: order.email,
      totalCents: Number(order.total_cents),
      currency: order.currency,
      shippingName: order.shipping_name,
      shippingAddress: order.shipping_address,
      items: items.map((item) => ({
        productTitle: item.product_title,
        variantTitle: item.variant_title,
        quantity: Number(item.quantity),
        unitPriceCents: Number(item.unit_price_cents),
      })),
    })
    await supabaseMutate(`orders?id=eq.${order.id}`, "PATCH", { email_status: emailStatus })
    return { already: false, paid: true }
  }
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
  if (!claimable.includes(order.paymentStatus)) return { already: true, paid: true }

  const items = await sql<Array<{
    quantity: number
    productTitle: string
    variantTitle: string
    unitPriceCents: number
  }>>`
    select quantity, product_title as "productTitle",
      variant_title as "variantTitle", unit_price_cents as "unitPriceCents"
    from order_items where order_id = ${order.id}
  `
  const paymentIntent = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null
  const claimed = await sql.begin(async (tx) => {
    const updated = await tx`
      update orders
      set payment_status = 'paid',
          status = 'paid',
          stripe_session_id = ${session.id},
          stripe_payment_intent_id = ${paymentIntent},
          paid_at = now(),
          updated_at = now()
      where id = ${order.id} and payment_status in ${tx(claimable)}
      returning id
    `
    if (updated.length === 0) return false
    if (order.cartId) {
      await tx`delete from cart_items where cart_id = ${order.cartId}`
    }
    return true
  })
  if (!claimed) return { already: true, paid: true }

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
  if (dataApiEnabled()) {
    await supabaseMutate(`orders?id=eq.${orderId}&payment_status=eq.unpaid`, "PATCH", {
      payment_status: "failed",
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    return
  }
  const sql = getSql()
  await sql`
    update orders
    set payment_status = 'failed', status = 'cancelled', updated_at = now()
    where id = ${orderId} and payment_status = 'unpaid'
  `
}

export async function recordRefund(charge: Stripe.Charge) {
  const paymentIntent = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id
  const refunded = charge.amount_refunded
  if (!paymentIntent || refunded <= 0) return
  const paymentStatus = charge.refunded ? "refunded" : "partially_refunded"
  // Events can arrive out of order; amount_refunded only grows, so never lower it.
  if (dataApiEnabled()) {
    const result = await supabaseMutate(
      `orders?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntent)}&refunded_cents=lte.${refunded}`,
      "PATCH",
      {
        payment_status: paymentStatus,
        refunded_cents: refunded,
        ...(charge.refunded ? { status: "refunded" } : {}),
        updated_at: new Date().toISOString(),
      },
    )
    if (!result) throw new Error("Could not record the refund")
    return
  }
  const sql = getSql()
  await sql`
    update orders
    set payment_status = ${paymentStatus},
        refunded_cents = ${refunded},
        status = case when ${charge.refunded} then 'refunded' else status end,
        updated_at = now()
    where stripe_payment_intent_id = ${paymentIntent} and refunded_cents <= ${refunded}
  `
}

export type PublicOrder = {
  id: string
  number: string
  email: string
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  totalCents: number
  currency: string
  shippingName: string
  shippingAddress: Address
  trackingCarrier: string
  trackingNumber: string
  inventoryWarning: boolean
}

export async function getOrderByPublicToken(token: string) {
  if (dataApiEnabled()) {
    const result = await supabaseRest<Array<{
      id: string
      number: string
      email: string
      status: string
      payment_status: string
      fulfillment_status: string
      total_cents: number
      currency: string
      shipping_name: string
      shipping_address: Address
      tracking_carrier: string | null
      tracking_number: string | null
      inventory_warning: boolean
    }>>(`orders?public_token=eq.${encodeURIComponent(token)}&select=id,number,email,status,payment_status,fulfillment_status,total_cents,currency,shipping_name,shipping_address,tracking_carrier,tracking_number,inventory_warning`)
    const row = result?.data[0]
    if (!row) return null
    return {
      id: row.id,
      number: row.number,
      email: row.email,
      status: row.status,
      paymentStatus: row.payment_status,
      fulfillmentStatus: row.fulfillment_status,
      totalCents: Number(row.total_cents),
      currency: row.currency,
      shippingName: row.shipping_name,
      shippingAddress: row.shipping_address,
      trackingCarrier: row.tracking_carrier ?? "",
      trackingNumber: row.tracking_number ?? "",
      inventoryWarning: Boolean(row.inventory_warning),
    } satisfies PublicOrder
  }
  const sql = getSql()
  const rows = await sql<PublicOrder[]>`
    select id, number, email, status, payment_status as "paymentStatus", fulfillment_status as "fulfillmentStatus",
      total_cents as "totalCents", currency, shipping_name as "shippingName", shipping_address as "shippingAddress",
      tracking_carrier as "trackingCarrier", tracking_number as "trackingNumber", inventory_warning as "inventoryWarning"
    from orders where public_token = ${token}
  `
  const order = rows[0]
  if (!order) return null
  return {
    ...order,
    totalCents: Number(order.totalCents),
    inventoryWarning: Boolean(order.inventoryWarning),
  }
}

export async function getOrderItems(orderId: string) {
  if (dataApiEnabled()) {
    const result = await supabaseRest<Array<{
      product_title: string
      variant_title: string
      quantity: number
      unit_price_cents: number
    }>>(`order_items?order_id=eq.${orderId}&select=product_title,variant_title,quantity,unit_price_cents`)
    return (result?.data ?? []).map((item) => ({
      productTitle: item.product_title,
      variantTitle: item.variant_title,
      quantity: Number(item.quantity),
      unitPriceCents: Number(item.unit_price_cents),
    }))
  }
  const sql = getSql()
  return sql<Array<{ productTitle: string, variantTitle: string, quantity: number, unitPriceCents: number }>>`
    select product_title as "productTitle", variant_title as "variantTitle", quantity, unit_price_cents as "unitPriceCents"
    from order_items where order_id = ${orderId}
  `
}

export async function findOrderToken(email: string, number: string) {
  if (dataApiEnabled()) {
    const result = await supabaseRest<Array<{ public_token: string }>>(
      `orders?email=eq.${encodeURIComponent(email)}&number=eq.${encodeURIComponent(number)}&select=public_token`,
    )
    return result?.data[0]?.public_token ?? null
  }
  const sql = getSql()
  const rows = await sql<{ token: string }[]>`
    select public_token as token from orders
    where lower(email) = ${email} and upper(number) = ${number}
    limit 1
  `
  return rows[0]?.token ?? null
}
