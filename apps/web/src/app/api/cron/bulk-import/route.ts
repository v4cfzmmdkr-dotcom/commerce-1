import { revalidatePath } from "next/cache"
import { timingSafeEqual } from "node:crypto"
import { runImportStep } from "@/lib/bulk-import/process"

export const runtime = "nodejs"
export const maxDuration = 60

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get("authorization") || "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

// Optional: lets a scheduler keep imports moving when no admin has the import page open.
// Vercel Cron sends CRON_SECRET as a bearer token.
export async function GET(request: Request) {
  if (!authorised(request)) return new Response("Unauthorized", { status: 401 })
  const step = await runImportStep({ budgetMs: 40_000, concurrency: 2 })
  if (step.imported) revalidatePath("/", "layout")
  return Response.json(step)
}
