"use client"

import { useRef } from "react"
import { updateCart } from "@/app/(shop)/cart/actions"

export function CartQuantity({ itemId, quantity }: { itemId: string, quantity: number }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const save = (form: HTMLFormElement | null, wait: number) => {
    if (!form) return
    if (timer.current) clearTimeout(timer.current)
    if (wait <= 0) {
      form.requestSubmit()
      return
    }
    timer.current = setTimeout(() => form.requestSubmit(), wait)
  }

  const step = (delta: number) => {
    const input = inputRef.current
    if (!input) return
    const next = Math.min(99, Math.max(0, Number(input.value || 0) + delta))
    input.value = String(next)
    save(input.form, 0)
  }

  return (
    <form action={updateCart} key={quantity} className="flex items-center gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <button
        className="btn-ghost px-0"
        type="button"
        aria-label="Decrease quantity"
        onClick={() => step(-1)}
        disabled={quantity <= 1}
      >
        −
      </button>
      <label className="sr-only" htmlFor={`qty-${itemId}`}>Quantity</label>
      <input
        ref={inputRef}
        id={`qty-${itemId}`}
        className="field w-16 text-center"
        name="quantity"
        type="number"
        min={0}
        max={99}
        defaultValue={quantity}
        onChange={(event) => save(event.currentTarget.form, 400)}
        onBlur={(event) => save(event.currentTarget.form, 0)}
      />
      <button
        className="btn-ghost px-0"
        type="button"
        aria-label="Increase quantity"
        onClick={() => step(1)}
        disabled={quantity >= 99}
      >
        +
      </button>
    </form>
  )
}
