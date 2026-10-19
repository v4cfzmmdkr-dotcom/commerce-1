import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { getSql } from "@/db/client"

function statements(text: string) {
  return text
    .split(/;\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export async function migrate() {
  const sql = getSql()
  await sql`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `
  const dir = path.join(process.cwd(), "src/db/sql")
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort()
  for (const file of files) {
    const applied = await sql`select id from schema_migrations where id = ${file}`
    if (applied.length > 0) continue
    const text = await readFile(path.join(dir, file), "utf8")
    await sql.begin(async (tx) => {
      for (const statement of statements(text)) {
        await tx.unsafe(statement)
      }
      await tx`insert into schema_migrations (id) values (${file})`
    })
  }
}
