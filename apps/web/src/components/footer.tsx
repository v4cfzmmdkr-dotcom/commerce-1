import Link from "next/link"
import type { StoreSettings } from "@/lib/settings"

// Keep in step with the payment methods turned on in the Stripe Dashboard.
const paymentMethods = ["Visa", "Mastercard", "Amex", "Apple Pay", "Google Pay", "Link", "Afterpay", "Zip"]

export function Footer({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="site-footer pb-[env(safe-area-inset-bottom)]">
      <div className="wrap-wide grid gap-8 py-12 md:grid-cols-3">
        <div>
          <Link href="/" className="mb-4 inline-block" aria-label={`${settings.name} home`}>
            <img src={settings.logoUrl || "/brand/logo.png"} alt="" className="h-10 w-auto" />
          </Link>
          <p className="text-sm font-semibold">{settings.name}</p>
          <p className="mt-3 max-w-xs text-sm">{settings.tagline}</p>
        </div>
        <nav className="flex flex-col text-sm" aria-label="Shop">
          <Link className="nav-link" href="/contact">Contact</Link>
          <Link className="nav-link" href="/shipping">Shipping</Link>
          <Link className="nav-link" href="/returns">Returns</Link>
          <Link className="nav-link" href="/orders/lookup">Track an order</Link>
          <Link className="nav-link" href="/cookies">Cookies</Link>
        </nav>
        <div className="text-sm">
          {settings.supportEmail ? <p className="mb-6">{settings.supportEmail}</p> : null}
          <p className="font-semibold">We accept</p>
          <ul className="payment-methods" aria-label="Payment methods">
            {paymentMethods.map((method) => <li key={method} className="payment-badge">{method}</li>)}
          </ul>
        </div>
      </div>
    </footer>
  )
}
