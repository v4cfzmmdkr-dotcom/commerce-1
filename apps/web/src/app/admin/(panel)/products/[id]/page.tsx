import { notFound } from "next/navigation"
import { deleteImage, deleteProduct, saveProduct, uploadImages } from "@/app/admin/actions"
import { saveMaterials } from "@/app/admin/option-actions"
import { deletePrintFile, updatePrintFile } from "@/app/admin/print-file-actions"
import { PendingButton } from "@/components/pending-button"
import { PrintFileUpload } from "@/components/print-file-upload"
import { getSql, textArray } from "@/db/client"
import { formatFileSize } from "@/lib/print-file-rules"
import {
  defaultMaterial,
  materialColourLabel,
  materialColourRules,
  materialOptions,
  materialSlot,
  parseMaterials,
  shopMaterials,
  variantMaterial,
  variantOffered,
} from "@/lib/product-options"
import { getSettings } from "@/lib/settings"

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string, copied?: string, photos?: string, failed?: string, materials?: string, added?: string, materialError?: string }>
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
    chargeGst: boolean
    materials: string[]
  }>>`
    select id, title, handle, description_html as "descriptionHtml", vendor, product_type as "productType",
      tags, status, seo_title as "seoTitle", seo_description as "seoDescription", featured, materials,
      coalesce((select bool_and(taxable) from variants where product_id = products.id), true) as "chargeGst"
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
    option3Name: string
    option3Value: string
    priceCents: number
    compareAtCents: number | null
  }>>`
    select id, sku, option1_name as "option1Name", option1_value as "option1Value",
      option2_name as "option2Name", option2_value as "option2Value",
      option3_name as "option3Name", option3_value as "option3Value",
      price_cents as "priceCents", compare_at_cents as "compareAtCents"
    from variants where product_id = ${id}
    order by position asc
  `
  const images = await sql<Array<{ id: string, url: string, alt: string, position: number, storagePath: string | null }>>`
    select id, url, alt, position, storage_path as "storagePath"
    from product_images where product_id = ${id} order by position asc
  `
  const printFiles = await sql<Array<{ id: string, fileName: string, sizeBytes: number, copies: number, notes: string, variantId: string | null }>>`
    select id, file_name as "fileName", size_bytes::int as "sizeBytes", copies, notes, variant_id as "variantId"
    from product_print_files where product_id = ${id} order by position asc, created_at asc
  `
  const variantLabel = (variant: (typeof variants)[number]) =>
    [variant.option1Value, variant.option2Value, variant.option3Value].filter(Boolean).join(" / ") || variant.sku || "Default"
  const materials = parseMaterials(product.materials)
  const canChooseMaterial = materialSlot(variants) !== 0
  const settings = await getSettings()
  const colours = materialColourRules(settings.colours, settings.materials)
  const offeredMaterials = shopMaterials(product.materials, settings.materials)
  const markupFor = (name: string) => settings.materials.find((material) => material.name === name)
  const followsMarkup = (variant: (typeof variants)[number]) => {
    const material = variantMaterial(variant)
    return Boolean(material) && material.toLowerCase() !== defaultMaterial.toLowerCase()
  }
  const added = Number(query.added) || 0
  const dollars = (cents: number | null) => (cents == null ? "" : (Number(cents) / 100).toFixed(2))
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-semibold">Edit product</h1>
      {query.saved ? <p className="text-sm">Saved.</p> : null}
      {query.materials ? (
        <p className="text-sm" role="status">
          Materials saved{added ? `, and ${added} new ${added === 1 ? "variant was" : "variants were"} added` : ""}.
        </p>
      ) : null}
      {query.copied ? (
        <p className="admin-card max-w-3xl text-sm" role="status">
          Copied from {query.copied === "ebay" ? "eBay" : "Shopify"} with {query.photos ?? 0} {query.photos === "1" ? "photo" : "photos"}
          {Number(query.failed) > 0 ? ` (${query.failed} could not be copied)` : ""}. {product.status === "active" ? "It is listed on the shop. Check the price and description." : "Check the price and description, then tick Listed on the shop and save."}
        </p>
      ) : null}
      <form action={saveProduct} className="admin-card grid max-w-3xl gap-4">
        <input type="hidden" name="id" value={product.id} />
        <input type="hidden" name="variantIds" value={variants.map((variant) => variant.id).join(",")} />
        <label className="label">Title<input className="field normal-case" name="title" defaultValue={product.title} required /></label>
        <label className="label">Handle<input className="field normal-case" name="handle" defaultValue={product.handle} /></label>
        <label className="flex items-center gap-2 text-sm normal-case">
          <input type="checkbox" name="listed" defaultChecked={product.status === "active"} /> Listed on the shop
        </label>
        <label className="flex items-center gap-2 text-sm normal-case">
          <input type="checkbox" name="featured" defaultChecked={product.featured} /> Featured on the homepage
        </label>
        <label className="flex items-center gap-2 text-sm normal-case">
          <input type="checkbox" name="chargeGst" defaultChecked={product.chargeGst} /> Charge GST
        </label>
        <label className="label">Description HTML<textarea className="field normal-case min-h-40" name="description" defaultValue={product.descriptionHtml} /></label>
        <label className="label">Vendor<input className="field normal-case" name="vendor" defaultValue={product.vendor} /></label>
        <label className="label">Type<input className="field normal-case" name="productType" defaultValue={product.productType} /></label>
        <label className="label">Tags<input className="field normal-case" name="tags" defaultValue={textArray(product.tags).join(", ")} /></label>
        <label className="label">SEO title<input className="field normal-case" name="seoTitle" defaultValue={product.seoTitle} /></label>
        <label className="label">SEO description<textarea className="field normal-case" name="seoDescription" defaultValue={product.seoDescription} /></label>
        <h2 className="text-lg font-medium">Variants</h2>
        {variants.map((variant) => (
          <fieldset key={variant.id} className="admin-inset grid gap-2">
            {variantOffered(variant, colours, offeredMaterials) ? null : (
              <p className="admin-note text-sm">Hidden from customers: its colour or material is switched off.</p>
            )}
            {followsMarkup(variant) ? (
              <p className="admin-note text-sm">Price is the PETG price plus the {variantMaterial(variant)} markup set on the Products page.</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="field" name={`sku_${variant.id}`} defaultValue={variant.sku} placeholder="SKU" />
              <input className="field" name={`price_${variant.id}`} defaultValue={dollars(variant.priceCents)} placeholder="Price" required readOnly={followsMarkup(variant)} />
              <input className="field" name={`option1Name_${variant.id}`} defaultValue={variant.option1Name} placeholder="Option name" />
              <input className="field" name={`option1Value_${variant.id}`} defaultValue={variant.option1Value} placeholder="Option value" />
              <input className="field" name={`option2Name_${variant.id}`} defaultValue={variant.option2Name} placeholder="Second option name" />
              <input className="field" name={`option2Value_${variant.id}`} defaultValue={variant.option2Value} placeholder="Second option value" />
              <input className="field" name={`option3Name_${variant.id}`} defaultValue={variant.option3Name} placeholder="Third option name" />
              <input className="field" name={`option3Value_${variant.id}`} defaultValue={variant.option3Value} placeholder="Third option value" />
              <input className="field" name={`compare_${variant.id}`} defaultValue={dollars(variant.compareAtCents)} placeholder="Compare-at price" />
            </div>
            <label className="flex items-center gap-2 text-sm normal-case">
              <input type="checkbox" name={`delete_${variant.id}`} /> Remove this variant
            </label>
          </fieldset>
        ))}
        <fieldset className="admin-inset grid gap-2">
          <legend className="text-sm">Add a variant</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field" name="newSku" placeholder="SKU" />
            <input className="field" name="newPrice" placeholder="Price to add a variant" />
            <input className="field" name="newOptionName" placeholder="Option name" />
            <input className="field" name="newOption" placeholder="Option value" />
          </div>
        </fieldset>
        <button className="btn" type="submit">Save product</button>
      </form>
      <form action={saveMaterials} className="admin-card grid max-w-3xl gap-4">
        <input type="hidden" name="id" value={product.id} />
        <div>
          <h2 className="text-lg font-medium">Material</h2>
          <p className="admin-note mt-1 text-sm">
            Customers choose from the materials ticked here before adding to cart. Colours are chosen for every product on the Products page.
          </p>
        </div>
        <div className="colour-chips">
          {materialOptions.map((material) => (
            <label key={material.name} className="colour-chip material-chip" data-off={markupFor(material.name)?.enabled === false || undefined}>
              <input type="checkbox" name="materials" value={material.name} defaultChecked={materials.includes(material.name)} disabled={!canChooseMaterial} />
              <span className="font-medium">{material.name}</span>
              <span className="admin-note text-xs">
                {markupFor(material.name)?.enabled === false
                  ? "Switched off for the whole shop"
                  : materialColourLabel(material.name === defaultMaterial ? null : colours[material.name])}
              </span>
            </label>
          ))}
        </div>
        <p className="admin-note text-sm">
          {materialOptions.filter((material) => material.name !== defaultMaterial).map((material) => `${material.name} costs the PETG price plus $${dollars(markupFor(material.name)?.markupCents ?? 0)}.`).join(" ")} Change the markup or switch a material off for every product on the Products page.
        </p>
        {query.materialError ? <p className="text-sm" role="alert">Tick at least one material.</p> : null}
        {canChooseMaterial ? (
          <PendingButton pendingText="Saving…">Save materials</PendingButton>
        ) : (
          <p className="text-sm">This product already uses three options, so a material choice can&apos;t be added. Remove an option to offer materials other than PETG.</p>
        )}
      </form>
      <section className="admin-card grid max-w-3xl gap-3">
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
      <section className="admin-card grid max-w-3xl gap-4">
        <div>
          <h2 className="text-lg font-medium">3D print files</h2>
          <p className="admin-note mt-1 text-sm">Kept private. These are the parts printed for each one sold.</p>
        </div>
        {printFiles.length ? (
          <ul className="grid gap-3">
            {printFiles.map((file) => (
              <li key={file.id} className="admin-inset grid gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <a className="min-w-0 truncate font-medium" href={`/api/admin/print-files/${file.id}`}>{file.fileName}</a>
                  <span className="admin-note shrink-0 text-sm">{formatFileSize(file.sizeBytes)}</span>
                </div>
                <form action={updatePrintFile} className="grid gap-2 sm:grid-cols-[1fr_6rem]">
                  <input type="hidden" name="id" value={file.id} />
                  <input type="hidden" name="productId" value={product.id} />
                  <label className="label">
                    Prints for
                    <select className="select normal-case" name="variantId" defaultValue={file.variantId ?? ""}>
                      <option value="">Every variant</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>{variantLabel(variant)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="label">
                    Copies
                    <input className="field" name="copies" type="number" min={1} max={100} defaultValue={file.copies} />
                  </label>
                  <label className="label sm:col-span-2">
                    Print notes
                    <input className="field normal-case" name="notes" defaultValue={file.notes} placeholder="Filament, layer height, supports" />
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button className="btn-ghost" type="submit">Save</button>
                    <button className="btn-ghost" type="submit" formAction={deletePrintFile}>Delete</button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <PrintFileUpload productId={product.id} />
      </section>
      <form action={deleteProduct}>
        <input type="hidden" name="id" value={product.id} />
        <button className="btn-ghost" type="submit">Delete product</button>
      </form>
    </div>
  )
}
