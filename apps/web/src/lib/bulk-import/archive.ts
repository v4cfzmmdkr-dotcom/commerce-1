import { getSql } from "@/db/client"

// "Previous listings" are products the sourcing app did not create or take over: they have no
// product_sources record. Archiving hides them from the shop but keeps them, their orders and
// their links; the status they had is saved so restoring puts each one back exactly.

export async function previousListingSummary() {
  const [row] = await getSql()<Array<{ active: number, draft: number, archivedByTool: number, sourcedActive: number, sourcedDraft: number }>>`
    select
      count(*) filter (where s.product_id is null and p.status = 'active')::int as active,
      count(*) filter (where s.product_id is null and p.status = 'draft')::int as draft,
      count(*) filter (where p.status = 'archived' and p.metadata ? 'archivedPreviousStatus')::int as "archivedByTool",
      count(*) filter (where s.product_id is not null and p.status = 'active')::int as "sourcedActive",
      count(*) filter (where s.product_id is not null and p.status = 'draft')::int as "sourcedDraft"
    from products p
    left join (select distinct product_id from product_sources) s on s.product_id = p.id
  `
  return row
}

export async function archivePreviousListings() {
  const sql = getSql()
  const rows = await sql`
    update products p set
      status = 'archived',
      metadata = p.metadata || jsonb_build_object('archivedPreviousStatus', p.status, 'archivedAt', now()),
      updated_at = now()
    where p.status in ('active', 'draft')
      and not exists (select 1 from product_sources s where s.product_id = p.id)
    returning p.id
  `
  return rows.length
}

export async function restorePreviousListings() {
  const sql = getSql()
  const rows = await sql`
    update products set
      status = metadata->>'archivedPreviousStatus',
      metadata = metadata - 'archivedPreviousStatus' - 'archivedAt',
      updated_at = now()
    where status = 'archived' and metadata->>'archivedPreviousStatus' in ('active', 'draft')
    returning id
  `
  return rows.length
}
