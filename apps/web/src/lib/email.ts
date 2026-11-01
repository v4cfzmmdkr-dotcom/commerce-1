import { formatMoney } from "@/lib/money"
import { siteUrl } from "@/lib/site"
import { trackingUrl } from "@/lib/tracking"
import type { Address } from "@/lib/types"

type EmailItem = { productTitle: string, variantTitle: string, quantity: number, unitPriceCents: number }

type EmailOrder = {
  number: string
  publicToken: string
  email: string
  totalCents: number
  currency: string
  shippingName: string
  shippingAddress: Address
  items: EmailItem[]
}

type ShippingEmailOrder = {
  number: string
  publicToken: string
  email: string
  shippingAddress: Address
  trackingCarrier: string
  trackingNumber: string
  items: EmailItem[]
}

export type EmailStatus = "sent" | "failed" | "not_configured"

async function sendEmail(to: string, subject: string, html: string): Promise<EmailStatus> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ORDERS_FROM_EMAIL
  if (!apiKey || !from) return "not_configured"
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })
  if (!response.ok) {
    const detail = await response.text()
    console.error(`Resend ${response.status}: ${detail.slice(0, 240)}`)
    return "failed"
  }
  return "sent"
}

function itemName(item: EmailItem) {
  return escapeHtml(item.variantTitle ? `${item.productTitle} (${item.variantTitle})` : item.productTitle)
}

function addressHtml(address: Address) {
  return [
    address.name,
    address.line1,
    address.line2,
    `${address.city} ${address.state} ${address.postcode}`,
    address.country,
  ].filter(Boolean).map(escapeHtml).join("<br>")
}

export async function sendOrderEmail(order: EmailOrder) {
  const link = `${siteUrl()}/orders/${order.publicToken}`
  const lines = order.items
    .map((item) => `<li>${item.quantity} × ${itemName(item)} — ${formatMoney(item.unitPriceCents * item.quantity, order.currency)}</li>`)
    .join("")
  return sendEmail(
    order.email,
    `Order ${order.number} confirmed`,
    `<p>Thanks for your order. We have received payment for <strong>${escapeHtml(order.number)}</strong>.</p>
      <p>Total: ${formatMoney(order.totalCents, order.currency)}</p>
      <p>Delivery: ${escapeHtml(order.shippingName)}</p>
      <p>${addressHtml(order.shippingAddress)}</p>
      <ul>${lines}</ul>
      <p><a href="${link}">View order status</a></p>`,
  )
}

export async function sendShippingEmail(order: ShippingEmailOrder) {
  const link = `${siteUrl()}/orders/${order.publicToken}`
  const track = trackingUrl(order.trackingCarrier, order.trackingNumber)
  const carrier = order.trackingCarrier ? ` with ${escapeHtml(order.trackingCarrier)}` : ""
  const number = escapeHtml(order.trackingNumber)
  const lines = order.items.map((item) => `<li>${item.quantity} × ${itemName(item)}</li>`).join("")
  return sendEmail(
    order.email,
    `Order ${order.number} is on the way`,
    `<p>Good news — your order <strong>${escapeHtml(order.number)}</strong> has been dispatched${carrier}.</p>
      <p>Tracking number: <strong>${number}</strong></p>
      ${track ? `<p><a href="${track}">Track your parcel</a></p>` : ""}
      <p>Shipping to:<br>${addressHtml(order.shippingAddress)}</p>
      <ul>${lines}</ul>
      <p><a href="${link}">View order status</a></p>`,
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
