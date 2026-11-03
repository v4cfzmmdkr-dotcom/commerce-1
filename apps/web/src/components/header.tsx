import { CartIcon } from "@/components/cart-icon"
import { CollectionNav } from "@/components/collection-nav"
import { HeaderSearch } from "@/components/header-search"
import { HomeOnly } from "@/components/home-only"
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
    <>
      <header className="site-header bg-[var(--bg)] pt-[env(safe-area-inset-top)] text-[var(--fg)]">
        {settings.announcement ? <HomeOnly><Announcement text={settings.announcement} /></HomeOnly> : null}
        <div className="site-header-bar wrap-wide" style={{ minHeight: "var(--header-h)" }}>
          <Link href="/" className="site-header-brand tap-link gap-3" aria-label={`${settings.name} home`}>
            <span className="app-icon">
              <img src={settings.logoUrl || "/brand/logo.png"} alt={settings.name} />
            </span>
          </Link>
          <div className="site-header-tools">
            <HeaderSearch />
            <Link
              href="/cart"
              className="header-cart glass tap-link justify-center"
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
      </header>
      <CollectionNav
        cartCount={cartCount}
        links={[
          { href: "/search", label: "All parts" },
          ...collections.map((collection) => ({ href: `/collections/${collection.handle}`, label: collection.title })),
        ]}
      />
    </>
  )
}