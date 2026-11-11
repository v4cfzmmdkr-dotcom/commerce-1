import Link from "next/link"
import { PaymentIcons } from "@/components/payment-icons"
import { SocialLinks } from "@/components/social-links"
import type { StoreSettings } from "@/lib/settings"

export function Footer({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="site-footer relative isolate overflow-clip pb-[env(safe-area-inset-bottom)]">
      <picture>
        <source media="(hover: none)" srcSet="/brand/hero-drawing-still.svg" />
        <img className="footer-drawing" src="/brand/hero-drawing.svg" alt="" aria-hidden="true" loading="lazy" decoding="async" />
      </picture>
      <div className="wrap-wide relative grid gap-8 py-12 md:grid-cols-3">
        <div>
          <Link href="/" className="mb-4 inline-block" aria-label={`${settings.name} home`}>
            <span className="app-icon">
              <img src={settings.logoUrl || "/brand/logo.png"} alt="" />
            </span>
          </Link>
          <SocialLinks placement="footer" />
          <p className="mt-4 text-sm">
            <span className="font-semibold">© {new Date().getFullYear()} {settings.name}.</span> All rights reserved.
          </p>
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
          <PaymentIcons />
        </div>
      </div>
    </footer>
  )
}
