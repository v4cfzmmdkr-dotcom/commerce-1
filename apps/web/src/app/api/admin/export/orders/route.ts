import { currentAdmin } from "@/lib/auth/current"
import { getSql } from "@/db/client"

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export async function GET() {
  const admin = await currentAdmin()
  if (!admin) return new Response("Unauthorized", { status: 401 })
  const rows = await getSql()<Array<Record<string, unknown>>>`
    select number, email, status, payment_status, fulfillment_status, total_cents, currency,
      shipping_name, tracking_carrier, tracking_number, created_at
    from orders
    order by created_at desc
  `
  const header = ["Number", "Email", "Status", "Payment", "Fulfilment", "Total", "Currency", "Shipping", "Carrier", "Tracking", "Created"]
  const lines = [header.join(",")]
  for (const row of rows) {
    lines.push([
      row.number, row.email, row.status, row.payment_status, row.fulfillment_status,
      (Number(row.total_cents) / 100).toFixed(2), row.currency, row.shipping_name,
      row.tracking_carrier, row.tracking_number, row.created_at,
    ].map(csvEscape).join(","))
  }
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=orders.csv",
    },
  })
}
