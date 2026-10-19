import { notFound } from "next/navigation"
import { addToCollection, deleteCollection, removeFromCollection, saveCollection } from "@/app/admin/actions"
import { getSql } from "@/db/client"

export default async function EditCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string, error?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const sql = getSql()
  const rows = await sql<Array<{
    id: string
    title: string
    handle: string
    descriptionHtml: string
    position: number
    published: boolean
    showOnHome: boolean
    imageUrl: string | null
  }>>`
    select id, title, handle, description_html as "descriptionHtml", position, published,
      show_on_home as "showOnHome", image_url as "imageUrl"
    from collections where id = ${id}
  `
  const collection = rows[0]
  if (!collection) notFound()
  const members = await sql<Array<{ id: string, title: string, handle: string }>>`
    select p.id, p.title, p.handle
    from collection_products cp
    join products p on p.id = cp.product_id
    where cp.collection_id = ${id}
    order by cp.position asc, p.title asc
  `
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-3xl font-semibold">Edit collection</h1>
      {query.saved ? <p className="text-sm">Saved.</p> : null}
      {query.error ? <p className="text-sm">No product matched that handle.</p> : null}
      <form action={saveCollection} className="grid gap-3">
        <input type="hidden" name="id" value={collection.id} />
        <label className="label">Title<input className="field normal-case" name="title" defaultValue={collection.title} /></label>
        <label className="label">Handle<input className="field normal-case" name="handle" defaultValue={collection.handle} /></label>
        <label className="label">Description HTML<textarea className="field normal-case" name="description" defaultValue={collection.descriptionHtml} /></label>
        <label className="label">Position<input className="field normal-case" name="position" defaultValue={collection.position} /></label>
        <label className="flex items-center gap-2 text-sm normal-case"><input type="checkbox" name="published" defaultChecked={collection.published} /> Published</label>
        <label className="flex items-center gap-2 text-sm normal-case"><input type="checkbox" name="showOnHome" defaultChecked={collection.showOnHome} /> Show on homepage</label>
        <div className="grid gap-3">
          <p className="text-sm font-semibold">Image</p>
          {collection.imageUrl ? (
            <img src={collection.imageUrl} alt={collection.title} className="h-40 w-40 rounded-[var(--radius)] object-cover" />
          ) : (
            <p className="text-sm">No image yet. The homepage shows a plain block until you add one.</p>
          )}
          <label className="label">
            Replace image
            <input className="normal-case" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </label>
          <p className="text-sm">JPEG, PNG, WebP, or GIF up to 12MB. Saving with a new file replaces the current image.</p>
          {collection.imageUrl ? (
            <label className="flex items-center gap-2 text-sm normal-case">
              <input type="checkbox" name="removeImage" />
              Remove the current image
            </label>
          ) : null}
        </div>
        <button className="btn w-fit" type="submit">Save collection</button>
      </form>
      <form action={addToCollection} className="flex gap-2">
        <input type="hidden" name="id" value={collection.id} />
        <input className="field" name="handle" placeholder="Product handle" />
        <button className="btn" type="submit">Add product</button>
      </form>
      <ul className="grid gap-2 text-sm">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3">
            <span>{member.title}</span>
            <form action={removeFromCollection}>
              <input type="hidden" name="id" value={collection.id} />
              <input type="hidden" name="productId" value={member.id} />
              <button type="submit">Remove</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={deleteCollection}>
        <input type="hidden" name="id" value={collection.id} />
        <button className="btn-ghost" type="submit">Delete collection</button>
      </form>
    </div>
  )
}
