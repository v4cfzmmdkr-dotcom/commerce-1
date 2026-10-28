import { databaseConfigured } from "@/db/client"

export function dataApiEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.VERCEL || !databaseConfigured()))
}

type RestResult<T> = { data: T, total: number, status: number }

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<RestResult<T> | null> {
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return null
  const headers = new Headers(init.headers)
  headers.set("apikey", key)
  headers.set("Authorization", `Bearer ${key}`)
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(12000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    console.error(`Supabase REST ${response.status}: ${path} ${detail.slice(0, 300)}`)
    return null
  }
  const text = await response.text()
  const data = (text ? JSON.parse(text) : null) as T
  return {
    data,
    total: Number((response.headers.get("content-range") || "").split("/")[1] || 0),
    status: response.status,
  }
}

export async function supabaseRest<T>(path: string, extraHeaders: Record<string, string> = {}) {
  return supabaseRequest<T>(path, { headers: extraHeaders })
}

export async function supabaseMutate<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return supabaseRequest<T>(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function supabaseRpc<T>(fn: string, args: Record<string, unknown> = {}) {
  return supabaseRequest<T>(`rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  })
}
