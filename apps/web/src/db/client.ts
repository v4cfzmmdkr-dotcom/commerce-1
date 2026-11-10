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

// The same limitation applies to writes: a JS array is sent as "a,b", so pass this literal and cast it to text[].
export function textArrayLiteral(values: string[]) {
  return `{${values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`).join(",")}}`
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
    throw new Error("DATABASE_URL is not a Postgres connection string (postgresql://user:password@host:port/db)")
  }
  return {
    username: decodePart(match[1] || "postgres"),
    password: decodePart(match[2] || ""),
    host: match[3],
    port: Number(match[4] || 5432),
    database: (match[5] || "postgres").replace(/\/$/, "") || "postgres",
  }
}

const SESSION_POOLER_PORT = 5432
const TRANSACTION_POOLER_PORT = 6543

// Vercel cannot reach the IPv6-only db.*.supabase.co host. Use the shared
// pooler (IPv4) when a direct Supabase URL is provided.
// postgres.js pipelines concurrent queries on one connection, and the
// transaction pooler (6543) hangs forever on four or more pipelined
// statements, so always connect through the session pooler (5432).
export function vercelSafeTarget(raw: string): PgTarget {
  const parsed = parseDatabaseUrl(raw)
  if (/\.pooler\.supabase\.com$/i.test(parsed.host) && parsed.port === TRANSACTION_POOLER_PORT) {
    return { ...parsed, port: SESSION_POOLER_PORT }
  }
  const match = parsed.host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
  if (!match) return parsed
  const ref = match[1]
  return {
    ...parsed,
    host: process.env.SUPABASE_POOLER_HOST || "aws-0-ap-northeast-1.pooler.supabase.com",
    port: SESSION_POOLER_PORT,
    username: !parsed.username || parsed.username === "postgres"
      ? `postgres.${ref}`
      : parsed.username,
  }
}

export function isSupabaseDatabase(raw = process.env.DATABASE_URL) {
  if (!raw) return false
  try {
    return /\.supabase\.(co|com)$/i.test(parseDatabaseUrl(raw).host)
  } catch {
    return false
  }
}

function connect(raw: string) {
  try {
    const target = vercelSafeTarget(raw)
    const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.host.toLowerCase())
    console.info(`[db] ${target.host}:${target.port} user=${target.username} db=${target.database}`)
    return postgres({
      host: target.host,
      port: target.port,
      database: target.database,
      username: target.username,
      password: target.password,
      ssl: local ? false : "require",
      max: 1,
      prepare: false,
      fetch_types: false,
      connect_timeout: 8,
      idle_timeout: 20,
    })
  } catch (error) {
    console.error("[db] could not parse the database URL")
    throw error
  }
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
  }
  if (!globalForDb.sql) globalForDb.sql = connect(process.env.DATABASE_URL)
  return globalForDb.sql
}

// Neon's pooled URL goes through PgBouncer in transaction mode, which cannot hold the
// session state migrations rely on, so scripts use the unpooled URL when it is set.
export function getDirectSql() {
  const raw = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!raw) throw new Error("DATABASE_URL is not set")
  return connect(raw)
}
