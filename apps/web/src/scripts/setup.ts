import { randomUUID } from "node:crypto"
import { hashPassword } from "@/lib/auth/password"
import { migrate } from "@/db/migrate"
import { getSql } from "@/db/client"
import { loadEnvFile } from "@/lib/env"
import { FREE_SHIPPING_MIN_CENTS, STANDARD_SHIPPING_CENTS, STANDARD_SHIPPING_MAX_CENTS } from "@/lib/shipping"
import { defaultTheme } from "@/lib/theme"

async function setup() {
  loadEnvFile()
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL in apps/web/.env before running setup")
  }
  await migrate()
  const sql = getSql()
  const settings = await sql`select id from store_settings where id = 'default'`
  if (!settings.length) {
    await sql`
      insert into store_settings (
        id, name, tagline, announcement, currency, gst_rate_bps, prices_include_tax, theme, about_html, shipping_html
      ) values (
        'default',
        'Niche Parts',
        'Australian made parts',
        'Dispatched within 48 hours.',
        'aud',
        1000,
        true,
        ${sql.json(defaultTheme)},
        ${"<p>Niche Parts makes small-run parts and accessories in Australia, including power-tool fittings, mounts, jigs, and inserts.</p>"},
        ${"<p>Delivery options and prices are confirmed at checkout. Paid orders are dispatched within 48 hours.</p>"}
      )
    `
  }
  const rates = await sql`select id from shipping_rates limit 1`
  if (!rates.length) {
    await sql`
      insert into shipping_rates (
        id, name, description, price_cents, countries, active, position, min_subtotal_cents, max_subtotal_cents
      ) values
        (
          ${randomUUID()}, 'Standard shipping', 'Flat rate for orders under $25.',
          ${STANDARD_SHIPPING_CENTS}, 'AU', true, 0, ${null}, ${STANDARD_SHIPPING_MAX_CENTS}
        ),
        (
          ${randomUUID()}, 'Free shipping', 'Orders of $25 or more.',
          0, 'AU', true, 1, ${FREE_SHIPPING_MIN_CENTS}, ${null}
        )
    `
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ""
  const users = await sql`select id from admin_users limit 1`
  if (!users.length && email && password) {
    if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters")
    if (process.env.NODE_ENV === "production" && password === "change-me-please") {
      throw new Error("Choose a real ADMIN_PASSWORD before seeding production")
    }
    await sql`
      insert into admin_users (id, email, name, password_hash)
      values (${randomUUID()}, ${email}, 'Owner', ${await hashPassword(password)})
    `
    console.log(`Created admin ${email}`)
  } else if (!users.length) {
    console.log("No admin user created. Set ADMIN_EMAIL and ADMIN_PASSWORD, then run setup again.")
  }
  console.log("Database is ready")
  await sql.end({ timeout: 5 })
}

setup().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
