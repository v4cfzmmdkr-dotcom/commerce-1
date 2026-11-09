"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

function loopWidth(element: HTMLElement) {
  const set = element.querySelector<HTMLElement>(":scope > .brand-carousel-set")
  if (!set) return 0
  const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0
  return set.offsetWidth + gap
}

export function BrandCarousel({ label, children }: { label: string, children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const stopAuto = useRef<() => void>(() => {})
  const wrapping = useRef(false)
  const [repeat, setRepeat] = useState(false)
  const [edges, setEdges] = useState({ start: true, end: true })

  useEffect(() => {
    const element = track.current
    if (!element) return
    const update = () => {
      if (wrapping.current) return
      const loop = loopWidth(element)
      const set = element.querySelector<HTMLElement>(":scope > .brand-carousel-set")
      const overflows = !!set && set.offsetWidth > element.clientWidth + 1
      const repeats = element.querySelectorAll(":scope > .brand-carousel-set").length > 1
      setRepeat((current) => (current === overflows ? current : overflows))
      if (repeats && overflows && loop > 1 && element.scrollLeft >= loop) {
        wrapping.current = true
        requestAnimationFrame(() => {
          const distance = loopWidth(element)
          if (distance > 1 && element.scrollLeft >= distance) element.scrollLeft %= distance
          wrapping.current = false
        })
      }
      const pos = overflows && loop > 1 ? (element.scrollLeft % loop) / loop : 1
      progress.current?.style.setProperty("--progress", String(Math.min(1, Math.max(0, pos))))
      const parked = !overflows
      setEdges((current) => (current.start === parked && current.end === parked ? current : { start: parked, end: parked }))
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

  useEffect(() => {
    const element = track.current
    const root = element?.parentElement
    if (!element || !root) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (reduce.matches) return

    let frame = 0
    let stopped = false
    let paused = false
    let last = 0
    let position = element.scrollLeft
    const speed = 22

    const stop = () => {
      stopped = true
      element.removeAttribute("data-auto")
    }
    stopAuto.current = stop

    const tick = (now: number) => {
      if (stopped) return
      if (!last) last = now
      const dt = Math.min(now - last, 48)
      last = now
      const repeats = element.querySelectorAll(":scope > .brand-carousel-set").length > 1
      const loop = loopWidth(element)
      if (!paused && repeats && loop > 1) {
        position += speed * dt / 1000
        if (position >= loop) position %= loop
        element.scrollLeft = position
      }
      frame = requestAnimationFrame(tick)
    }

    element.setAttribute("data-auto", "")
    frame = requestAnimationFrame(tick)

    const hover = window.matchMedia("(hover: hover) and (pointer: fine)")
    const pause = () => { paused = true }
    const resume = () => {
      paused = false
      position = element.scrollLeft
      last = 0
    }
    const onHoverChange = () => {
      if (!hover.matches) {
        root.removeEventListener("pointerenter", pause)
        root.removeEventListener("pointerleave", resume)
        paused = false
      }
    }
    if (hover.matches) {
      root.addEventListener("pointerenter", pause)
      root.addEventListener("pointerleave", resume)
    }
    hover.addEventListener("change", onHoverChange)
    const openBackward = (incoming = 0) => {
      const loop = loopWidth(element)
      const repeats = element.querySelectorAll(":scope > .brand-carousel-set").length > 1
      if (!repeats || loop <= 1) return
      const next = element.scrollLeft + incoming
      if (element.scrollLeft >= 1 && next >= 1) return
      wrapping.current = true
      element.scrollLeft += loop
      wrapping.current = false
    }
    const stopAndOpen = () => {
      stop()
      openBackward()
    }
    const stopWheel = (event: WheelEvent) => {
      stop()
      const horizontal = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : 0
      if (horizontal < 0) openBackward(horizontal)
    }
    element.addEventListener("pointerdown", stopAndOpen)
    element.addEventListener("wheel", stopWheel, { passive: true })
    element.addEventListener("keydown", stop)
    root.addEventListener("pointerdown", stop)
    reduce.addEventListener("change", stop)

    return () => {
      cancelAnimationFrame(frame)
      element.removeAttribute("data-auto")
      hover.removeEventListener("change", onHoverChange)
      root.removeEventListener("pointerenter", pause)
      root.removeEventListener("pointerleave", resume)
      element.removeEventListener("pointerdown", stopAndOpen)
      element.removeEventListener("wheel", stopWheel)
      element.removeEventListener("keydown", stop)
      root.removeEventListener("pointerdown", stop)
      reduce.removeEventListener("change", stop)
    }
  }, [])

  function page(direction: 1 | -1) {
    const element = track.current
    if (!element) return
    stopAuto.current()
    const distance = direction * element.clientWidth * 0.85
    const loop = loopWidth(element)
    let target = element.scrollLeft + distance
    const wraps = loop > 1 && (target >= loop || target < 0)
    if (wraps) target = ((target % loop) + loop) % loop
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollTo({ left: target, behavior: wraps || reduce ? "auto" : "smooth" })
  }

  return (
    <div className="brand-carousel" data-start={edges.start || undefined} data-end={edges.end || undefined}>
      <div ref={track} className="brand-carousel-track" data-loop={repeat || undefined} role="region" aria-label={label} tabIndex={0}>
        <div className="brand-carousel-set">{children}</div>
        {repeat ? <div className="brand-carousel-set" aria-hidden="true" inert>{children}</div> : null}
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
