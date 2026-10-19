import { notFound } from "next/navigation"
import { deleteImage, deleteProduct, saveProduct, uploadImages } from "@/app/admin/actions"
import { getSql } from "@/db/client"

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const sql = getSql()
  const products = await sql<Array<{
    id: string
    title: string
    handle: string
    descriptionHtml: string
    vendor: string
    productType: string
    tags: string[]
    status: string
    seoTitle: string
    seoDescription: string
    featured: boolean
  }>>`
    select id, title, handle, description_html as "descriptionHtml", vendor, product_type as "productType",
      tags, status, seo_title as "seoTitle", seo_description as "seoDescription", featured
    from products where id = ${id}
  `
  const product = products[0]
  if (!product) notFound()
  const variants = await sql<Array<{
    id: string
    sku: string
    option1Name: string
    option1Value: string
    option2Name: string
    option2Value: string
    priceCents: number
    compareAtCents: number | null
    inventoryQty: number
    inventoryPolicy: string
  }>>`
    select id, sku, option1_name as "option1Name", option1_value as "option1Value",
      option2_name as "option2Name", option2_value as "option2Value",
      price_cents as "priceCents", compare_at_cents as "compareAtCents",
      inventory_qty as "inventoryQty", inventory_policy as "inventoryPolicy"
    from variants where product_id = ${id}
    order by position asc
  `
  const images = await sql<Array<{ id: string, url: string, alt: string, position: number, storagePath: string | null }>>`
    select id, url, alt, position, storage_path as "storagePath"
    from product_images where product_id = ${id} order by position asc
  `
  const dollars = (cents: number | null) => (cents == null ? "" : (Number(cents) / 100).toFixed(2))
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-semibold">Edit product</h1>
      {query.saved ? <p className="text-sm">Saved.</p> : null}
      <form action={saveProduct} className="grid max-w-3xl gap-4">
        <input type="hidden" name="id" value={product.id} />
        <input type="hidden" name="variantIds" value={variants.map((variant) => variant.id).join(",")} />
        <label className="label">Title<input className="field normal-case" name="title" defaultValue={product.title} required /></label>
        <label className="label">Handle<input className="field normal-case" name="handle" defaultValue={product.handle} /></label>
        <label className="label">Status
          <select className="select normal-case" name="status" defaultValue={product.status}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm normal-case">
          <input type="checkbox" name="featured" defaultChecked={product.featured} /> Featured on the homepage
        </label>
        <label className="label">Description HTML<textarea className="field normal-case min-h-40" name="description" defaultValue={product.descriptionHtml} /></label>
        <label className="label">Vendor<input className="field normal-case" name="vendor" defaultValue={product.vendor} /></label>
        <label className="label">Type<input className="field normal-case" name="productType" defaultValue={product.productType} /></label>
        <label className="label">Tags<input className="field normal-case" name="tags" defaultValue={(product.tags || []).join(", ")} /></label>
        <label className="label">SEO title<input className="field normal-case" name="seoTitle" defaultValue={product.seoTitle} /></label>
        <label className="label">SEO description<textarea className="field normal-case" name="seoDescription" defaultValue={product.seoDescription} /></label>
        <h2 className="text-lg font-medium">Variants</h2>
        {variants.map((variant) => (
          <fieldset key={variant.id} className="grid gap-2 border border-[var(--border)] p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="field" name={`sku_${variant.id}`} defaultValue={variant.sku} placeholder="SKU" />
              <input className="field" name={`price_${variant.id}`} defaultValue={dollars(variant.priceCents)} placeholder="Price" required />
              <input className="field" name={`option1Name_${variant.id}`} defaultValue={variant.option1Name} placeholder="Option name" />
              <input className="field" name={`option1Value_${variant.id}`} defaultValue={variant.option1Value} placeholder="Option value" />
              <input className="field" name={`option2Name_${variant.id}`} defaultValue={variant.option2Name} placeholder="Second option name" />
              <input className="field" name={`option2Value_${variant.id}`} defaultValue={variant.option2Value} placeholder="Second option value" />
              <input className="field" name={`qty_${variant.id}`} defaultValue={variant.inventoryQty} placeholder="Quantity" />
              <input className="field" name={`compare_${variant.id}`} defaultValue={dollars(variant.compareAtCents)} placeholder="Compare-at price" />
            </div>
            <label className="label">When stock runs out
              <select className="select normal-case" name={`policy_${variant.id}`} defaultValue={variant.inventoryPolicy}>
                <option value="deny">Sold out</option>
                <option value="continue">Keep selling</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm normal-case">
              <input type="checkbox" name={`delete_${variant.id}`} /> Remove this variant
            </label>
          </fieldset>
        ))}
        <fieldset className="grid gap-2 border border-dashed border-[var(--border)] p-3">
          <legend className="text-sm">Add a variant</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field" name="newSku" placeholder="SKU" />
            <input className="field" name="newPrice" placeholder="Price to add a variant" />
            <input className="field" name="newOptionName" placeholder="Option name" />
            <input className="field" name="newOption" placeholder="Option value" />
            <input className="field" name="newQty" placeholder="Quantity" />
            <select className="select" name="newPolicy" defaultValue="deny">
              <option value="deny">Sold out at zero</option>
              <option value="continue">Keep selling</option>
            </select>
          </div>
        </fieldset>
        <button className="btn" type="submit">Save product</button>
      </form>
      <section className="grid gap-3">
        <h2 className="text-lg font-medium">Images</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <figure key={image.id}>
              <img src={image.url} alt={image.alt} className="aspect-square w-full object-cover" />
              <figcaption className="mt-1 text-xs">{image.storagePath ? "Stored" : "Remote"}</figcaption>
              <form action={deleteImage}>
                <input type="hidden" name="id" value={image.id} />
                <input type="hidden" name="productId" value={product.id} />
                <button className="text-sm" type="submit">Delete</button>
              </form>
            </figure>
          ))}
        </div>
        <form action={uploadImages} className="grid gap-2">
          <input type="hidden" name="id" value={product.id} />
          <input name="images" type="file" accept="image/*" multiple />
          <button className="btn w-fit" type="submit">Upload images</button>
        </form>
      </section>
      <form action={deleteProduct}>
        <input type="hidden" name="id" value={product.id} />
        <button className="btn-ghost" type="submit">Delete product</button>
      </form>
    </div>
  )
}
