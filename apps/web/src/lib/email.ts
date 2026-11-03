import { formatMoney } from "@/lib/money"
import { siteUrl } from "@/lib/site"
import { social } from "@/lib/social"
import { invoiceDate } from "@/lib/tax-invoice"
import { trackingUrl } from "@/lib/tracking"
import type { Address } from "@/lib/types"

type EmailItem = { productTitle: string, variantTitle: string, quantity: number, unitPriceCents: number, imageUrl?: string | null }

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

const storeName = "Niche Parts Australia"
const storeTagline = "Australian made parts"

const color = {
  ink: "#1d1d1f",
  muted: "#6e6e73",
  border: "#e8e8ed",
  canvas: "#f5f5f7",
  panel: "#f5f5f7",
}

const font = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif"

async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<EmailStatus> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ORDERS_FROM_EMAIL
  if (!apiKey || !from) return "not_configured"
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], reply_to: social.email.address, subject, html, ...(text ? { text } : {}) }),
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

function countryName(code: string) {
  return code.toUpperCase() === "AU" ? "Australia" : code
}

function addressLines(address: Address) {
  return [
    address.name,
    address.line1,
    address.line2,
    `${address.city} ${address.state} ${address.postcode}`.trim(),
    countryName(address.country),
  ].filter(Boolean)
}

function addressHtml(address: Address) {
  return addressLines(address).map(escapeHtml).join("<br>")
}

function firstName(address: Address) {
  return address.name.trim().split(/\s+/)[0] ?? ""
}

function greeting(address: Address) {
  const first = firstName(address)
  return first ? `Hi ${escapeHtml(first)},` : "Hi there,"
}

function absolute(url: string) {
  return url.startsWith("/") ? `${siteUrl()}${url}` : url
}

type LayoutOptions = { title: string, preheader: string, body: string }

function layout({ title, preheader, body }: LayoutOptions) {
  const site = siteUrl()
  const host = new URL(site).host
  const link = `color:${color.ink};font-weight:600;text-decoration:underline;`
  const footerLink = "color:#ffffff;text-decoration:none;"
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${color.canvas};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${color.canvas};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;font-family:${font};color:${color.ink};">
<tr><td style="padding:24px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><a href="${site}"><img src="${site}/brand/logo.png" width="44" height="44" alt="${storeName}" style="display:block;border:0;border-radius:10px;"></a></td>
<td style="vertical-align:middle;padding-left:12px;">
<a href="${site}" style="color:${color.ink};text-decoration:none;font-size:17px;font-weight:600;letter-spacing:-0.01em;">${storeName}</a>
<div style="font-size:13px;color:${color.muted};">${storeTagline}</div>
</td>
</tr></table>
</td></tr>
<tr><td style="font-size:0;line-height:0;">
<img src="${site}/brand/email/banner.jpg" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
</td></tr>
<tr><td style="padding:36px 32px 8px;font-size:15px;line-height:1.55;">
${body}
</td></tr>
<tr><td style="padding:24px 32px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${color.panel};border-radius:14px;">
<tr><td style="padding:20px 24px;font-size:14px;line-height:1.7;">
<div style="font-size:15px;font-weight:600;margin-bottom:2px;">Need help with your order?</div>
<span style="color:${color.muted};">Our customer support team is happy to help.</span><br>
Email: <a href="${social.email.href}" style="${link}">${social.email.address}</a><br>
Phone: <a href="${social.phone.href}" style="${link}">${social.phone.number}</a>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="background:${color.ink};padding:28px 32px;color:#d1d1d6;font-size:13px;line-height:1.7;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td style="padding:0 6px;"><a href="${social.facebook.href}"><img src="${site}/brand/email/facebook.png" width="32" height="32" alt="${social.facebook.label}" style="display:block;border:0;"></a></td>
<td style="padding:0 6px;"><a href="${social.instagram.href}"><img src="${site}/brand/email/instagram.png" width="32" height="32" alt="${social.instagram.label}" style="display:block;border:0;"></a></td>
</tr></table>
<div style="margin-top:16px;color:#ffffff;font-weight:600;">${storeName}</div>
<div><a href="${social.email.href}" style="${footerLink}">${social.email.address}</a> &nbsp;&middot;&nbsp; <a href="${social.phone.href}" style="${footerLink}">${social.phone.number}</a></div>
<div><a href="${site}" style="${footerLink}">${escapeHtml(host)}</a></div>
<div style="margin-top:16px;font-size:12px;color:#8e8e93;">You are receiving this email because you placed an order with ${storeName}.</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function textLayout(lines: string[]) {
  const site = siteUrl()
  return [
    ...lines,
    "",
    "Need help with your order?",
    `Email: ${social.email.address}`,
    `Phone: ${social.phone.number}`,
    "",
    storeName,
    site,
  ].join("\n")
}

function heading(text: string) {
  return `<h1 style="margin:0 0 6px;font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${color.ink};">${text}</h1>`
}

function meta(text: string) {
  return `<p style="margin:0 0 24px;font-size:14px;color:${color.muted};">${text}</p>`
}

function paragraph(html: string) {
  return `<p style="margin:0 0 16px;">${html}</p>`
}

function sectionTitle(text: string) {
  return `<h2 style="margin:32px 0 10px;font-size:13px;font-weight:600;letter-spacing:0.02em;color:${color.muted};">${text}</h2>`
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px;"><tr>
<td style="background:${color.ink};border-radius:980px;"><a href="${href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:980px;">${label}</a></td>
</tr></table>`
}

function panel(html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${color.panel};border-radius:14px;">
<tr><td style="padding:18px 22px;font-size:14px;line-height:1.6;">${html}</td></tr>
</table>`
}

function rows(entries: Array<[string, string]>, total?: [string, string]) {
  const cell = `padding:8px 0;vertical-align:top;`
  const body = entries
    .map(([left, right]) => `<tr><td style="${cell}color:${color.muted};">${left}</td><td align="right" style="${cell}padding-left:16px;white-space:nowrap;">${right}</td></tr>`)
    .join("")
  const last = total
    ? `<tr><td style="padding:14px 0 0;border-top:1px solid ${color.border};font-size:17px;font-weight:700;">${total[0]}</td><td align="right" style="padding:14px 0 0 16px;border-top:1px solid ${color.border};font-size:17px;font-weight:700;white-space:nowrap;">${total[1]}</td></tr>`
    : ""
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}${last}</table>`
}

function itemRows(items: EmailItem[], price?: (item: EmailItem) => string) {
  const body = items.map((item, index) => {
    const border = index ? `border-top:1px solid ${color.border};` : ""
    const image = item.imageUrl
      ? `<img src="${escapeHtml(absolute(item.imageUrl))}" width="64" alt="" style="display:block;width:auto;max-width:64px;max-height:64px;border:0;margin:0 auto;">`
      : ""
    const detail = [item.variantTitle && item.variantTitle !== "Default Title" ? escapeHtml(item.variantTitle) : "", `Qty ${item.quantity}`].filter(Boolean).join(" &middot; ")
    return `<tr>
<td width="76" style="${border}padding:12px 12px 12px 0;vertical-align:middle;">
<table role="presentation" width="64" height="64" cellpadding="0" cellspacing="0" border="0" style="width:64px;height:64px;background:${color.panel};border-radius:12px;"><tr><td align="center" valign="middle" style="height:64px;overflow:hidden;border-radius:12px;">${image}</td></tr></table>
</td>
<td style="${border}padding:12px 0;vertical-align:middle;">
<div style="font-size:15px;font-weight:600;line-height:1.35;">${escapeHtml(item.productTitle)}</div>
<div style="font-size:13px;color:${color.muted};margin-top:2px;">${detail}</div>
</td>
${price ? `<td align="right" style="${border}padding:12px 0 12px 16px;vertical-align:middle;white-space:nowrap;font-size:15px;">${price(item)}</td>` : ""}
</tr>`
  }).join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>`
}

function itemText(item: EmailItem) {
  return `${item.quantity} × ${item.variantTitle && item.variantTitle !== "Default Title" ? `${item.productTitle} (${item.variantTitle})` : item.productTitle}`
}

type ReceiptOrder = EmailOrder & {
  shippingCents: number
  taxCents: number
  paidAt: string | Date | null
  sellerName: string
  abn: string
}

export async function sendOrderEmail(order: ReceiptOrder) {
  const link = `${siteUrl()}/orders/${order.publicToken}`
  const money = (cents: number) => formatMoney(cents, order.currency)
  const number = escapeHtml(order.number)
  const date = invoiceDate(order.paidAt)
  const subtotal = order.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
  const shipping = order.shippingCents > 0 ? money(order.shippingCents) : "Free"
  const lineTotal = (item: EmailItem) => money(item.unitPriceCents * item.quantity)
  const invoice = order.abn
    ? `${sectionTitle("Tax invoice")}
${panel(rows([
  ["Seller", escapeHtml(order.sellerName)],
  ["ABN", escapeHtml(order.abn)],
  ["Invoice number", number],
  ["Invoice date", date],
]))}`
    : ""
  const text = textLayout([
    firstName(order.shippingAddress) ? `Hi ${firstName(order.shippingAddress)},` : "Hi there,",
    "",
    `Thanks for your order. We have received payment for order ${order.number} (${date}).`,
    "We will email you again with tracking details as soon as it is on the way.",
    "",
    ...order.items.map((item) => `${itemText(item)}  ${lineTotal(item)}`),
    `Subtotal  ${money(subtotal)}`,
    `Shipping (${order.shippingName})  ${shipping}`,
    `GST included  ${money(order.taxCents)}`,
    `Total  ${money(order.totalCents)}`,
    ...(order.abn ? ["", `Tax invoice from ${order.sellerName}, ABN ${order.abn}`] : []),
    "",
    "Delivering to:",
    ...addressLines(order.shippingAddress),
    "",
    `View your order: ${link}`,
  ])
  return sendEmail(
    order.email,
    `Order ${order.number} confirmed`,
    layout({
      title: `Order ${order.number} confirmed`,
      preheader: `Thanks for your order. We have received payment for ${order.number}.`,
      body: `${heading("Thanks for your order")}
${meta(`Order ${number} &middot; ${date}`)}
${paragraph(greeting(order.shippingAddress))}
${paragraph("We have received your payment. We will email you again with tracking details as soon as your parts are on the way.")}
${button(link, "View order status")}
${sectionTitle("Order summary")}
${itemRows(order.items, lineTotal)}
<div style="height:8px;border-top:1px solid ${color.border};margin-top:4px;"></div>
${rows([
  ["Subtotal", money(subtotal)],
  [`Shipping (${escapeHtml(order.shippingName)})`, shipping],
  ["GST included", money(order.taxCents)],
], ["Total", money(order.totalCents)])}
${invoice}
${sectionTitle("Delivering to")}
${panel(addressHtml(order.shippingAddress))}`,
    }),
    text,
  )
}

export async function sendOrderAlert(to: string, order: EmailOrder & { id: string }) {
  const link = `${siteUrl()}/admin/orders/${order.id}`
  const lines = order.items
    .map((item) => `<li>${item.quantity} × ${itemName(item)} — ${formatMoney(item.unitPriceCents * item.quantity, order.currency)}</li>`)
    .join("")
  return sendEmail(
    to,
    `New order ${order.number} — ${formatMoney(order.totalCents, order.currency)}`,
    `<p>A new order has been paid: <strong>${escapeHtml(order.number)}</strong>.</p>
      <p>Customer: ${escapeHtml(order.email)}</p>
      <p>Total: ${formatMoney(order.totalCents, order.currency)}</p>
      <p>Delivery: ${escapeHtml(order.shippingName)}</p>
      <p>${addressHtml(order.shippingAddress)}${order.shippingAddress.phone ? `<br>${escapeHtml(order.shippingAddress.phone)}` : ""}</p>
      <ul>${lines}</ul>
      <p><a href="${link}">Open the order in admin</a></p>`,
  )
}

type RefundEmailOrder = {
  number: string
  publicToken: string
  email: string
  currency: string
  totalCents: number
  amountCents: number
  refundedCents: number
  full: boolean
}

export async function sendRefundEmail(order: RefundEmailOrder) {
  const link = `${siteUrl()}/orders/${order.publicToken}`
  const amount = formatMoney(order.amountCents, order.currency)
  const number = escapeHtml(order.number)
  const summary = order.full
    ? "Your order has now been fully refunded."
    : `Refunded so far: ${formatMoney(order.refundedCents, order.currency)} of ${formatMoney(order.totalCents, order.currency)}.`
  const timing = "Refunds usually appear on your statement within 5 to 10 business days, depending on your bank."
  return sendEmail(
    order.email,
    `Refund for order ${order.number}`,
    layout({
      title: `Refund for order ${order.number}`,
      preheader: `We have refunded ${amount} for order ${order.number}.`,
      body: `${heading("Your refund is on its way")}
${meta(`Order ${number}`)}
${paragraph(`We have refunded <strong>${amount}</strong> to your original payment method.`)}
${panel(rows([
  ["Refund amount", `<strong>${amount}</strong>`],
  ["Order number", number],
]))}
<div style="height:16px;"></div>
${paragraph(summary)}
${paragraph(`<span style="color:${color.muted};">${timing}</span>`)}
${button(link, "View order status")}`,
    }),
    textLayout([
      `We have refunded ${amount} for order ${order.number} to your original payment method.`,
      summary,
      timing,
      "",
      `View your order: ${link}`,
    ]),
  )
}

export async function sendShippingEmail(order: ShippingEmailOrder) {
  const link = `${siteUrl()}/orders/${order.publicToken}`
  const track = trackingUrl(order.trackingCarrier, order.trackingNumber)
  const carrier = order.trackingCarrier ? ` with ${escapeHtml(order.trackingCarrier)}` : ""
  const number = escapeHtml(order.trackingNumber)
  const tracking = panel(`<div style="font-size:13px;color:${color.muted};">Tracking number</div>
<div style="font-size:22px;font-weight:700;letter-spacing:0.02em;margin-top:2px;">${number}</div>
${order.trackingCarrier ? `<div style="font-size:14px;color:${color.muted};">${escapeHtml(order.trackingCarrier)}</div>` : ""}`)
  return sendEmail(
    order.email,
    `Order ${order.number} is on the way`,
    layout({
      title: `Order ${order.number} is on the way`,
      preheader: `Your order ${order.number} has been dispatched. Tracking number ${order.trackingNumber}.`,
      body: `${heading("Your order is on the way")}
${meta(`Order ${escapeHtml(order.number)}`)}
${paragraph(greeting(order.shippingAddress))}
${paragraph(`Good news, your order has been dispatched${carrier}.`)}
${tracking}
<div style="height:12px;"></div>
${track ? button(track, "Track your parcel") : button(link, "View order status")}
${track ? paragraph(`<a href="${link}" style="color:${color.ink};font-weight:600;">View order status</a>`) : ""}
${sectionTitle("In this parcel")}
${itemRows(order.items)}
${sectionTitle("Shipping to")}
${panel(addressHtml(order.shippingAddress))}`,
    }),
    textLayout([
      `Your order ${order.number} has been dispatched${order.trackingCarrier ? ` with ${order.trackingCarrier}` : ""}.`,
      `Tracking number: ${order.trackingNumber}`,
      ...(track ? [`Track your parcel: ${track}`] : []),
      "",
      "In this parcel:",
      ...order.items.map(itemText),
      "",
      "Shipping to:",
      ...addressLines(order.shippingAddress),
      "",
      `View your order: ${link}`,
    ]),
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
