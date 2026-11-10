import Link from "next/link"
import { createCollection } from "@/app/admin/actions"
import { getSql } from "@/db/client"

export default async function CollectionsPage() {
  const sql = getSql()
  const collections = await sql<Array<{ id: string, title: string, handle: string, published: boolean, imageUrl: string | null }>>`
    select id, title, handle, published, coalesce(cover_image_url, image_url) as "imageUrl"
    from collections order by position asc, title asc
  `
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold">Collections</h1>
      <form action={createCollection} className="flex gap-2">
        <input className="field max-w-sm" name="title" placeholder="New collection" required />
        <button className="btn" type="submit">Add</button>
      </form>
      <ul className="admin-list">
        {collections.map((collection) => (
          <li key={collection.id} className="flex items-center gap-3 py-2">
            {collection.imageUrl ? (
              <img src={collection.imageUrl} alt="" className="h-11 w-11 rounded-[var(--radius)] object-cover" />
            ) : (
              <span className="h-11 w-11 rounded-[var(--radius)] bg-[var(--muted)]" />
            )}
            <Link className="admin-row-link" href={`/admin/collections/${collection.id}`}>{collection.title}</Link>
            <span className="admin-note shrink-0 text-sm">{collection.published ? "Published" : "Hidden"}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
