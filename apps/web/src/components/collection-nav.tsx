"use client"

import { CartIcon } from "@/components/cart-icon"
import { CartPreview } from "@/components/cart-preview"
import { LiveSearchResults, searchOptionId, useLiveSearch } from "@/components/live-search"
import type { CartSummary } from "@/lib/cart"
import type { NavIcon, NavItem } from "@/lib/nav-groups"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"

export function CollectionNav({
  items,
  cart,
  currency,
  storeName,
  logoUrl,
}: {
  items: NavItem[]
  cart: CartSummary
  currency: string
  storeName: string
  logoUrl: string
}) {
  const cartCount = cart.count
  const scroller = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const searchForm = useRef<HTMLFormElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<number | null>(null)
  const pinned = useRef(false)
  const hoverOk = useRef(false)
  const focusMenu = useRef(false)
  const pathname = usePathname()
  const brand = useSearchParams().get("brand")
  const [scrolled, setScrolled] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const live = useLiveSearch(query)
  const showResults = open && live.term.length >= 2
  const cartTimer = useRef<number | null>(null)
  const cartLink = useRef<HTMLAnchorElement>(null)
  const cartPanel = useRef<HTMLDivElement>(null)
  const [cartMounted, setCartMounted] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const lastCount = useRef(cartCount)
  const [bump, setBump] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetGroup, setSheetGroup] = useState<string | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const sheetButton = useRef<HTMLButtonElement>(null)
  const cartPreviewOff = pathname === "/cart" || pathname.startsWith("/checkout")

  useEffect(() => {
    setSheetOpen(false)
  }, [pathname, brand])

  useEffect(() => {
    if (open) setSheetOpen(false)
  }, [open])

  useEffect(() => {
    if (!sheetOpen) {
      setSheetGroup(null)
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (sheet.current?.contains(target) || sheetButton.current?.contains(target)) return
      setSheetOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setSheetOpen(false)
      sheetButton.current?.focus()
    }
    const desktop = window.matchMedia("(min-width: 768px)")
    const onResize = () => {
      if (desktop.matches) setSheetOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    desktop.addEventListener("change", onResize)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      desktop.removeEventListener("change", onResize)
    }
  }, [sheetOpen])

  useEffect(() => {
    const node = scroller.current
    if (!node) return

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const max = node.scrollWidth - node.clientWidth
      if (max <= 1) return
      const next = Math.max(0, Math.min(max, node.scrollLeft + event.deltaY))
      if (next === node.scrollLeft) return
      event.preventDefault()
      node.scrollLeft = next
    }

    const updateFade = () => {
      const max = node.scrollWidth - node.clientWidth
      node.toggleAttribute("data-fade-start", node.scrollLeft > 1)
      node.toggleAttribute("data-fade-end", node.scrollLeft < max - 1)
    }

    updateFade()
    const resize = new ResizeObserver(updateFade)
    resize.observe(node)
    node.addEventListener("wheel", onWheel, { passive: false })
    node.addEventListener("scroll", updateFade, { passive: true })
    return () => {
      resize.disconnect()
      node.removeEventListener("wheel", onWheel)
      node.removeEventListener("scroll", updateFade)
    }
  }, [])

  useEffect(() => {
    const node = scroller.current
    const current = node?.querySelector<HTMLElement>("[aria-current=page]")
    if (!node || !current) return
    const left = current.offsetLeft - (node.clientWidth - current.offsetWidth) / 2
    node.scrollTo({ left: Math.max(0, left), behavior: "smooth" })
  }, [pathname])

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => searchInput.current?.focus({ preventScroll: true }), 120)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element
      if (!searchForm.current?.contains(target) && !target.closest?.(".live-search")) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)")
    const update = () => { hoverOk.current = media.matches }
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  function clearCloseTimer() {
    if (closeTimer.current === null) return
    window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  function closeMenu() {
    clearCloseTimer()
    pinned.current = false
    setMenuId(null)
  }

  function openMenu(id: string, pin: boolean) {
    clearCloseTimer()
    hideCart(0)
    pinned.current = pin
    setMenuId(id)
  }

  function clearCartTimer() {
    if (cartTimer.current === null) return
    window.clearTimeout(cartTimer.current)
    cartTimer.current = null
  }

  function showCart() {
    if (!hoverOk.current || open || cartPreviewOff) return
    clearCartTimer()
    setCartMounted(true)
    cartTimer.current = window.setTimeout(() => {
      cartTimer.current = null
      closeMenu()
      setCartOpen(true)
    }, 90)
  }

  function hideCart(wait = 200) {
    clearCartTimer()
    if (wait <= 0) {
      setCartOpen(false)
      return
    }
    cartTimer.current = window.setTimeout(() => {
      cartTimer.current = null
      setCartOpen(false)
    }, wait)
  }

  useEffect(() => {
    hideCart(0)
  }, [pathname, open])

  useEffect(() => {
    if (cartCount > lastCount.current) setBump((value) => value + 1)
    lastCount.current = cartCount
  }, [cartCount])

  useEffect(() => {
    if (!cartOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (cartPanel.current?.contains(target) || cartLink.current?.contains(target)) return
      hideCart(0)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideCart(0)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [cartOpen])

  function scheduleClose() {
    if (pinned.current) return
    clearCloseTimer()
    closeTimer.current = window.setTimeout(() => {
      pinned.current = false
      setMenuId(null)
    }, 180)
  }

  useEffect(() => {
    closeMenu()
  }, [pathname, brand])

  useEffect(() => {
    if (open) closeMenu()
  }, [open])

  useEffect(() => {
    if (!menuId) return
    if (focusMenu.current) {
      focusMenu.current = false
      menu.current?.querySelector("a")?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menu.current?.contains(target) || buttons.current.get(menuId)?.contains(target)) return
      closeMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      const button = buttons.current.get(menuId)
      closeMenu()
      button?.focus()
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [menuId])

  useLayoutEffect(() => {
    const button = menuId ? buttons.current.get(menuId) : null
    const panel = menu.current
    const bounds = row.current
    if (!menuId || !button || !panel || !bounds) return
    const place = () => {
      const item = button.getBoundingClientRect()
      const parent = bounds.getBoundingClientRect()
      const width = panel.offsetWidth
      const left = Math.max(0, Math.min(item.left - parent.left, parent.width - width))
      panel.style.left = `${left}px`
      panel.style.top = `${item.bottom - parent.top}px`
    }
    place()
    const resize = new ResizeObserver(place)
    resize.observe(panel)
    window.addEventListener("resize", place)
    scroller.current?.addEventListener("scroll", place, { passive: true })
    return () => {
      resize.disconnect()
      window.removeEventListener("resize", place)
      scroller.current?.removeEventListener("scroll", place)
    }
  }, [menuId])

  const openGroup = items.find((item) => item.kind === "menu" && item.id === menuId)

  return (
    <nav
      className="collection-nav"
      aria-label="Main"
      data-search-open={open ? "" : undefined}
      data-scrolled={scrolled ? "" : undefined}
      data-sheet-open={sheetOpen ? "" : undefined}
    >
      <div className="nav-search-backdrop" aria-hidden="true" />
      <div ref={row} className="collection-nav-row">
        <div className="nav-bar glass">
          <Link href="/" className="nav-brand" aria-label={`${storeName} home`} inert={open}>
            <span className="app-icon">
              <img src={logoUrl} alt="" />
            </span>
          </Link>
          <button
            ref={sheetButton}
            type="button"
            className="nav-menu-button"
            aria-label={sheetOpen ? "Close categories" : "Open categories"}
            aria-expanded={sheetOpen}
            aria-controls="nav-sheet"
            inert={open}
            onClick={() => setSheetOpen((value) => !value)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <div ref={scroller} className="collection-nav-scroller" inert={open}>
            {items.map((item) => (
              item.kind === "link" ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className="collection-nav-link"
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {item.icon ? <NavIconSvg name={item.icon} /> : null}
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.id}
                  ref={(node) => {
                    if (node) buttons.current.set(item.id, node)
                    else buttons.current.delete(item.id)
                  }}
                  type="button"
                  className="collection-nav-link collection-nav-parent"
                  aria-expanded={menuId === item.id}
                  aria-controls={`collection-menu-${item.id}`}
                  aria-current={item.links.some((link) => linkIsCurrent(link.href, pathname, brand)) ? "page" : undefined}
                  onMouseEnter={() => {
                    if (hoverOk.current) openMenu(item.id, false)
                  }}
                  onMouseLeave={() => {
                    if (hoverOk.current) scheduleClose()
                  }}
                  onClick={(event) => {
                    const keyboard = event.detail === 0
                    if (menuId === item.id && (pinned.current || keyboard || !hoverOk.current)) {
                      closeMenu()
                      return
                    }
                    openMenu(item.id, true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowDown") return
                    event.preventDefault()
                    focusMenu.current = true
                    openMenu(item.id, true)
                  }}
                >
                  {item.icon ? <NavIconSvg name={item.icon} /> : null}
                  {item.label}
                  <Chevron />
                </button>
              )
            ))}
          </div>
          <div className="nav-menu-spacer" aria-hidden="true" />
          <div className="nav-search-slot" aria-hidden="true" />
          <form
            ref={searchForm}
            action="/search"
            role="search"
            className="nav-search"
            onSubmit={(event) => {
              if (!query.trim()) {
                event.preventDefault()
                searchInput.current?.focus({ preventScroll: true })
              }
            }}
          >
            <button
              className="nav-search-button"
              type={open ? "submit" : "button"}
              aria-label={open ? "Search" : "Open search"}
              aria-expanded={open}
              onClick={(event) => {
                if (open) return
                event.preventDefault()
                setOpen(true)
              }}
            >
              <SearchIcon />
            </button>
            <label className="sr-only" htmlFor="nav-search-input">Search parts</label>
            <input
              ref={searchInput}
              id="nav-search-input"
              className="nav-search-input"
              name="q"
              placeholder="Search parts"
              enterKeyHint="search"
              autoComplete="off"
              tabIndex={open ? 0 : -1}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showResults}
              aria-controls="nav-search-results"
              aria-activedescendant={showResults && live.active >= 0 ? searchOptionId("nav-search-results", live.active) : undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={live.onKeyDown}
            />
            <button className="nav-search-close" type="button" aria-label="Close search" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" /></svg>
            </button>
          </form>
          <Link
            ref={cartLink}
            href="/cart"
            className="nav-cart"
            aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
            data-preview-open={cartOpen ? "" : undefined}
            inert={open}
            onMouseEnter={showCart}
            onMouseLeave={() => hideCart()}
          >
            <span className="header-cart-icon" aria-hidden="true">
              <CartIcon />
              {cartCount > 0 ? (
                <span key={bump} className="header-cart-count" data-bump={bump > 0 ? "" : undefined}>
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </span>
          </Link>
        </div>
        <div
          ref={sheet}
          id="nav-sheet"
          className="nav-sheet glass"
          data-open={sheetOpen ? "" : undefined}
          inert={!sheetOpen}
        >
          <ul className="nav-sheet-list">
            {items.map((item, index) => {
              const style = { "--i": index } as CSSProperties
              if (item.kind === "link") {
                return (
                  <li key={item.href} className="nav-sheet-item" style={style}>
                    <Link
                      href={item.href}
                      className="nav-sheet-link"
                      aria-current={pathname === item.href ? "page" : undefined}
                      onClick={() => setSheetOpen(false)}
                    >
                      {item.icon ? <NavIconSvg name={item.icon} /> : null}
                      {item.label}
                    </Link>
                  </li>
                )
              }
              const expanded = sheetGroup === item.id
              return (
                <li key={item.id} className="nav-sheet-item" style={style} data-expanded={expanded ? "" : undefined}>
                  <button
                    type="button"
                    className="nav-sheet-link"
                    aria-expanded={expanded}
                    aria-controls={`nav-sheet-${item.id}`}
                    onClick={() => setSheetGroup(expanded ? null : item.id)}
                  >
                    {item.icon ? <NavIconSvg name={item.icon} /> : null}
                    {item.label}
                    <Chevron />
                  </button>
                  <div id={`nav-sheet-${item.id}`} className="nav-sheet-sub" inert={!expanded}>
                    <div>
                      {item.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="nav-sheet-sublink"
                          aria-current={linkIsCurrent(link.href, pathname, brand) ? "page" : undefined}
                          onClick={() => setSheetOpen(false)}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        {openGroup && openGroup.kind === "menu" ? (
          <div
            ref={menu}
            id={`collection-menu-${openGroup.id}`}
            className="collection-nav-menu"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={() => {
              if (hoverOk.current) scheduleClose()
            }}
          >
            <div className="collection-nav-menu-panel glass">
              {openGroup.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="collection-nav-sublink"
                  aria-current={linkIsCurrent(link.href, pathname, brand) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {cartMounted && !cartPreviewOff ? (
          <div ref={cartPanel}>
            <CartPreview
              id="cart-preview"
              cart={cart}
              currency={currency}
              open={cartOpen}
              onMouseEnter={clearCartTimer}
              onMouseLeave={() => hideCart()}
            />
          </div>
        ) : null}
        {showResults ? (
          <LiveSearchResults
            id="nav-search-results"
            className="live-search-nav"
            search={live}
            onPick={() => setOpen(false)}
          />
        ) : null}
      </div>
    </nav>
  )
}

function linkIsCurrent(href: string, pathname: string, brand: string | null) {
  const url = new URL(href, "https://nicheparts.local")
  if (url.pathname !== pathname) return false
  const wanted = url.searchParams.get("brand")
  if (wanted) return brand === wanted
  if (url.pathname.startsWith("/collections/")) return !brand
  return true
}

const navIconPaths: Record<NavIcon, string[]> = {
  brands: [
    "M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z",
    "M7.5 7.5h.01",
  ],
  tools: [
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  ],
  home: [
    "M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
  ],
  gaming: [
    "M6 11h4",
    "M8 9v4",
    "M15 12h.01",
    "M18 10h.01",
    "M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.69-7.26A4 4 0 0 0 17.32 5z",
  ],
  electronics: [
    "M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "M9 9h6v6H9z",
    "M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3",
  ],
  hobby: [
    "M19.44 7.85c-.05.32.06.65.29.88l1.57 1.57a2.4 2.4 0 0 1 0 3.4l-1.61 1.62a.98.98 0 0 1-.84.27c-.47-.07-.8-.48-.97-.92a2.5 2.5 0 1 0-3.21 3.21c.44.17.85.5.92.97a.98.98 0 0 1-.27.84l-1.61 1.61a2.4 2.4 0 0 1-3.41 0l-1.57-1.57a1.03 1.03 0 0 0-.88-.29c-.49.07-.84.5-1.02.97a2.5 2.5 0 1 1-3.24-3.24c.47-.18.9-.53.97-1.02a1.03 1.03 0 0 0-.29-.88l-1.57-1.57a2.4 2.4 0 0 1 0-3.4L4.23 8.77c.24-.24.58-.35.92-.3.51.08.88.53 1.07 1.01a2.5 2.5 0 1 0 3.26-3.26c-.48-.2-.93-.56-1.01-1.07-.05-.34.06-.68.3-.92l1.53-1.53a2.4 2.4 0 0 1 3.4 0l1.57 1.57c.23.23.56.34.88.29.49-.07.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.47.18-.9.53-.97 1.02z",
  ],
  car: [
    "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2",
    "M9 17h6",
    "M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
    "M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
  ],
}

function NavIconSvg({ name }: { name: NavIcon }) {
  return (
    <svg className="collection-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {navIconPaths[name].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

function Chevron() {
  return (
    <svg className="collection-nav-chevron" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.2 4.3 6 8l3.8-3.7-.9-.9L6 6.2 3.1 3.4z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.24 4.24-1.41 1.42-4.25-4.25A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" />
    </svg>
  )
}
