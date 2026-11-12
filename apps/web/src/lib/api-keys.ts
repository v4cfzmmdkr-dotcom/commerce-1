import { createHash, randomBytes, randomUUID } from "node:crypto"
import { getSql } from "@/db/client"

export type ApiKey = {
  id: string
  name: string
  prefix: string
  createdBy: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}

const keyPattern = /^np_[A-Za-z0-9_-]{43}$/

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex")
}

export async function createApiKey(name: string, createdBy: string) {
  const key = `np_${randomBytes(32).toString("base64url")}`
  const id = randomUUID()
  await getSql()`
    insert into api_keys (id, name, prefix, key_hash, created_by)
    values (${id}, ${name.slice(0, 80) || "Sourcing app"}, ${key.slice(0, 10)}, ${hashKey(key)}, ${createdBy.slice(0, 200)})
  `
  return { id, key }
}

export async function listApiKeys() {
  return getSql()<ApiKey[]>`
    select id, name, prefix, created_by as "createdBy", created_at as "createdAt",
      last_used_at as "lastUsedAt", revoked_at as "revokedAt"
    from api_keys order by revoked_at is not null, created_at desc
  `
}

export async function revokeApiKey(id: string) {
  await getSql()`update api_keys set revoked_at = now() where id = ${id} and revoked_at is null`
}

export async function apiKeyFromRequest(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const key = header.match(/^Bearer\s+(\S+)$/i)?.[1] ?? ""
  if (!keyPattern.test(key)) return null
  const sql = getSql()
  const [found] = await sql<Array<{ id: string, name: string }>>`
    update api_keys set last_used_at = now()
    where key_hash = ${hashKey(key)} and revoked_at is null
    returning id, name
  `
  return found ?? null
}
