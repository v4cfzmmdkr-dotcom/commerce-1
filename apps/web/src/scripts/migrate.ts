import { migrate } from "@/db/migrate"
import { getSql } from "@/db/client"
import { loadEnvFile } from "@/lib/env"

async function main() {
  loadEnvFile()
  await migrate()
  console.log("Migrations applied")
  await getSql().end({ timeout: 5 })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
