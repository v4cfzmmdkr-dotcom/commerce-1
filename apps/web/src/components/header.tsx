import { CollectionNav } from "@/components/collection-nav"
import { HomeOnly } from "@/components/home-only"
import type { CartSummary } from "@/lib/cart"
import { collectionNavItems } from "@/lib/nav-groups"
import type { StoreSettings } from "@/lib/settings"

function AnnouncementCopy({ text }: { text: string }) {
  const parts = text.split(/(48 hours|Australia Post)/gi)
  return (
    <>
      {parts.map((part, index) => {
        const key = part.toLowerCase()
        if (key === "48 hours") return <span key={index} className="announcement-accent">{part}</span>
        if (key === "australia post") return <img key={index} className="announcement-logo" src="/brand/australia-post.svg" alt="Australia Post" />
        if (part.trim() === "." && parts[index - 1]?.toLowerCase() === "australia post") return null
        return part
      })}
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
  cart,
}: {
  settings: StoreSettings
  collections: Array<{ handle: string, title: string }>
  cart: CartSummary
}) {
  return (
    <>
      <header className="site-header bg-[var(--bg)] pt-[env(safe-area-inset-top)] text-[var(--fg)]">
        {settings.announcement ? <HomeOnly><Announcement text={settings.announcement} /></HomeOnly> : null}
      </header>
      <CollectionNav
        cart={cart}
        currency={settings.currency}
        items={collectionNavItems(collections)}
        storeName={settings.name}
        logoUrl={settings.logoUrl || "/brand/logo.png"}
      />
    </>
  )
}