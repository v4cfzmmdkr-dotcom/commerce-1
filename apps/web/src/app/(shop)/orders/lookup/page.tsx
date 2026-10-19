import { redirect } from "next/navigation"
import { getSql } from "@/db/client"

export const metadata = { title: "Track an order" }

async function lookup(formData: FormData) {
  "use server"
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const number = String(formData.get("number") || "").trim().toUpperCase()
  const sql = getSql()
  const rows = await sql<{ token: string }[]>`
    select public_token as token from orders
    where lower(email) = ${email} and upper(number) = ${number}
    limit 1
  `
  if (!rows[0]) redirect("/orders/lookup?error=1")
  redirect(`/orders/${rows[0].token}`)
}

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <div className="wrap max-w-lg py-[var(--section)]">
      <h1 className="text-3xl font-semibold tracking-tight">Track an order</h1>
      <form action={lookup} className="mt-6 grid gap-4">
        <label className="label">Email<input className="field normal-case" type="email" name="email" required /></label>
        <label className="label">Order number<input className="field normal-case" name="number" placeholder="NP-1001" required /></label>
        {params.error ? <p className="text-sm">No order matched those details.</p> : null}
        <button className="btn" type="submit">Look up</button>
      </form>
    </div>
  )
}
