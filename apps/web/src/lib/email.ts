import { formatMoney } from "@/lib/money"
import { siteUrl } from "@/lib/site"
import type { Address } from "@/lib/types"

type EmailOrder = {
  number: string
  publicToken: string
  email: string
  totalCents: number
  currency: string
  shippingName: string
  shippingAddress: Address
  items: Array<{ productTitle: string, variantTitle: string, quantity: number, unitPriceCents: number }>
}

export async function sendOrderEmail(order: EmailOrder) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ORDERS_FROM_EMAIL
  if (!apiKey || !from) return "not_configured"
  const link = `${siteUrl()}/orders/${order.publicToken}`
  const lines = order.items
    .map((item) => {
      const name = item.variantTitle ? `${item.productTitle} (${item.variantTitle})` : item.productTitle
      return `<li>${item.quantity} × ${escapeHtml(name)} — ${formatMoney(item.unitPriceCents * item.quantity, order.currency)}</li>`
    })
    .join("")
  const address = [
    order.shippingAddress.name,
    order.shippingAddress.line1,
    order.shippingAddress.line2,
    `${order.shippingAddress.city} ${order.shippingAddress.state} ${order.shippingAddress.postcode}`,
    order.shippingAddress.country,
  ].filter(Boolean).map(escapeHtml).join("<br>")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [order.email],
      subject: `Order ${order.number} confirmed`,
      html: `<p>Thanks for your order. We have received payment for <strong>${escapeHtml(order.number)}</strong>.</p>
        <p>Total: ${formatMoney(order.totalCents, order.currency)}</p>
        <p>Delivery: ${escapeHtml(order.shippingName)}</p>
        <p>${address}</p>
        <ul>${lines}</ul>
        <p><a href="${link}">View order status</a></p>`,
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    console.error(`Resend ${response.status}: ${detail.slice(0, 240)}`)
    return "failed"
  }
  return "sent"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
