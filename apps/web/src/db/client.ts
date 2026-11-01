import postgres from "postgres"

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>
}

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL)
}

// With fetch_types disabled, postgres.js returns text[] columns as the raw
// array literal (e.g. `{a,"b c"}`) instead of a JS array.
export function textArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== "string") return []
  const body = value.trim().replace(/^\{|\}$/g, "")
  if (!body) return []
  const items: string[] = []
  let current = ""
  let quoted = false
  let wasQuoted = false
  for (let index = 0; index < body.length; index++) {
    const char = body[index]
    if (quoted) {
      if (char === "\\") current += body[++index] ?? ""
      else if (char === "\"") quoted = false
      else current += char
    } else if (char === "\"") {
      quoted = true
      wasQuoted = true
    } else if (char === ",") {
      if (wasQuoted || current !== "NULL") items.push(current)
      current = ""
      wasQuoted = false
    } else {
      current += char
    }
  }
  if (wasQuoted || current !== "NULL") items.push(current)
  return items
}

type PgTarget = {
  host: string
  port: number
  database: string
  username: string
  password: string
}

function decodePart(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseDatabaseUrl(raw: string): PgTarget {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "")
  const match = trimmed.match(
    /^postgres(?:ql)?:\/\/(?:([^:@/]*)(?::([^@]*))?@)?([^:/?#]+)(?::(\d+))?(?:\/([^?]*)?)?/i,
  )
  if (!match) {
    throw new Error("DATABASE_URL is invalid")
  }
  return {
    username: decodePart(match[1] || "postgres"),
    password: decodePart(match[2] || ""),
    host: match[3],
    port: Number(match[4] || 5432),
    database: (match[5] || "postgres").replace(/\/$/, "") || "postgres",
  }
}

// Vercel cannot reach the IPv6-only db.*.supabase.co host. Use the shared
// pooler (IPv4) when a direct Supabase URL is provided.
function vercelSafeTarget(raw: string): PgTarget {
  const parsed = parseDatabaseUrl(raw)
  const match = parsed.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
  if (!match) return parsed
  const ref = match[1]
  return {
    ...parsed,
    host: process.env.SUPABASE_POOLER_HOST || "aws-0-ap-northeast-1.pooler.supabase.com",
    port: Number(process.env.SUPABASE_POOLER_PORT || "6543"),
    username: !parsed.username || parsed.username === "postgres"
      ? `postgres.${ref}`
      : parsed.username,
  }
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
  }
  if (!globalForDb.sql) {
    const options = {
      ssl: "require" as const,
      max: 1,
      prepare: false,
      fetch_types: false,
      connect_timeout: 8,
      idle_timeout: 20,
    }
    try {
      const target = vercelSafeTarget(process.env.DATABASE_URL)
      const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.host.toLowerCase())
      console.info(`[db] ${target.host}:${target.port} user=${target.username} db=${target.database}`)
      globalForDb.sql = postgres({
        host: target.host,
        port: target.port,
        database: target.database,
        username: target.username,
        password: target.password,
        ...options,
        ssl: local ? false : options.ssl,
      })
    } catch (error) {
      console.error("[db] could not parse DATABASE_URL, using the raw connection string")
      console.error(error instanceof Error ? error.message : error)
      globalForDb.sql = postgres(process.env.DATABASE_URL, options)
    }
  }
  return globalForDb.sql
}
