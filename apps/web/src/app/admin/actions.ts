"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getSql } from "@/db/client"
import { requireAdmin } from "@/lib/auth/current"
import { cleanHtml } from "@/lib/html"
import { parseMoneyToCents } from "@/lib/money"
import { sendOrderEmail } from "@/lib/email"
import { deleteObject, extensionFor, saveObject } from "@/lib/storage"
import { importShopifyCsv, migrateRemoteImages, syncCollections } from "@/lib/shopify/import"
import { parseTheme } from "@/lib/theme"
import { slugify } from "@/lib/slug"
import type { Address } from "@/lib/types"

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim()
}

async function readImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null
  if (!file.type.startsWith("image/")) throw new Error("Upload a JPEG, PNG, WebP, or GIF")
  if (file.size > 12_000_000) throw new Error("Images must be under 12MB")
  const bytes = Buffer.from(await file.arrayBuffer())
  return { bytes, type: file.type }
}

async function readBanner(file: File) {
  const images = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  const videos = ["video/mp4", "video/webm"]
  const kind = images.includes(file.type) ? "image" as const : videos.includes(file.type) ? "video" as const : null
  if (!kind) throw new Error("Upload a JPEG, PNG, WebP, GIF, MP4, or WebM")
  const limit = kind === "video" ? 18_000_000 : 12_000_000
  if (file.size > limit) throw new Error(kind === "video" ? "Video must be under 18MB" : "Images must be under 12MB")
  const bytes = Buffer.from(await file.arrayBuffer())
  return { bytes, type: file.type, kind }
}

export async function saveTheme(formData: FormData) {
  await requireAdmin()
  const theme = parseTheme({
    background: text(formData, "background"),
    foreground: text(formData, "foreground"),
    muted: text(formData, "muted"),
    accent: text(formData, "accent"),
    accentForeground: text(formData, "accentForeground"),
    border: text(formData, "border"),
    font: text(formData, "font"),
    density: text(formData, "density"),
    radius: text(formData, "radius"),
  })
  const sql = getSql()
  const logo = await readImage(formData.get("logo"))
  let logoUrl: string | null = null
  if (logo) {
    const saved = await saveObject(`brand/logo.${extensionFor(logo.type)}`, logo.bytes, logo.type)
    logoUrl = saved.url
  }
  if (logoUrl) {
    await sql`update store_settings set theme = ${sql.json(theme)}, logo_url = ${logoUrl}, updated_at = now() where id = 'default'`
  } else {
    await sql`update store_settings set theme = ${sql.json(theme)}, updated_at = now() where id = 'default'`
  }
  revalidatePath("/", "layout")
  redirect("/admin/theme?saved=1")
}

export async function saveBanner(formData: FormData) {
  await requireAdmin()
  const sql = getSql()
  const rows = await sql<{ banner_path: string | null }[]>`
    select banner_path from store_settings where id = 'default'
  `
  const currentPath = rows[0]?.banner_path ?? null
  const upload = formData.get("banner")
  if (upload instanceof File && upload.size > 0) {
    const banner = await readBanner(upload)
    const saved = await saveObject(`brand/banner-${Date.now()}.${extensionFor(banner.type)}`, banner.bytes, banner.type)
    await sql`
      update store_settings set
        banner_url = ${saved.url},
        banner_path = ${saved.path},
        banner_kind = ${banner.kind},
        updated_at = now()
      where id = 'default'
    `
    if (currentPath && currentPath !== saved.path) await deleteObject(currentPath)
  } else if (formData.get("removeBanner") === "on") {
    await sql`
      update store_settings set
        banner_url = null,
        banner_path = null,
        banner_kind = '',
        updated_at = now()
      where id = 'default'
    `
    await deleteObject(currentPath)
  }
  revalidatePath("/", "layout")
  redirect("/admin/theme?saved=1")
}

export async function saveSettings(formData: FormData) {
  await requireAdmin()
  const gst = Number(text(formData, "gst"))
  if (!Number.isFinite(gst) || gst < 0 || gst > 50) throw new Error("GST percent must be between 0 and 50")
  const sql = getSql()
  await sql`
    update store_settings set
      name = ${text(formData, "name") || "Niche Parts"},
      tagline = ${text(formData, "tagline")},
      announcement = ${text(formData, "announcement")},
      support_email = ${text(formData, "supportEmail")},
      gst_rate_bps = ${Math.round(gst * 100)},
      prices_include_tax = ${formData.get("pricesIncludeTax") === "on"},
      about_html = ${cleanHtml(String(formData.get("aboutHtml") || ""))},
      shipping_html = ${cleanHtml(String(formData.get("shippingHtml") || ""))},
      updated_at = now()
    where id = 'default'
  `
  revalidatePath("/", "layout")
  redirect("/admin/settings?saved=1")
}

export async function createProduct(formData: FormData) {
  await requireAdmin()
  const title = text(formData, "title")
  const price = parseMoneyToCents(text(formData, "price"))
  if (!title) throw new Error("Title is required")
  if (typeof price !== "number") throw new Error("Enter a price like 18.00")
  const sql = getSql()
  const id = randomUUID()
  let handle = slugify(text(formData, "handle") || title)
  const clash = await sql`select id from products where handle = ${handle}`
  if (clash.length) handle = `${handle}-${id.slice(0, 4)}`
  await sql`
    insert into products (id, handle, title, status) values (${id}, ${handle}, ${title}, 'draft')
  `
  await sql`
    insert into variants (id, product_id, title, price_cents, inventory_qty, inventory_policy, position)
    values (${randomUUID()}, ${id}, '', ${price}, 0, 'deny', 0)
  `
  redirect(`/admin/products/${id}`)
}

export async function saveProduct(formData: FormData) {
  await requireAdmin()
  const id = text(formData, "id")
  const title = text(formData, "title")
  if (!title) throw new Error("Title is required")
  let handle = slugify(text(formData, "handle") || title)
  const sql = getSql()
  const clash = await sql<{ id: string }[]>`select id from products where handle = ${handle} and id <> ${id}`
  if (clash.length) handle = `${handle}-${id.slice(0, 4)}`
  const tags = text(formData, "tags").split(",").map((tag) => tag.trim()).filter(Boolean)
  await sql`
    update products set
      title = ${title},
      handle = ${handle},
      description_html = ${cleanHtml(String(formData.get("description") || ""))},
      vendor = ${text(formData, "vendor")},
      product_type = ${text(formData, "productType")},
      tags = ${tags},
      status = ${text(formData, "status") || "draft"},
      seo_title = ${text(formData, "seoTitle")},
      seo_description = ${text(formData, "seoDescription")},
      featured = ${formData.get("featured") === "on"},
      updated_at = now()
    where id = ${id}
  `
  const ids = text(formData, "variantIds").split(",").filter(Boolean)
  for (const [index, variantId] of ids.entries()) {
    if (formData.get(`delete_${variantId}`) === "on") {
      const used = await sql`select id from order_items where variant_id = ${variantId} limit 1`
      if (used.length) await sql`update variants set available = false where id = ${variantId}`
      else await sql`delete from variants where id = ${variantId} and product_id = ${id}`
      continue
    }
    const price = parseMoneyToCents(text(formData, `price_${variantId}`))
    if (typeof price !== "number") throw new Error("Each variant needs a price")
    const compare = parseMoneyToCents(text(formData, `compare_${variantId}`))
    await sql`
      update variants set
        sku = ${text(formData, `sku_${variantId}`)},
        option1_name = ${text(formData, `option1Name_${variantId}`)},
        option1_value = ${text(formData, `option1Value_${variantId}`)},
        option2_name = ${text(formData, `option2Name_${variantId}`)},
        option2_value = ${text(formData, `option2Value_${variantId}`)},
        title = ${[text(formData, `option1Value_${variantId}`), text(formData, `option2Value_${variantId}`)].filter((value) => value && value.toLowerCase() !== "default title").join(" / ")},
        price_cents = ${price},
        compare_at_cents = ${compare === "invalid" ? null : compare},
        inventory_qty = ${Number(text(formData, `qty_${variantId}`) || 0)},
        inventory_policy = ${text(formData, `policy_${variantId}`) === "continue" ? "continue" : "deny"},
        position = ${index},
        available = true
      where id = ${variantId} and product_id = ${id}
    `
  }
  const newPrice = parseMoneyToCents(text(formData, "newPrice"))
  if (typeof newPrice === "number") {
    const option = text(formData, "newOption")
    await sql`
      insert into variants (
        id, product_id, sku, title, option1_name, option1_value, price_cents, inventory_qty, inventory_policy, position
      ) values (
        ${randomUUID()}, ${id}, ${text(formData, "newSku")}, ${option},
        ${text(formData, "newOptionName") || "Option"}, ${option}, ${newPrice},
        ${Number(text(formData, "newQty") || 0)},
        ${text(formData, "newPolicy") === "continue" ? "continue" : "deny"},
        ${ids.length}
      )
    `
  }
  revalidatePath(`/products/${handle}`)
  redirect(`/admin/products/${id}?saved=1`)
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin()
  const id = text(formData, "id")
  const sql = getSql()
  const used = await sql`
    select oi.id from order_items oi
    join variants v on v.id = oi.variant_id
    where v.product_id = ${id}
    limit 1
  `
  if (used.length) {
    await sql`update products set status = 'archived', updated_at = now() where id = ${id}`
    redirect("/admin/products?notice=archived")
  }
  const images = await sql<{ storagePath: string | null }[]>`
    select storage_path as "storagePath" from product_images where product_id = ${id}
  `
  for (const image of images) await deleteObject(image.storagePath)
  await sql`delete from products where id = ${id}`
  redirect("/admin/products?notice=deleted")
}

export async function uploadImages(formData: FormData) {
  await requireAdmin()
  const id = text(formData, "id")
  const sql = getSql()
  const product = await sql<{ handle: string }[]>`select handle from products where id = ${id}`
  if (!product[0]) throw new Error("Product not found")
  const files = formData.getAll("images")
  const current = await sql<{ position: number }[]>`
    select coalesce(max(position), 0)::int as position from product_images where product_id = ${id}
  `
  let position = Number(current[0]?.position || 0)
  for (const entry of files) {
    const image = await readImage(entry)
    if (!image) continue
    position += 1
    const saved = await saveObject(
      `${product[0].handle}/${position}-${randomUUID().slice(0, 8)}.${extensionFor(image.type)}`,
      image.bytes,
      image.type,
    )
    await sql`
      insert into product_images (id, product_id, url, storage_path, alt, position)
      values (${randomUUID()}, ${id}, ${saved.url}, ${saved.path}, ${text(formData, "alt")}, ${position})
    `
  }
  revalidatePath("/", "layout")
  redirect(`/admin/products/${id}`)
}

export async function deleteImage(formData: FormData) {
  await requireAdmin()
  const id = text(formData, "id")
  const productId = text(formData, "productId")
  const sql = getSql()
  const rows = await sql<{ storagePath: string | null }[]>`
    select storage_path as "storagePath" from product_images where id = ${id}
  `
  await deleteObject(rows[0]?.storagePath ?? null)
  await sql`delete from product_images where id = ${id}`
  redirect(`/admin/products/${productId}`)
}

export async function createCollection(formData: FormData) {
  await requireAdmin()
  const title = text(formData, "title")
  if (!title) throw new Error("Title is required")
  const id = randomUUID()
  const sql = getSql()
  await sql`
    insert into collections (id, handle, title, published, show_on_home)
    values (${id}, ${slugify(title)}, ${title}, true, true)
  `
  redirect(`/admin/collections/${id}`)
}

export async function saveCollection(formData: FormData) {
  await requireAdmin()
  const id = text(formData, "id")
  const title = text(formData, "title")
  const sql = getSql()
  const current = await sql<{ image_path: string | null }[]>`
    select image_path from collections where id = ${id}
  `
  const previousPath = current[0]?.image_path ?? null
  const image = await readImage(formData.get("image"))
  await sql`
    update collections set
      title = ${title},
      handle = ${slugify(text(formData, "handle") || title)},
      description_html = ${cleanHtml(String(formData.get("description") || ""))},
      position = ${Number(text(formData, "position") || 0)},
      published = ${formData.get("published") === "on"},
      show_on_home = ${formData.get("showOnHome") === "on"},
      updated_at = now()
    where id = ${id}
  `
  if (image) {
    const saved = await saveObject(`collections/${id}-${Date.now()}.${extensionFor(image.type)}`, image.bytes, image.type)
    await sql`
      update collections set image_url = ${saved.url}, image_path = ${saved.path}, updated_at = now()
      where id = ${id}
    `
    if (previousPath && previousPath !== saved.path) await deleteObject(previousPath)
  } else if (formData.get("removeImage") === "on") {
    await sql`
      update collections set image_url = null, image_path = null, updated_at = now()
      where id = ${id}
    `
    await deleteObject(previousPath)
  }
  revalidatePath("/", "layout")
  redirect(`/admin/collections/${id}?saved=1`)
}

export async function deleteCollection(formData: FormData) {
  await requireAdmin()
  const id = text(formData, "id")
  const sql = getSql()
  const rows = await sql<{ image_path: string | null }[]>`select image_path from collections where id = ${id}`
  await deleteObject(rows[0]?.image_path ?? null)
  await sql`delete from collections where id = ${id}`
  redirect("/admin/collections")
}

export async function addToCollection(formData: FormData) {
  await requireAdmin()
  const sql = getSql()
  const product = await sql<{ id: string }[]>`select id from products where handle = ${text(formData, "handle")} or id = ${text(formData, "handle")}`
  if (!product[0]) redirect(`/admin/collections/${text(formData, "id")}?error=missing`)
  await sql`
    insert into collection_products (collection_id, product_id, position)
    values (${text(formData, "id")}, ${product[0].id}, 0)
    on conflict do nothing
  `
  redirect(`/admin/collections/${text(formData, "id")}`)
}

export async function removeFromCollection(formData: FormData) {
  await requireAdmin()
  const sql = getSql()
  await sql`
    delete from collection_products
    where collection_id = ${text(formData, "id")} and product_id = ${text(formData, "productId")}
  `
  redirect(`/admin/collections/${text(formData, "id")}`)
}

function optionalMoneyCents(formData: FormData, key: string) {
  const raw = text(formData, key)
  if (!raw) return null
  const cents = parseMoneyToCents(raw)
  if (typeof cents !== "number") throw new Error("Enter subtotal limits in dollars, such as 25.00, or leave them blank")
  return cents
}

export async function saveShipping(formData: FormData) {
  await requireAdmin()
  const price = parseMoneyToCents(text(formData, "price"))
  if (typeof price !== "number") throw new Error("Enter a shipping price, using 0 for free")
  const minSubtotal = optionalMoneyCents(formData, "minSubtotal")
  const maxSubtotal = optionalMoneyCents(formData, "maxSubtotal")
  if (minSubtotal != null && maxSubtotal != null && minSubtotal > maxSubtotal) {
    throw new Error("Minimum subtotal cannot be higher than the maximum")
  }
  const sql = getSql()
  const id = text(formData, "id") || randomUUID()
  const existing = await sql`select id from shipping_rates where id = ${id}`
  if (existing.length) {
    await sql`
      update shipping_rates set
        name = ${text(formData, "name")},
        description = ${text(formData, "description")},
        price_cents = ${price},
        countries = ${text(formData, "countries").toUpperCase()},
        active = ${formData.get("active") === "on"},
        position = ${Number(text(formData, "position") || 0)},
        min_subtotal_cents = ${minSubtotal},
        max_subtotal_cents = ${maxSubtotal}
      where id = ${id}
    `
  } else {
    await sql`
      insert into shipping_rates (
        id, name, description, price_cents, countries, active, position, min_subtotal_cents, max_subtotal_cents
      ) values (
        ${id}, ${text(formData, "name")}, ${text(formData, "description")}, ${price},
        ${text(formData, "countries").toUpperCase()}, ${formData.get("active") === "on"},
        ${Number(text(formData, "position") || 0)}, ${minSubtotal}, ${maxSubtotal}
      )
    `
  }
  redirect("/admin/shipping?saved=1")
}

export async function updateOrder(formData: FormData) {
  await requireAdmin()
  const status = text(formData, "fulfillment")
  const fulfillment = status === "shipped" || status === "delivered" || status === "unfulfilled" ? status : "unfulfilled"
  const orderStatus = fulfillment === "unfulfilled" ? "paid" : "fulfilled"
  const sql = getSql()
  await sql`
    update orders set
      fulfillment_status = ${fulfillment},
      status = case when payment_status = 'paid' then ${orderStatus} else status end,
      tracking_carrier = ${text(formData, "carrier")},
      tracking_number = ${text(formData, "tracking")},
      updated_at = now()
    where id = ${text(formData, "id")}
  `
  if (text(formData, "mark") === "cancelled") {
    await sql`update orders set status = 'cancelled', updated_at = now() where id = ${text(formData, "id")} and payment_status <> 'paid'`
  }
  if (text(formData, "mark") === "refunded") {
    await sql`update orders set status = 'refunded', payment_status = 'refunded', updated_at = now() where id = ${text(formData, "id")}`
  }
  redirect(`/admin/orders/${text(formData, "id")}?saved=1`)
}

export async function resendOrderEmail(formData: FormData) {
  await requireAdmin()
  const sql = getSql()
  const id = text(formData, "id")
  const rows = await sql<Array<{
    number: string
    publicToken: string
    email: string
    totalCents: number
    currency: string
    shippingName: string
    shippingAddress: Address
  }>>`
    select number, public_token as "publicToken", email, total_cents as "totalCents", currency,
      shipping_name as "shippingName", shipping_address as "shippingAddress"
    from orders where id = ${id}
  `
  const order = rows[0]
  if (!order) throw new Error("Order not found")
  const items = await sql<Array<{ productTitle: string, variantTitle: string, quantity: number, unitPriceCents: number }>>`
    select product_title as "productTitle", variant_title as "variantTitle", quantity, unit_price_cents as "unitPriceCents"
    from order_items where order_id = ${id}
  `
  const emailStatus = await sendOrderEmail({
    ...order,
    totalCents: Number(order.totalCents),
    items: items.map((item) => ({ ...item, quantity: Number(item.quantity), unitPriceCents: Number(item.unitPriceCents) })),
  })
  await sql`update orders set email_status = ${emailStatus} where id = ${id}`
  redirect(`/admin/orders/${id}?email=${emailStatus}`)
}

export async function setStockPolicy(formData: FormData) {
  await requireAdmin()
  const sql = getSql()
  if (text(formData, "mode") === "continue") {
    await sql`update variants set inventory_policy = 'continue' where inventory_qty <= 0 and available = true`
  } else {
    await sql`update variants set inventory_policy = 'deny' where inventory_qty <= 0`
  }
  revalidatePath("/", "layout")
  redirect("/admin?stock=1")
}

export async function runImport(formData: FormData) {
  await requireAdmin()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a Shopify product CSV")
  if (file.size > 20_000_000) throw new Error("CSV must be under 20MB")
  const imported = await importShopifyCsv(Buffer.from(await file.arrayBuffer()), file.name)
  let collectionNote = ""
  if (formData.get("collections") === "on") {
    try {
      const count = await syncCollections(text(formData, "storeUrl") || "https://nicheparts.com.au", false)
      collectionNote = `&collections=${count}`
    } catch (error) {
      collectionNote = `&collectionError=${encodeURIComponent(error instanceof Error ? error.message : "Collection sync failed")}`
    }
  }
  if (formData.get("images") === "on") {
    await migrateRemoteImages({ limit: 40, budgetMs: 20000 })
  }
  revalidatePath("/", "layout")
  redirect(`/admin/import?run=${imported.id}${collectionNote}`)
}

export async function downloadImageBatch() {
  await requireAdmin()
  await migrateRemoteImages({ limit: 40, budgetMs: 20000 })
  revalidatePath("/", "layout")
  redirect("/admin/import?images=1")
}
