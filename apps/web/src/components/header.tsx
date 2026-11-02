import { CollectionNav } from "@/components/collection-nav"
import Link from "next/link"
import type { StoreSettings } from "@/lib/settings"

function AnnouncementCopy({ text }: { text: string }) {
  const parts = text.split(/(48 hours)/gi)
  return (
    <>
      {parts.map((part, index) => (
        part.toLowerCase() === "48 hours" ? (
          <span key={index} className="announcement-accent">{part}</span>
        ) : (
          part
        )
      ))}
    </>
  )
}

function Announcement({ text }: { text: string }) {
  const items = Array.from({ length: 8 }, (_, index) => (
    <span key={index} className="announcement-item">
      <AnnouncementCopy text={text} />
    </span>
  ))
  return (
    <div className="announcement" role="status">
      <div className="announcement-track">
        <div className="announcement-group">{items}</div>
        <div className="announcement-group" aria-hidden="true">{items}</div>
      </div>
    </div>
  )
}

export function Header({
  settings,
  collections,
  cartCount,
}: {
  settings: StoreSettings
  collections: Array<{ handle: string, title: string }>
  cartCount: number
}) {
  return (
    <header className="site-header border-b border-[var(--border)] bg-[var(--bg)] pt-[env(safe-area-inset-top)] text-[var(--fg)]">
      {settings.announcement ? <Announcement text={settings.announcement} /> : null}
      <div className="site-header-bar wrap-wide" style={{ minHeight: "var(--header-h)" }}>
        <Link href="/" className="site-header-brand tap-link gap-3" aria-label={`${settings.name} home`}>
          <img src={settings.logoUrl || "/brand/logo.png"} alt={settings.name} className="h-10 w-auto" />
        </Link>
        <div className="site-header-tools">
          <form action="/search" className="site-header-search">
            <label className="sr-only" htmlFor="header-search">Search parts</label>
            <input id="header-search" name="q" placeholder="Search parts" className="field" enterKeyHint="search" />
          </form>
          <Link
            href="/cart"
            className="header-cart tap-link justify-center"
            aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
          >
            <span className="header-cart-label">Cart{cartCount > 0 ? ` (${cartCount})` : ""}</span>
            <span className="header-cart-icon" aria-hidden="true">
              <CartIcon />
              {cartCount > 0 ? <span className="header-cart-count">{cartCount > 99 ? "99+" : cartCount}</span> : null}
            </span>
          </Link>
        </div>
      </div>
      <CollectionNav>
        <Link href="/search" className="collection-nav-link">All parts</Link>
        {collections.map((collection) => (
          <Link key={collection.handle} href={`/collections/${collection.handle}`} className="collection-nav-link">
            {collection.title}
          </Link>
        ))}
      </CollectionNav>
    </header>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h14l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.7L5.2 3H2V1.5h4.1l.4 2.5H21.5V6H7.4l.2 1.2zm1.1 14.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
    </svg>
  )
}
