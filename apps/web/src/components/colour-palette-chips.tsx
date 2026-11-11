"use client"

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react"
import { RemoveColourButton } from "@/components/remove-colour-button"

type Colour = { name: string, hex: string, enabled: boolean }

const spring = "cubic-bezier(0.32, 1.25, 0.55, 1)"

export function ColourPaletteChips({ colours, name }: { colours: Colour[], name: string }) {
  const [order, setOrder] = useState(() => colours.map((colour) => colour.name))
  const [dragging, setDragging] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const orderRef = useRef(order)
  const before = useRef(new Map<HTMLElement, DOMRect>())
  const lastOver = useRef<string | null>(null)
  const refocus = useRef<string | null>(null)
  const byName = new Map(colours.map((colour) => [colour.name, colour]))

  const chipsInForm = () => [...(listRef.current?.closest("form")?.querySelectorAll<HTMLElement>("[data-colour]") ?? [])]

  useLayoutEffect(() => {
    orderRef.current = order
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    for (const chip of chipsInForm()) {
      chip.style.order = String(order.indexOf(chip.dataset.colour ?? ""))
      const from = before.current.get(chip)
      if (!from || still) continue
      const to = chip.getBoundingClientRect()
      const dx = from.left - to.left
      const dy = from.top - to.top
      if (dx || dy) chip.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: 420, easing: spring })
    }
    before.current.clear()
    if (refocus.current) {
      listRef.current?.querySelector<HTMLElement>(`[data-grip="${CSS.escape(refocus.current)}"]`)?.focus()
      refocus.current = null
    }
  }, [order])

  const move = (colour: string, to: number) => {
    const current = orderRef.current
    const from = current.indexOf(colour)
    if (from === -1 || to < 0 || to >= current.length || to === from) return
    before.current = new Map(chipsInForm().map((chip) => [chip, chip.getBoundingClientRect()]))
    const next = current.filter((item) => item !== colour)
    next.splice(to, 0, colour)
    orderRef.current = next
    setOrder(next)
  }

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, colour: string) => {
    if (event.pointerType === "mouse" && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    lastOver.current = colour
    setDragging(colour)
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return
    const over = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-palette-colour]")
    const target = over && listRef.current?.contains(over) ? over.dataset.paletteColour ?? null : null
    if (!target || target === dragging) {
      lastOver.current = target
      return
    }
    if (target === lastOver.current) return
    lastOver.current = target
    move(dragging, orderRef.current.indexOf(target))
  }

  const onPointerEnd = () => {
    setDragging(null)
    lastOver.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, colour: string) => {
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0
    if (!step) return
    event.preventDefault()
    refocus.current = colour
    move(colour, orderRef.current.indexOf(colour) + step)
  }

  return (
    <div ref={listRef} className="colour-chips" role="group" aria-label="Colours, drag to rearrange">
      <input type="hidden" name="colourOrder" value={JSON.stringify(order)} />
      {order.map((colourName, index) => {
        const colour = byName.get(colourName)
        if (!colour) return null
        return (
          <label
            key={colour.name}
            className="colour-chip"
            data-colour={colour.name}
            data-palette-colour={colour.name}
            data-dragging={dragging === colour.name || undefined}
          >
            <button
              type="button"
              className="colour-chip-grip"
              data-grip={colour.name}
              aria-label={`Move ${colour.name}, position ${index + 1} of ${order.length}. Use arrow keys to rearrange.`}
              title="Drag to rearrange"
              onPointerDown={(event) => onPointerDown(event, colour.name)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onClick={(event) => event.preventDefault()}
              onKeyDown={(event) => onKeyDown(event, colour.name)}
            >
              <svg viewBox="0 0 8 14" aria-hidden="true">
                <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
                <circle cx="2" cy="7" r="1.2" /><circle cx="6" cy="7" r="1.2" />
                <circle cx="2" cy="12" r="1.2" /><circle cx="6" cy="12" r="1.2" />
              </svg>
            </button>
            <input type="checkbox" name={name} value={colour.name} defaultChecked={colour.enabled} />
            <span className="colour-chip-dot" style={{ "--swatch": colour.hex } as CSSProperties} aria-hidden />
            {colour.name}
            <RemoveColourButton name={colour.name} />
          </label>
        )
      })}
    </div>
  )
}
