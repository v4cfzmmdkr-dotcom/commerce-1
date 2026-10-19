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
    <header className="border-b border-[var(--border)]">
      {settings.announcement ? (
        <div className="bg-[var(--fg)] px-4 py-2 text-center text-xs tracking-wide text-[var(--bg)]">
          {settings.announcement}
        </div>
      ) : null}
      <div className="wrap flex items-center justify-between gap-4" style={{ minHeight: "var(--header-h)" }}>
        <Link href="/" className="flex items-center gap-3 no-underline">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt={settings.name} className="h-8 w-auto" />
          ) : (
            <span className="text-sm font-semibold tracking-[0.22em]">{settings.name.toUpperCase()}</span>
          )}
        </Link>
        <form action="/search" className="hidden min-w-0 flex-1 md:block">
          <label className="sr-only" htmlFor="header-search">Search parts</label>
          <input id="header-search" name="q" placeholder="Search parts" className="field" />
        </form>
        <Link href="/cart" className="text-sm no-underline">
          Cart{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
      </div>
      <nav className="border-t border-[var(--border)]" aria-label="Collections">
        <div className="wrap flex gap-4 overflow-x-auto py-3 text-sm">
          <Link href="/search" className="shrink-0 no-underline">All parts</Link>
          {collections.map((collection) => (
            <Link key={collection.handle} href={`/collections/${collection.handle}`} className="shrink-0 no-underline">
              {collection.title}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
