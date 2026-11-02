"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

export function CollectionNav({ links }: { links: Array<{ href: string, label: string }> }) {
  const scroller = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

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

  return (
    <nav className="collection-nav" aria-label="Collections">
      <div className="collection-nav-glass glass">
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
    </nav>
  )
}
