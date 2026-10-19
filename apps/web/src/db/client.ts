import postgres from "postgres"

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>
}

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL)
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
  }
  if (!globalForDb.sql) {
    globalForDb.sql = postgres(process.env.DATABASE_URL, {
      max: 1,
      prepare: false,
    })
  }
  return globalForDb.sql
}
