"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

export function CollectionNav({ links }: { links: Array<{ href: string, label: string }> }) {
  const scroller = useRef<HTMLDivElement>(null)
  const searchForm = useRef<HTMLFormElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const [search, setSearch] = useState<"in" | "out" | null>(null)
  const [open, setOpen] = useState(false)

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
        form.style.setProperty("--from-x", `${clamp(from.right - to.right, 160)}px`)
        form.style.setProperty("--from-y", `${clamp(from.top - to.top, 120)}px`)
        form.style.setProperty("--from-w", `${Math.min(from.width, to.width)}px`)
        form.style.setProperty("--from-h", `${from.height}px`)
      }
      const hidden = !entry.isIntersecting && entry.boundingClientRect.top < 0
      setSearch((current) => (hidden ? "in" : current ? "out" : null))
    })
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
      if (!searchForm.current?.contains(event.target as Node)) setOpen(false)
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

  return (
    <nav
      className="collection-nav"
      aria-label="Collections"
      data-search={search ?? undefined}
      data-search-open={open ? "" : undefined}
    >
      <div className="collection-nav-row">
        <div className="collection-nav-glass glass" inert={open}>
          <div ref={scroller} className="collection-nav-scroller">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="collection-nav-link"
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="nav-search-slot" />
        <form ref={searchForm} action="/search" role="search" className="nav-search glass" inert={search !== "in"}>
          <button
            className="nav-search-button"
            type={open ? "submit" : "button"}
            aria-label={open ? "Search" : "Open search"}
            aria-expanded={open}
            onClick={() => setOpen(true)}
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
          />
          <button className="nav-search-close" type="button" aria-label="Close search" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" /></svg>
          </button>
        </form>
      </div>
    </nav>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.24 4.24-1.41 1.42-4.25-4.25A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" />
    </svg>
  )
}
