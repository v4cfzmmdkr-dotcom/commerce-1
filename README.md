# Niche Parts

Independent storefront for Niche Parts. It is a Next.js app in `apps/web`, with Postgres, an admin dashboard, a Shopify CSV importer, and Stripe Checkout.

The live Shopify store and domain stay where they are until you have tested this site and decided to switch.

## Local setup

Requirements: Node 20+, pnpm 10, and Docker (for the local database).

```bash
pnpm install
docker compose up -d
cp apps/web/.env.template apps/web/.env
# Set AUTH_SECRET to a long random string.
pnpm web:setup
pnpm dev
```

The shop runs at http://localhost:3000. Admin is at http://localhost:3000/admin.

Import the Shopify export without downloading every image:

```bash
pnpm web:import -- --file "/absolute/path/products_export.csv" --skip-images --collections
```

Copy images into local storage, or into Supabase when those variables are set:

```bash
pnpm web:import -- --images-only --image-limit 100
```

Re-importing the same CSV updates products by handle. It does not create a second copy.

## Theme

The storefront starts black and white. Colours, type, spacing, and corner radius are edited in Admin → Theme.

## Environment

Documented names live in `apps/web/.env.template`.

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres. Use the local Docker URL, or the Supabase pooler URL in production. |
| `AUTH_SECRET` | Signs the admin session cookie. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First admin user, created by `pnpm web:setup` when no admin exists. |
| `NEXT_PUBLIC_SITE_URL` | Public site origin used for links, sitemap, and Stripe return URLs. |
| `STRIPE_SECRET_KEY` | Server-side Stripe secret. Never expose this in the browser. |
| `STRIPE_WEBHOOK_SECRET` | Verifies `checkout.session.completed` events. |
| `RESEND_API_KEY` / `ORDERS_FROM_EMAIL` | Order confirmation email. Mail is skipped until both are set. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Optional image storage. Without them, files stay in `apps/web/storage`. |
| `SHOPIFY_STORE_URL` | Read-only source for collection membership. |

On Vercel, set the project root directory to `apps/web` and add the same variables. Point the Stripe webhook at `https://<your-domain>/api/webhooks/stripe`.

Supabase: create a project, put its pooler connection string in `DATABASE_URL`, and run `pnpm web:setup` against that database. The service role key is only used on the server. The first upload creates a public `product-images` bucket.

Shipping rates are created inactive. Set real prices and turn them on in Admin → Shipping before taking orders. Australian prices are stored GST-inclusive at 10% unless you change that in Settings.

## What is not automatic

- Card payments need your own Stripe account and a verified webhook. Test mode is not the same as a live charge.
- Order email needs a Resend account and a verified sender.
- A commercial Vercel deployment needs a paid Vercel plan. A live database should be a paid Supabase project so it does not pause.
- Do not change DNS for nicheparts.com.au from this repository.
