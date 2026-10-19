import Link from "next/link"
import type { StoreSettings } from "@/lib/settings"

export function Footer({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="mt-[var(--section)] bg-[var(--fg)] text-[var(--bg)]">
      <div className="wrap grid gap-8 py-12 md:grid-cols-3">
        <div>
          <p className="text-sm tracking-[0.18em]">{settings.name.toUpperCase()}</p>
          <p className="mt-3 max-w-xs text-sm opacity-80">{settings.tagline}</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/search">Shop</Link>
          <Link href="/about">About</Link>
          <Link href="/shipping">Shipping</Link>
          <Link href="/orders/lookup">Track an order</Link>
        </div>
        <div className="text-sm">
          {settings.supportEmail ? <p>{settings.supportEmail}</p> : <p>Prices in AUD and include GST unless a product says otherwise.</p>}
        </div>
      </div>
    </footer>
  )
}
