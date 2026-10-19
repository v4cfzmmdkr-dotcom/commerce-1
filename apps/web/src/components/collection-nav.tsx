"use client"

import { useEffect, useRef } from "react"

export function CollectionNav({ children }: { children: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null)

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

    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [])

  return (
    <nav className="collection-nav" aria-label="Collections">
      <div ref={scroller} className="collection-nav-scroller">
        {children}
      </div>
    </nav>
  )
}
