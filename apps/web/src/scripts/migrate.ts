import { migrate } from "@/db/migrate"
import { getDirectSql } from "@/db/client"
import { loadEnvFile } from "@/lib/env"

async function main() {
  loadEnvFile()
  const sql = getDirectSql()
  await migrate(sql)
  console.log("Migrations applied")
  await sql.end({ timeout: 5 })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
