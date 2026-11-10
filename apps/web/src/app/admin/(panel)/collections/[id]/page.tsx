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
    coverImageUrl: string | null
  }>>`
    select id, title, handle, description_html as "descriptionHtml", position, published,
      show_on_home as "showOnHome", image_url as "imageUrl", cover_image_url as "coverImageUrl"
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
  const photos = await sql<Array<{ url: string, productTitle: string }>>`
    select url, "productTitle" from (
      select distinct on (i.url) i.url, p.title as "productTitle", cp.position as "memberPosition", i.position as "imagePosition"
      from collection_products cp
      join products p on p.id = cp.product_id and p.status = 'active'
      join product_images i on i.product_id = p.id
      where cp.collection_id = ${id}
      order by i.url, cp.position asc, i.position asc
    ) photo
    order by "memberPosition" asc, "imagePosition" asc
  `
  const coverOptions = [
    ...(collection.imageUrl ? [{ url: collection.imageUrl, label: "Uploaded image" }] : []),
    ...photos.map((photo) => ({ url: photo.url, label: photo.productTitle })),
  ]
  const cover = collection.coverImageUrl ?? ""
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-3xl font-semibold">Edit collection</h1>
      {query.saved ? <p className="text-sm">Saved.</p> : null}
      {query.error ? <p className="text-sm">No product matched that handle.</p> : null}
      <form action={saveCollection} className="admin-card grid gap-3">
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
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">Homepage tile</legend>
          <p className="text-sm">Choose the photo shown on the homepage tile. Automatic uses the first product&apos;s photo, or the uploaded image for brand collections. Uploading a new image also selects it.</p>
          <div className="max-h-96 overflow-y-auto">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2 p-1">
              <label className="cursor-pointer" title="Automatic">
                <input className="peer sr-only" type="radio" name="cover" value="" defaultChecked={!cover} />
                <span className="flex aspect-square items-center justify-center rounded-[var(--radius)] border border-[var(--border)] p-2 text-center text-xs peer-checked:ring-2 peer-checked:ring-[var(--fg)] peer-focus-visible:outline peer-focus-visible:outline-2">Automatic</span>
              </label>
              {cover && !coverOptions.some((option) => option.url === cover) ? (
                <label className="cursor-pointer" title="Current choice">
                  <input className="peer sr-only" type="radio" name="cover" value={cover} defaultChecked />
                  <img src={cover} alt="Current choice" loading="lazy" className="aspect-square w-full rounded-[var(--radius)] object-cover peer-checked:ring-2 peer-checked:ring-[var(--fg)] peer-focus-visible:outline peer-focus-visible:outline-2" />
                </label>
              ) : null}
              {coverOptions.map((option) => (
                <label key={option.url} className="cursor-pointer" title={option.label}>
                  <input className="peer sr-only" type="radio" name="cover" value={option.url} defaultChecked={option.url === cover} />
                  <img src={option.url} alt={option.label} loading="lazy" className="aspect-square w-full rounded-[var(--radius)] object-cover peer-checked:ring-2 peer-checked:ring-[var(--fg)] peer-focus-visible:outline peer-focus-visible:outline-2" />
                </label>
              ))}
            </div>
          </div>
        </fieldset>
        <button className="btn w-fit" type="submit">Save collection</button>
      </form>
      <form action={addToCollection} className="flex gap-2">
        <input type="hidden" name="id" value={collection.id} />
        <input className="field" name="handle" placeholder="Product handle" />
        <button className="btn" type="submit">Add product</button>
      </form>
      <ul className="admin-list text-sm">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-4 py-2">
            <span>{member.title}</span>
            <form action={removeFromCollection}>
              <input type="hidden" name="id" value={collection.id} />
              <input type="hidden" name="productId" value={member.id} />
              <button className="btn-ghost" type="submit">Remove</button>
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
