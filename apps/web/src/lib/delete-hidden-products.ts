import { getSql } from "@/db/client"
import { deleteObject } from "@/lib/storage"

// Hidden means any status other than active. Products on an order are archived instead of
// deleted so the order keeps its link to them.
export async function deleteHiddenProducts() {
  const sql = getSql()
  const onOrder = sql`exists (select 1 from order_items oi join variants v on v.id = oi.variant_id where v.product_id = p.id)`
  const { deleted, kept, paths } = await sql.begin(async (tx) => {
    const kept = await tx`
      update products p set status = 'archived', updated_at = now()
      where p.status <> 'active' and ${onOrder}
      returning p.id
    `
    const removed = await tx<Array<{ id: string }>>`
      select p.id from products p where p.status <> 'active' and not ${onOrder} for update
    `
    const ids = removed.map((row) => row.id)
    if (!ids.length) return { deleted: 0, kept: kept.length, paths: [] as string[] }
    const files = await tx<Array<{ path: string }>>`
      select storage_path as path from product_images where product_id in ${tx(ids)} and storage_path is not null
      union
      select storage_path from product_print_files where product_id in ${tx(ids)}
    `
    await tx`delete from products where id in ${tx(ids)}`
    return { deleted: ids.length, kept: kept.length, paths: files.map((row) => row.path) }
  })

  const [refs] = await sql<Array<{ text: string | null }>>`
    select concat_ws(' ',
      (select string_agg(storage_path, ' ') from product_images),
      (select string_agg(storage_path, ' ') from product_print_files),
      (select string_agg(concat_ws(' ', image_path, image_url), ' ') from collections),
      (select string_agg(concat_ws(' ', banner_path, banner_url, theme::text), ' ') from store_settings)
    ) as text
  `
  const unused = paths.filter((path) => !(refs.text ?? "").includes(path))
  let failedFiles = 0
  for (let index = 0; index < unused.length; index += 20) {
    await Promise.all(unused.slice(index, index + 20).map((path) => deleteObject(path).catch(() => {
      failedFiles += 1
    })))
  }
  return { deleted, kept, files: unused.length - failedFiles, failedFiles }
}
