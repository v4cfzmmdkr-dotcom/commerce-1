"use client"

import { useEffect, useRef, useState, useTransition } from "react"

const actionWidth = 88

type Drag = { x: number, y: number, offset: number, axis: "x" | "y" | null }

export function SwipeToDelete({
  id,
  action,
  fields,
  fullSwipe = false,
  className,
  children,
}: {
  id?: string
  action: (formData: FormData) => Promise<void>
  fields: Record<string, string>
  fullSwipe?: boolean
  className?: string
  children: React.ReactNode
}) {
  const [offset, setOffsetState] = useState(0)
  const offsetRef = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [pending, startTransition] = useTransition()
  const rowRef = useRef<HTMLLIElement>(null)
  const drag = useRef<Drag | null>(null)
  const swiped = useRef(false)
  const open = offset !== 0 && !removing

  const setOffset = (value: number) => {
    offsetRef.current = value
    setOffsetState(value)
  }

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) setOffset(0)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  useEffect(() => {
    if (pending || !removing) return
    if (rowRef.current) rowRef.current.style.height = ""
    offsetRef.current = 0
    setOffsetState(0)
    setRemoving(false)
  }, [pending, removing])

  const remove = () => {
    const row = rowRef.current
    if (!row || removing) return
    setRemoving(true)
    setOffset(-row.offsetWidth)
    row.style.height = `${row.offsetHeight}px`
    requestAnimationFrame(() => {
      row.style.height = "0px"
    })
    const data = new FormData()
    for (const [key, value] of Object.entries(fields)) data.set(key, value)
    startTransition(async () => {
      try {
        await action(data)
      } catch (error) {
        console.error("Could not delete", error)
      }
    })
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (removing || (event.pointerType === "mouse" && event.button !== 0)) return
    if ((event.target as HTMLElement).closest("input, select, textarea")) return
    drag.current = { x: event.clientX, y: event.clientY, offset: offsetRef.current, axis: null }
    swiped.current = false
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return
      current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
      if (current.axis === "x") {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {}
        setDragging(true)
      }
    }
    if (current.axis !== "x") return
    swiped.current = true
    const width = event.currentTarget.offsetWidth
    const next = Math.min(0, Math.max(-width, current.offset + dx))
    setOffset(fullSwipe || next > -actionWidth ? next : -actionWidth + (next + actionWidth) * 0.3)
  }

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    drag.current = null
    if (current?.axis !== "x") return
    setDragging(false)
    const width = event.currentTarget.offsetWidth
    const distance = -offsetRef.current
    if (fullSwipe && distance > width * 0.5) remove()
    else setOffset(distance > actionWidth / 2 ? -actionWidth : 0)
  }

  const onClickCapture = (event: React.MouseEvent) => {
    if (!swiped.current && !open) return
    event.preventDefault()
    event.stopPropagation()
    swiped.current = false
    setOffset(0)
  }

  return (
    <li ref={rowRef} id={id} className={`swipe-row${offset !== 0 ? " is-open" : ""}${dragging ? " is-dragging" : ""}${removing ? " is-removing" : ""}`}>
      <button
        type="button"
        className="swipe-delete"
        style={{ width: Math.max(actionWidth, -offset) }}
        onClick={remove}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
      >
        Delete
      </button>
      <div
        className={`swipe-content ${className ?? ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </li>
  )
}
