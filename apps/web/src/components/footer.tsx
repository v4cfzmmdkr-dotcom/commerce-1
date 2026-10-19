import Link from "next/link"
import type { StoreSettings } from "@/lib/settings"

export function Footer({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="site-footer pb-[env(safe-area-inset-bottom)]">
      <div className="wrap grid gap-8 py-12 md:grid-cols-3">
        <div>
          <p className="text-sm font-semibold">{settings.name}</p>
          <p className="mt-3 max-w-xs text-sm">{settings.tagline}</p>
        </div>
        <nav className="flex flex-col text-sm" aria-label="Shop">
          <Link className="nav-link" href="/search">Shop</Link>
          <Link className="nav-link" href="/contact">Contact</Link>
          <Link className="nav-link" href="/shipping">Shipping</Link>
          <Link className="nav-link" href="/orders/lookup">Track an order</Link>
        </nav>
        <div className="text-sm">
          {settings.supportEmail ? <p>{settings.supportEmail}</p> : <p>Prices in AUD and include GST unless a product says otherwise.</p>}
        </div>
      </div>
    </footer>
  )
}
