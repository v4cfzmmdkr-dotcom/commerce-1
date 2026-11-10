import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { getDirectSql } from "@/db/client"
import { loadEnvFile } from "@/lib/env"
import { objectStorage } from "@/lib/object-storage"

const supabaseImageUrl = "https://[a-z0-9]+\\.supabase\\.co/storage/v1/object/public/product-images/"

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function publicBase() {
  const base = process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, "")
  if (!base) throw new Error("STORAGE_PUBLIC_URL is not set")
  return base
}

// The old Supabase bucket is public, so the database (rather than the storage
// API and its service key) supplies the list of images that are in use.
async function imagePaths() {
  const sql = getDirectSql()
  const pattern = `(?:${supabaseImageUrl}|${escapeRegex(publicBase())}/)([^"'\\s)?#]+)`
  try {
    const rows = await sql<{ path: string }[]>`
      select storage_path as path from product_images where storage_path is not null
      union select image_path from collections where image_path is not null
      union select banner_path from store_settings where banner_path is not null
      union select (regexp_matches(url, ${pattern}))[1] from product_images
      union select (regexp_matches(image_url, ${pattern}))[1] from collections
      union select (regexp_matches(description_html, ${pattern}, 'g'))[1] from products
      union select (regexp_matches(coalesce(logo_url, '') || ' ' || coalesce(banner_url, ''), ${pattern}, 'g'))[1] from store_settings
    `
    return rows.map((row) => decodeURIComponent(row.path))
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function alreadyCopied(path: string) {
  const head = await objectStorage().send(new HeadObjectCommand({ Bucket: process.env.STORAGE_BUCKET, Key: path })).catch(() => null)
  return Boolean(head?.ContentLength)
}

async function copy() {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "")
  if (!base) throw new Error("SUPABASE_URL is needed to download the old images")
  const paths = await imagePaths()
  console.log(`Found ${paths.length} images in the database`)
  let copied = 0
  let skipped = 0
  const failed: string[] = []
  let next = 0
  async function worker() {
    while (next < paths.length) {
      const path = paths[next++]
      try {
        if (await alreadyCopied(path)) {
          skipped += 1
          continue
        }
        const response = await fetch(`${base}/storage/v1/object/public/product-images/${path.split("/").map(encodeURIComponent).join("/")}`)
        if (!response.ok) throw new Error(`download ${response.status}`)
        await objectStorage().send(new PutObjectCommand({
          Bucket: process.env.STORAGE_BUCKET,
          Key: path,
          Body: new Uint8Array(await response.arrayBuffer()),
          ContentType: response.headers.get("content-type") || "application/octet-stream",
          CacheControl: "public, max-age=31536000, immutable",
        }))
        copied += 1
      } catch (error) {
        failed.push(`${path}: ${error instanceof Error ? error.message : error}`)
      }
      const done = copied + skipped + failed.length
      if (done % 100 === 0) console.log(`${done}/${paths.length}`)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  console.log(`Copied ${copied}, already there ${skipped}, failed ${failed.length}`)
  for (const line of failed) console.log(`  ${line}`)
  if (failed.length) process.exitCode = 1
}

async function rewrite() {
  const sql = getDirectSql()
  const target = `${publicBase()}/`
  const source = supabaseImageUrl
  try {
    const images = await sql`update product_images set url = regexp_replace(url, ${source}, ${target}) where url ~ ${source}`
    const collections = await sql`update collections set image_url = regexp_replace(image_url, ${source}, ${target}) where image_url ~ ${source}`
    const products = await sql`update products set description_html = regexp_replace(description_html, ${source}, ${target}, 'g') where description_html ~ ${source}`
    const settings = await sql`
      update store_settings set
        logo_url = regexp_replace(logo_url, ${source}, ${target}),
        banner_url = regexp_replace(banner_url, ${source}, ${target})
      where logo_url ~ ${source} or banner_url ~ ${source}
    `
    console.log(`Rewrote ${images.count} product images, ${collections.count} collections, ${products.count} descriptions, ${settings.count} settings rows`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function main() {
  loadEnvFile()
  if (!process.env.STORAGE_BUCKET) throw new Error("Set the STORAGE_* variables in .env.local first")
  const step = process.argv[2]
  if (step === "copy") return copy()
  if (step === "rewrite") return rewrite()
  throw new Error("Usage: move-images copy | rewrite")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
