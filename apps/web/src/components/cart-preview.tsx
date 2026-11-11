"use client"

import { useEffect, useState, useTransition, type CSSProperties } from "react"
import Link from "next/link"
import { updateCart } from "@/app/(shop)/cart/actions"
import type { CartSummary } from "@/lib/cart"
import { formatMoney } from "@/lib/money"

const shownLines = 4

export function CartPreview({
  id,
  cart,
  currency,
  open,
  onMouseEnter,
  onMouseLeave,
}: {
  id: string
  cart: CartSummary
  currency: string
  open: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const [removing, setRemoving] = useState<string[]>([])
  const [, startTransition] = useTransition()
  const lines = cart.lines.slice(0, shownLines)
  const hidden = cart.lines.length - lines.length

  useEffect(() => {
    setRemoving((ids) => {
      const kept = ids.filter((id) => cart.lines.some((line) => line.id === id))
      return kept.length === ids.length ? ids : kept
    })
  }, [cart.lines])

  const remove = (itemId: string) => {
    setRemoving((ids) => [...ids, itemId])
    const data = new FormData()
    data.set("itemId", itemId)
    data.set("quantity", "0")
    startTransition(async () => {
      try {
        await updateCart(data)
      } catch (error) {
        console.error("Could not remove cart item", error)
        setRemoving((ids) => ids.filter((id) => id !== itemId))
      }
    })
  }
  return (
    <div
      id={id}
      className="cart-preview"
      data-open={open ? "" : undefined}
      aria-hidden={!open}
      inert={!open}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="cart-preview-panel glass">
        <div className="cart-preview-head">
          <span className="cart-preview-heading">Cart</span>
          {cart.count > 0 ? <span className="cart-preview-count">{cart.count} {cart.count === 1 ? "item" : "items"}</span> : null}
        </div>
        {lines.length === 0 ? (
          <div className="cart-preview-empty">
            <p>Your cart is empty.</p>
            <Link href="/search" className="btn">Browse parts</Link>
          </div>
        ) : (
          <>
            <ul className="cart-preview-lines">
              {lines.map((line, index) => (
                <li
                  key={line.id}
                  className="cart-preview-line"
                  data-removing={removing.includes(line.id) ? "" : undefined}
                  style={{ "--i": index } as CSSProperties}
                >
                  <div className="cart-preview-row">
                    <Link href={`/products/${line.productHandle}`} className="cart-preview-item">
                      <span className="cart-preview-thumb">
                        {line.imageUrl ? <img src={line.imageUrl} alt="" /> : null}
                        {line.quantity > 1 ? <span className="cart-preview-qty">{line.quantity}</span> : null}
                      </span>
                      <span className="cart-preview-text">
                        <span className="cart-preview-title">{line.productTitle}</span>
                        {line.variantTitle ? <span className="cart-preview-variant">{line.variantTitle}</span> : null}
                      </span>
                      <span className="cart-preview-price">{formatMoney(line.unitPriceCents * line.quantity, currency)}</span>
                    </Link>
                    <button
                      type="button"
                      className="cart-preview-remove"
                      aria-label={`Remove ${line.productTitle} from cart`}
                      title="Remove"
                      disabled={removing.includes(line.id)}
                      onClick={() => remove(line.id)}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {hidden > 0 ? (
              <p className="cart-preview-more">+ {hidden} more {hidden === 1 ? "part" : "parts"} in your cart</p>
            ) : null}
            <div className="cart-preview-foot">
              <p className="cart-preview-subtotal">
                <span>Subtotal</span>
                <span>{formatMoney(cart.subtotalCents, currency)}</span>
              </p>
              <div className="cart-preview-actions">
                <Link href="/cart" className="btn-ghost">View cart</Link>
                <Link href="/checkout" className="btn">Checkout</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
