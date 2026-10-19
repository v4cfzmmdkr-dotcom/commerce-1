import Link from "next/link"
import type { StoreSettings } from "@/lib/settings"

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
    <header className="border-b border-[var(--border)] bg-[var(--bg)] pt-[env(safe-area-inset-top)] text-[var(--fg)]">
      {settings.announcement ? (
        <div className="announcement">
          {settings.announcement}
        </div>
      ) : null}
      <div className="wrap flex flex-wrap items-center gap-4" style={{ minHeight: "var(--header-h)" }}>
        <Link href="/" className="tap-link gap-3">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt={settings.name} className="h-8 w-auto" />
          ) : (
            <span className="text-sm font-semibold tracking-[0.08em]">{settings.name}</span>
          )}
        </Link>
        <form action="/search" className="min-w-48 flex-1">
          <label className="sr-only" htmlFor="header-search">Search parts</label>
          <input id="header-search" name="q" placeholder="Search parts" className="field" enterKeyHint="search" />
        </form>
        <Link href="/cart" className="tap-link justify-center">
          Cart{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
      </div>
      <nav className="border-t border-[var(--border)]" aria-label="Collections">
        <div className="wrap flex gap-4 overflow-x-auto text-sm">
          <Link href="/search" className="nav-link shrink-0">All parts</Link>
          {collections.map((collection) => (
            <Link key={collection.handle} href={`/collections/${collection.handle}`} className="nav-link shrink-0">
              {collection.title}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
