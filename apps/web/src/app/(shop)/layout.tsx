import { CookieConsent } from "@/components/cookie-consent"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { cartSummary } from "@/lib/cart"
import { listNavCollections } from "@/lib/catalog"
import { databaseReady, getSettings } from "@/lib/settings"

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, collections, cart, ready] = await Promise.all([
    getSettings(),
    listNavCollections(),
    cartSummary(),
    databaseReady(),
  ])
  return (
    <div className="shop-frame">
      {!ready ? (
        <p className="bg-[var(--fg)] px-4 py-2 text-center text-sm text-[var(--bg)]">
          The shop database is not ready. Add DATABASE_URL and run pnpm web:setup.
        </p>
      ) : null}
      <Header settings={settings} collections={collections} cart={cart} />
      <main id="content">{children}</main>
      <Footer settings={settings} />
      <CookieConsent />
    </div>
  )
}
