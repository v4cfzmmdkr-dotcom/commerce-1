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
    <header className="border-b border-[var(--border)] bg-[var(--bg)] pt-[env(safe-area-inset-top)] text-[var(--fg)]">
      {settings.announcement ? <Announcement text={settings.announcement} /> : null}
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
        <Link href="/cart" className="header-cart tap-link justify-center">
          Cart{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
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
