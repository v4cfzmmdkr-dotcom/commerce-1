"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

export function BrandCarousel({ label, children }: { label: string, children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  useEffect(() => {
    const element = track.current
    if (!element) return
    const update = () => {
      const max = element.scrollWidth - element.clientWidth
      const filled = element.scrollWidth ? (element.scrollLeft + element.clientWidth) / element.scrollWidth : 1
      progress.current?.style.setProperty("--progress", String(Math.min(1, Math.max(0, filled))))
      setEdges({ start: element.scrollLeft <= 4, end: element.scrollLeft >= max - 4 })
    }
    update()
    element.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      element.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [])

  function page(direction: 1 | -1) {
    const element = track.current
    if (!element) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" })
  }

  return (
    <div className="brand-carousel" data-start={edges.start || undefined} data-end={edges.end || undefined}>
      <div ref={track} className="brand-carousel-track" role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
      <div ref={progress} className="brand-carousel-progress" aria-hidden="true">
        <span />
      </div>
      <button
        type="button"
        className="brand-carousel-nav brand-carousel-prev glass"
        aria-label="Previous brands"
        tabIndex={-1}
        disabled={edges.start}
        onClick={() => page(-1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
      </button>
      <button
        type="button"
        className="brand-carousel-nav brand-carousel-next glass"
        aria-label="More brands"
        tabIndex={-1}
        disabled={edges.end}
        onClick={() => page(1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
      </button>
    </div>
  )
}
