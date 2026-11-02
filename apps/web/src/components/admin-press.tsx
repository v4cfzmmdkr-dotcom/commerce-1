"use client"

import { useEffect } from "react"

const pressable = "button, a[href], summary, [role='button'], input[type='submit'], input[type='button']"
const minimumHold = 160

// Mirrors :active as data-pressed, held long enough that a quick mouse click still shows the recess.
export function AdminPress() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".admin-shell")
    if (!root) return
    let pressed: { element: HTMLElement, since: number } | null = null
    let timer: number | undefined

    const press = (target: EventTarget | null) => {
      const element = target instanceof Element ? target.closest<HTMLElement>(pressable) : null
      if (!element || !root.contains(element) || element.matches(":disabled, [aria-disabled='true']")) return
      window.clearTimeout(timer)
      pressed?.element.removeAttribute("data-pressed")
      element.setAttribute("data-pressed", "")
      pressed = { element, since: performance.now() }
    }

    const release = () => {
      if (!pressed) return
      const { element, since } = pressed
      pressed = null
      timer = window.setTimeout(
        () => element.removeAttribute("data-pressed"),
        Math.max(0, minimumHold - (performance.now() - since)),
      )
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0) press(event.target)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.repeat && (event.key === "Enter" || event.key === " ")) press(event.target)
    }

    root.addEventListener("pointerdown", onPointerDown)
    root.addEventListener("keydown", onKeyDown)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    window.addEventListener("keyup", release)
    window.addEventListener("dragstart", release)
    return () => {
      window.clearTimeout(timer)
      root.removeEventListener("pointerdown", onPointerDown)
      root.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
      window.removeEventListener("keyup", release)
      window.removeEventListener("dragstart", release)
    }
  }, [])

  return null
}
