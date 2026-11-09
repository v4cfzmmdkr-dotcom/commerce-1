"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

function loopWidth(element: HTMLElement) {
  const set = element.querySelector<HTMLElement>(".brand-carousel-set")
  if (!set?.parentElement) return 0
  const gap = Number.parseFloat(getComputedStyle(set.parentElement).columnGap) || 0
  return set.offsetWidth + gap
}

export function BrandCarousel({ label, children }: { label: string, children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const stopAuto = useRef<() => void>(() => {})
  const wrapping = useRef(false)
  const gliding = useRef(false)
  const [repeat, setRepeat] = useState(false)
  const [edges, setEdges] = useState({ start: true, end: true })

  useEffect(() => {
    const element = track.current
    if (!element) return
    const update = () => {
      if (wrapping.current) return
      const loop = loopWidth(element)
      const set = element.querySelector<HTMLElement>(".brand-carousel-set")
      const overflows = !!set && set.offsetWidth > element.clientWidth + 1
      const repeats = element.querySelectorAll(".brand-carousel-set").length > 1
      setRepeat((current) => (current === overflows ? current : overflows))
      if (!gliding.current && repeats && overflows && loop > 1 && element.scrollLeft >= loop) {
        wrapping.current = true
        requestAnimationFrame(() => {
          const distance = loopWidth(element)
          if (distance > 1 && element.scrollLeft >= distance) element.scrollLeft %= distance
          wrapping.current = false
        })
      }
      if (!gliding.current) {
        const pos = overflows && loop > 1 ? (element.scrollLeft % loop) / loop : 1
        progress.current?.style.setProperty("--progress", String(Math.min(1, Math.max(0, pos))))
      }
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
    let driving = false
    let pointerDown = false
    let suppress = 0
    let resumeTimer = 0
    let last = 0
    let position = element.scrollLeft
    const speed = 22

    const moverOf = () => element.querySelector<HTMLElement>(".brand-carousel-mover")
    const arm = () => {
      suppress += 1
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { suppress -= 1 })
      })
    }
    const paint = () => {
      const mover = moverOf()
      if (!mover) return
      const loop = loopWidth(element)
      if (loop > 1) position = ((position % loop) + loop) % loop
      mover.style.transform = `translate3d(${-position}px, 0, 0)`
      const ratio = loop > 1 ? position / loop : 1
      progress.current?.style.setProperty("--progress", String(Math.min(1, Math.max(0, ratio))))
    }
    const settle = () => {
      const mover = moverOf()
      if (!gliding.current || !mover) return
      const loop = loopWidth(element)
      const left = loop > 1 ? ((position % loop) + loop) % loop : position
      gliding.current = false
      mover.style.transform = ""
      arm()
      wrapping.current = true
      driving = true
      element.scrollLeft = left
      driving = false
      wrapping.current = false
      position = element.scrollLeft
    }
    const glide = () => {
      if (gliding.current || stopped || !moverOf()) return
      position = element.scrollLeft
      gliding.current = true
      arm()
      wrapping.current = true
      driving = true
      element.scrollLeft = 0
      driving = false
      wrapping.current = false
      paint()
    }
    const hold = () => {
      paused = true
      window.clearTimeout(resumeTimer)
      settle()
    }
    const scheduleResume = () => {
      window.clearTimeout(resumeTimer)
      if (stopped || pointerDown) return
      resumeTimer = window.setTimeout(() => {
        if (stopped || pointerDown) return
        position = element.scrollLeft
        paused = false
        last = 0
        glide()
      }, 700)
    }
    const stop = () => {
      settle()
      stopped = true
      paused = true
      window.clearTimeout(resumeTimer)
      element.removeAttribute("data-auto")
    }
    stopAuto.current = () => {
      hold()
      scheduleResume()
    }

    const tick = (now: number) => {
      if (stopped) return
      if (!last) last = now
      const dt = Math.min(now - last, 32)
      last = now
      const repeats = element.querySelectorAll(".brand-carousel-set").length > 1
      const loop = loopWidth(element)
      if (!paused && repeats && loop > 1) {
        if (!gliding.current) glide()
        position += speed * dt / 1000
        paint()
      }
      frame = requestAnimationFrame(tick)
    }

    element.setAttribute("data-auto", "")
    glide()
    frame = requestAnimationFrame(tick)

    const hover = window.matchMedia("(hover: hover) and (pointer: fine)")
    const onHoverChange = () => {
      if (!hover.matches) {
        root.removeEventListener("pointerenter", onEnter)
        root.removeEventListener("pointerleave", onLeave)
        scheduleResume()
      }
    }
    const onEnter = () => { hold() }
    const onLeave = () => { scheduleResume() }
    if (hover.matches) {
      root.addEventListener("pointerenter", onEnter)
      root.addEventListener("pointerleave", onLeave)
    }
    hover.addEventListener("change", onHoverChange)
    const openBackward = (incoming = 0) => {
      const loop = loopWidth(element)
      const repeats = element.querySelectorAll(".brand-carousel-set").length > 1
      if (!repeats || loop <= 1) return
      const next = element.scrollLeft + incoming
      if (element.scrollLeft >= 1 && next >= 1) return
      wrapping.current = true
      driving = true
      element.scrollLeft += loop
      driving = false
      wrapping.current = false
    }
    const onScroll = () => {
      if (driving || wrapping.current || stopped || suppress > 0 || gliding.current) return
      hold()
      scheduleResume()
    }
    const onPointerDown = () => {
      pointerDown = true
      hold()
      openBackward()
    }
    const onRootPointerDown = () => {
      pointerDown = true
      hold()
    }
    const onPointerUp = () => {
      if (!pointerDown) return
      pointerDown = false
      scheduleResume()
    }
    const onWheel = (event: WheelEvent) => {
      hold()
      const horizontal = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : 0
      if (horizontal < 0) openBackward(horizontal)
      scheduleResume()
    }
    const onKey = () => {
      hold()
      scheduleResume()
    }
    element.addEventListener("scroll", onScroll, { passive: true })
    element.addEventListener("pointerdown", onPointerDown)
    element.addEventListener("wheel", onWheel, { passive: true })
    element.addEventListener("keydown", onKey)
    root.addEventListener("pointerdown", onRootPointerDown)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    reduce.addEventListener("change", stop)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(resumeTimer)
      gliding.current = false
      const mover = moverOf()
      if (mover) mover.style.transform = ""
      element.removeAttribute("data-auto")
      hover.removeEventListener("change", onHoverChange)
      root.removeEventListener("pointerenter", onEnter)
      root.removeEventListener("pointerleave", onLeave)
      element.removeEventListener("scroll", onScroll)
      element.removeEventListener("pointerdown", onPointerDown)
      element.removeEventListener("wheel", onWheel)
      element.removeEventListener("keydown", onKey)
      root.removeEventListener("pointerdown", onRootPointerDown)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
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
        <div className="brand-carousel-mover">
          <div className="brand-carousel-set">{children}</div>
          {repeat ? <div className="brand-carousel-set" aria-hidden="true" inert>{children}</div> : null}
        </div>
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
