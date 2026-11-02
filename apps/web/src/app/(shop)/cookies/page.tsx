import { CookieChoice } from "@/components/cookie-consent"

export const metadata = { title: "Cookies" }

export default function CookiesPage() {
  return (
    <div className="wrap max-w-2xl py-[var(--section)]">
      <h1 className="text-3xl font-semibold tracking-tight">Cookies</h1>
      <div className="prose mt-6">
        <h2>Essential</h2>
        <p>
          These keep the shop working and are always on. A cart cookie remembers what is in your cart for up to 30 days,
          and our bot protection checks that checkout requests come from a real browser. Payments are handled on
          Stripe&apos;s secure checkout page, which uses its own cookies.
        </p>
        <h2>Analytics</h2>
        <p>
          With your permission, we use Vercel Web Analytics and Speed Insights to count visits and measure how fast pages
          load. These tools do not use cookies and do not identify you personally. They only run after you accept.
        </p>
        <h2>Your choice</h2>
        <p>Your choice is saved in this browser. You can change it at any time.</p>
      </div>
      <CookieChoice />
    </div>
  )
}
