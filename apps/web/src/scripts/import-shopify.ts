import { readFile } from "node:fs/promises"
import { getSql } from "@/db/client"
import { loadEnvFile } from "@/lib/env"
import { importShopifyCsv, migrateRemoteImages, syncCollections } from "@/lib/shopify/import"

function arg(name: string) {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function has(name: string) {
  return process.argv.includes(name)
}

async function main() {
  loadEnvFile()
  const file = arg("--file")
  const store = arg("--store") || process.env.SHOPIFY_STORE_URL
  if (!file && !has("--images-only") && !has("--collections-only")) {
    throw new Error("Pass --file /path/to/products.csv")
  }
  if (file) {
    const buffer = await readFile(file)
    const { report } = await importShopifyCsv(buffer, file.split("/").pop() || "products.csv")
    console.log(JSON.stringify({
      created: report.productsCreated,
      updated: report.productsUpdated,
      skipped: report.productsSkipped,
      variants: report.variantsImported,
      imagesPending: report.imagesPending,
      failures: report.failures.length,
      warnings: report.warnings.length,
    }, null, 2))
    if (report.failures.length) {
      console.log(report.failures.slice(0, 20))
    }
  }
  if (!has("--skip-images") && (file || has("--images-only"))) {
    const limit = Number(arg("--image-limit") || 5000)
    const images = await migrateRemoteImages({ limit })
    console.log(`Images stored ${images.stored}, failed ${images.failed}, still remote ${images.pending}`)
    if (images.failures.length) console.log(images.failures.slice(0, 10))
  }
  const collectionsFile = arg("--collections-file")
  if (collectionsFile || (store && (has("--collections") || has("--collections-only")))) {
    try {
      const preset = collectionsFile
        ? JSON.parse(await readFile(collectionsFile, "utf8")) as Parameters<typeof syncCollections>[2]
        : undefined
      if (!preset && !store) throw new Error("Pass --store or --collections-file")
      const synced = await syncCollections(store || "https://unused.example", !has("--skip-images"), preset)
      console.log(`Collections synced ${synced}`)
    } catch (error) {
      const cause = error instanceof Error && "cause" in error ? error.cause : undefined
      console.error(error instanceof Error ? error.message : error)
      if (cause) console.error(cause)
      console.error("Products were still imported. Run collection sync again when nicheparts.com.au is reachable.")
      process.exitCode = 1
    }
  }
  await getSql().end({ timeout: 5 })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
