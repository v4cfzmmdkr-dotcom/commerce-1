import { getSql } from "@/db/client"
import { siteUrl } from "@/lib/site"
import { dataApiEnabled, supabaseMutate, supabaseRest } from "@/lib/supabase-rest"
import type { Address } from "@/lib/types"

// Khayt imports web-store orders through its Medusa importer, so paid orders are sent in the
// shape Khayt's own Medusa subscriber posts: https://github.com/KhaytApp/Khayt/blob/main/lib/medusa-subscriber.js
export type KhaytStatus = "sent" | "not_configured" | "rejected" | "failed"

export type KhaytLine = {
  id: string
  productTitle: string
  variantTitle: string
  sku: string
  quantity: number
  unitPriceCents: number
  variant: {
    id: string
    sku: string
    option1Name: string
    option1Value: string
    option2Name: string
    option2Value: string
    option3Name: string
    option3Value: string
  } | null
}

export type KhaytOrder = {
  id: string
  number: string
  email: string
  currency: string
  paymentStatus: string
  shippingName: string
  shippingAddress: Partial<Address>
  items: KhaytLine[]
}

export function khaytImportUrl() {
  const value = (process.env.KHAYT_IMPORT_URL || "").trim()
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.hostname === "localhost" ? url.toString() : null
  } catch {
    return null
  }
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") }
}

function options(variant: NonNullable<KhaytLine["variant"]>) {
  return [
    [variant.option1Name, variant.option1Value],
    [variant.option2Name, variant.option2Value],
    [variant.option3Name, variant.option3Value],
  ]
    .filter(([, value]) => value && value !== "Default Title")
    .map(([title, value]) => ({ value, option: { title: title || "Option" } }))
}

export function khaytPayload(order: KhaytOrder, base: string) {
  const address = order.shippingAddress ?? {}
  const name = splitName(address.name || order.shippingName)
  const postal = {
    ...name,
    company: "",
    address_1: address.line1 ?? "",
    address_2: address.line2 ?? "",
    city: address.city ?? "",
    province: address.state ?? "",
    postal_code: address.postcode ?? "",
    country_code: (address.country || "AU").toLowerCase(),
    phone: address.phone ?? "",
  }
  const digits = order.number.replace(/\D/g, "")
  return {
    id: order.id,
    display_id: digits ? Number(digits) : null,
    custom_display_id: order.number,
    email: order.email,
    currency_code: order.currency.toLowerCase(),
    payment_status: order.paymentStatus === "paid" ? "captured" : order.paymentStatus,
    metadata: { admin_url: `${base}/admin/orders/${order.id}` },
    items: order.items.map((line) => ({
      id: line.id,
      title: line.productTitle,
      subtitle: line.variantTitle && line.variantTitle !== "Default Title" ? line.variantTitle : null,
      quantity: line.quantity,
      unit_price: line.unitPriceCents / 100,
      metadata: {},
      variant: line.variant
        ? { id: line.variant.id, title: line.variantTitle, sku: line.variant.sku || line.sku || null, options: options(line.variant) }
        : undefined,
    })),
    shipping_address: postal,
    billing_address: postal,
    customer: { email: order.email, first_name: name.first_name, last_name: name.last_name, phone: postal.phone },
  }
}

const variantColumns = "id,sku,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value"

type VariantRow = Record<"id" | "sku" | "option1_name" | "option1_value" | "option2_name" | "option2_value" | "option3_name" | "option3_value", string>

function variantOf(row: VariantRow | null): KhaytLine["variant"] {
  if (!row) return null
  return {
    id: row.id,
    sku: row.sku ?? "",
    option1Name: row.option1_name ?? "",
    option1Value: row.option1_value ?? "",
    option2Name: row.option2_name ?? "",
    option2Value: row.option2_value ?? "",
    option3Name: row.option3_name ?? "",
    option3Value: row.option3_value ?? "",
  }
}

async function loadOrder(orderId: string): Promise<KhaytOrder | null> {
  type Row = {
    id: string
    number: string
    email: string
    currency: string
    payment_status: string
    shipping_name: string
    shipping_address: Partial<Address> | string | null
  }
  type ItemRow = {
    id: string
    product_title: string
    variant_title: string
    sku: string
    quantity: number
    unit_price_cents: number
    variant: VariantRow | null
  }
  let order: Row | undefined
  let items: ItemRow[] = []
  if (dataApiEnabled()) {
    const result = await supabaseRest<Array<Row & { order_items: ItemRow[] }>>(
      `orders?id=eq.${encodeURIComponent(orderId)}&select=id,number,email,currency,payment_status,shipping_name,shipping_address,order_items(id,product_title,variant_title,sku,quantity,unit_price_cents,variant:variants(${variantColumns}))`,
    )
    order = result?.data[0]
    items = order ? (order as Row & { order_items: ItemRow[] }).order_items ?? [] : []
  } else {
    const sql = getSql()
    order = (await sql<Row[]>`
      select id, number, email, currency, payment_status, shipping_name, shipping_address from orders where id = ${orderId}
    `)[0]
    items = await sql<ItemRow[]>`
      select i.id, i.product_title, i.variant_title, i.sku, i.quantity, i.unit_price_cents,
        case when v.id is null then null else json_build_object(
          'id', v.id, 'sku', v.sku, 'option1_name', v.option1_name, 'option1_value', v.option1_value,
          'option2_name', v.option2_name, 'option2_value', v.option2_value, 'option3_name', v.option3_name, 'option3_value', v.option3_value
        ) end as variant
      from order_items i left join variants v on v.id = i.variant_id
      where i.order_id = ${orderId} order by i.id
    `
  }
  if (!order) return null
  const address = typeof order.shipping_address === "string" ? JSON.parse(order.shipping_address) : order.shipping_address
  return {
    id: order.id,
    number: order.number,
    email: order.email,
    currency: order.currency,
    paymentStatus: order.payment_status,
    shippingName: order.shipping_name,
    shippingAddress: address ?? {},
    items: items.map((item) => ({
      id: item.id,
      productTitle: item.product_title,
      variantTitle: item.variant_title ?? "",
      sku: item.sku ?? "",
      quantity: Number(item.quantity),
      unitPriceCents: Number(item.unit_price_cents),
      variant: variantOf(typeof item.variant === "string" ? JSON.parse(item.variant) : item.variant),
    })),
  }
}

async function recordStatus(orderId: string, status: KhaytStatus) {
  const sentAt = status === "sent" ? new Date().toISOString() : null
  if (dataApiEnabled()) {
    await supabaseMutate(`orders?id=eq.${encodeURIComponent(orderId)}`, "PATCH", {
      khayt_status: status,
      ...(sentAt ? { khayt_sent_at: sentAt } : {}),
    })
    return
  }
  const sql = getSql()
  await sql`
    update orders set khayt_status = ${status}, khayt_sent_at = coalesce(${sentAt}::timestamptz, khayt_sent_at)
    where id = ${orderId}
  `
}

// Never throws: a print queue that is down must not fail a payment confirmation.
// Khayt drops repeats of the same order number, so sending twice is harmless.
export async function sendOrderToKhayt(orderId: string): Promise<KhaytStatus> {
  const url = khaytImportUrl()
  if (!url) return "not_configured"
  let status: KhaytStatus = "failed"
  try {
    const order = await loadOrder(orderId)
    if (!order || !["paid", "partially_refunded"].includes(order.paymentStatus)) return "rejected"
    const key = (process.env.KHAYT_IMPORT_KEY || "").trim()
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { "X-Khayt-Import-Key": key } : {}) },
      body: JSON.stringify(khaytPayload(order, siteUrl())),
      signal: AbortSignal.timeout(8000),
    })
    if (response.ok) status = "sent"
    else {
      const detail = await response.text().catch(() => "")
      console.error(`Khayt import for ${order.number} returned ${response.status}: ${detail.slice(0, 300)}`)
      status = response.status === 401 || response.status === 429 || response.status >= 500 ? "failed" : "rejected"
    }
  } catch (error) {
    console.error(`Khayt import for order ${orderId} failed: ${error instanceof Error ? error.message : "unknown error"}`)
  }
  try {
    await recordStatus(orderId, status)
  } catch (error) {
    console.error(`Could not record Khayt status for order ${orderId}`, error)
  }
  return status
}
