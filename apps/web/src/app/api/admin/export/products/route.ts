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
    select p.handle, p.title, p.status, p.vendor, p.tags, v.sku, v.price_cents, v.compare_at_cents,
      v.cost_cents, v.inventory_qty, v.inventory_policy, v.option1_value, v.option2_value
    from products p
    left join variants v on v.product_id = p.id
    order by p.handle, v.position
  `
  const header = ["Handle", "Title", "Status", "Vendor", "Tags", "SKU", "Price", "Compare At", "Cost", "Qty", "Policy", "Option 1", "Option 2"]
  const lines = [header.join(",")]
  for (const row of rows) {
    const tags = Array.isArray(row.tags) ? row.tags.join("|") : ""
    lines.push([
      row.handle, row.title, row.status, row.vendor, tags, row.sku,
      row.price_cents == null ? "" : (Number(row.price_cents) / 100).toFixed(2),
      row.compare_at_cents == null ? "" : (Number(row.compare_at_cents) / 100).toFixed(2),
      row.cost_cents == null ? "" : (Number(row.cost_cents) / 100).toFixed(2),
      row.inventory_qty, row.inventory_policy, row.option1_value, row.option2_value,
    ].map(csvEscape).join(","))
  }
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=products.csv",
    },
  })
}
