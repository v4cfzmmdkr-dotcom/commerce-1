"use client"

import { CartIcon } from "@/components/cart-icon"
import { LiveSearchResults, searchOptionId, useLiveSearch } from "@/components/live-search"
import type { NavItem } from "@/lib/nav-groups"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

export function CollectionNav({
  items,
  cartCount,
}: {
  items: NavItem[]
  cartCount: number
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const searchForm = useRef<HTMLFormElement>(null)
  const cartLink = useRef<HTMLAnchorElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<number | null>(null)
  const pinned = useRef(false)
  const hoverOk = useRef(false)
  const focusMenu = useRef(false)
  const pathname = usePathname()
  const brand = useSearchParams().get("brand")
  const [search, setSearch] = useState<"in" | "out" | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const live = useLiveSearch(query)
  const showResults = open && search === "in" && live.term.length >= 2

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
    const headerSearch = document.getElementById("header-search")
    if (!headerSearch) return
    const observer = new IntersectionObserver(([entry]) => {
      const form = searchForm.current
      const row = form?.parentElement
      if (form && row) {
        const from = entry.boundingClientRect
        const to = row.getBoundingClientRect()
        const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))
        const formRight = to.left + form.offsetLeft + form.offsetWidth
        form.style.setProperty("--from-x", `${clamp(from.right - formRight, 160)}px`)
        form.style.setProperty("--from-y", `${clamp(from.top - to.top, 120)}px`)
        form.style.setProperty("--from-w", `${Math.min(from.width, to.width)}px`)
        form.style.setProperty("--from-h", `${from.height}px`)
        const headerCart = document.querySelector(".site-header-tools .header-cart")
        if (cartLink.current && headerCart) {
          const cart = headerCart.getBoundingClientRect()
          const size = cartLink.current.offsetWidth || 51
          const dx = cart.left + cart.width / 2 - (to.right - size / 2)
          const dy = cart.top + cart.height / 2 - (to.top + to.height / 2)
          cartLink.current.style.setProperty("--from-x", `${clamp(dx, 160)}px`)
          cartLink.current.style.setProperty("--from-y", `${clamp(dy, 120)}px`)
          cartLink.current.style.setProperty("--from-s", `${cart.width / size}`)
        }
      }
      const hidden = entry.intersectionRatio < 0.99 && entry.boundingClientRect.top < 0
      setSearch((current) => (hidden ? "in" : current ? "out" : null))
    }, { threshold: [0, 0.99] })
    observer.observe(headerSearch)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (search !== "in" && !searchInput.current?.value) setOpen(false)
  }, [search])

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
    pinned.current = pin
    setMenuId(id)
  }

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
      aria-label="Collections"
      data-search={search ?? undefined}
      data-search-open={open ? "" : undefined}
      data-cart={cartCount > 0 ? "" : undefined}
    >
      <div className="nav-search-backdrop" aria-hidden="true" />
      <div ref={row} className="collection-nav-row">
        <div className="collection-nav-glass glass" inert={open}>
          <div ref={scroller} className="collection-nav-scroller">
            {items.map((item) => (
              item.kind === "link" ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className="collection-nav-link"
                  aria-current={pathname === item.href ? "page" : undefined}
                >
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
                  {item.label}
                  <Chevron />
                </button>
              )
            ))}
          </div>
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
        <div className="nav-search-slot" />
        <form
          ref={searchForm}
          action="/search"
          role="search"
          className="nav-search glass"
          inert={search !== "in"}
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
        {showResults ? (
          <LiveSearchResults
            id="nav-search-results"
            className="live-search-nav"
            search={live}
            onPick={() => setOpen(false)}
          />
        ) : null}
        {cartCount > 0 ? (
          <Link
            ref={cartLink}
            href="/cart"
            className="nav-cart glass"
            aria-label={`Cart, ${cartCount} items`}
            inert={search !== "in" || open}
          >
            <span className="header-cart-icon" aria-hidden="true">
              <CartIcon />
              <span className="header-cart-count">{cartCount > 99 ? "99+" : cartCount}</span>
            </span>
          </Link>
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
