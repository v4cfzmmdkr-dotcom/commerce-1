import { getSql } from "@/db/client"
import { queueRemaining, runImportStep } from "@/lib/bulk-import/process"
import { loadEnvFile } from "@/lib/env"

function arg(name: string) {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

async function main() {
  loadEnvFile()
  const batchId = arg("--batch")
  const concurrency = Number(arg("--concurrency") || 3)
  let imported = 0
  let failed = 0
  for (;;) {
    const step = await runImportStep({ batchId, budgetMs: 30_000, concurrency })
    imported += step.imported
    failed += step.failed
    const waiting = await queueRemaining(batchId)
    console.log(`Imported ${imported}, failed ${failed}, waiting ${waiting}`)
    if (!waiting) break
    if (!step.imported && !step.failed) await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
  await getSql().end({ timeout: 5 })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
