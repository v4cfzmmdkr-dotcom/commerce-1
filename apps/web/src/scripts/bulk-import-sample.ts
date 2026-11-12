import { writeFile } from "node:fs/promises"
import { buildPackage, sampleFiles, sampleProduct } from "@/lib/bulk-import/test-package"

function arg(name: string) {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

async function main() {
  const count = Number(arg("--count") || 3)
  const out = arg("--out") || "bulk-import-sample.zip"
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error("Pass --count between 1 and 1000")
  const products = Array.from({ length: count }, (_, index) => sampleProduct(index + 1))
  const files: Record<string, Buffer> = {}
  for (let n = 1; n <= count; n += 1) Object.assign(files, await sampleFiles(n))
  const zip = await buildPackage({ products, files, packageId: arg("--package-id") || `sample-${Date.now()}` })
  await writeFile(out, zip)
  console.log(`Wrote ${count} products to ${out} (${(zip.length / 1024).toFixed(0)} KB)`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
