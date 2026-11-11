"use client"

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { addToCart } from "@/app/(shop)/cart/actions"
import { formatMoney, isPurchasable } from "@/lib/money"
import { defaultMaterial, materialOptions, variantMaterial } from "@/lib/product-options"
import type { PublicVariant } from "@/lib/catalog"

const payLaterMaxCents = 200000

type Slot = 0 | 1 | 2
type Values = [string, string, string]

const valueKeys = ["option1Value", "option2Value", "option3Value"] as const
const nameKeys = ["option1Name", "option2Name", "option3Name"] as const

function SubmitButton({ disabled, label }: { disabled: boolean, label: string }) {
  const pending = useFormStatus()
  return (
    <button className="btn w-full" type="submit" disabled={disabled || pending.pending}>
      {pending.pending ? "Adding…" : label}
    </button>
  )
}

function valuesOf(variant: PublicVariant): Values {
  return [variant.option1Value, variant.option2Value, variant.option3Value]
}

function optionValues(variants: PublicVariant[], slot: Slot) {
  return Array.from(new Set(variants.map((variant) => variant[valueKeys[slot]]).filter((value) => value && value.toLowerCase() !== "default title")))
}

function kindOf(name: string) {
  const lower = name.trim().toLowerCase()
  if (lower === "colour" || lower === "color") return "colour" as const
  if (lower === "material") return "material" as const
  return "other" as const
}

export function PurchaseBox({
  title,
  variants,
  currency,
  colours,
  initialVariantId,
  freeShippingFromCents,
  dispatchBy,
  returnDays,
}: {
  title: string
  variants: PublicVariant[]
  currency: string
  colours: Array<{ name: string, hex: string }>
  initialVariantId?: string
  freeShippingFromCents: number | null
  dispatchBy: string
  returnDays: number
}) {
  const formId = useId()
  const submitRef = useRef<HTMLDivElement>(null)
  const [barVisible, setBarVisible] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const requested = variants.find((variant) => variant.id === initialVariantId)
  const isDefaultMaterial = (variant: PublicVariant) => {
    const material = variantMaterial(variant)
    return !material || material.toLowerCase() === defaultMaterial.toLowerCase()
  }
  const initial = requested
    ?? variants.find((variant) => isPurchasable(variant) && isDefaultMaterial(variant))
    ?? variants.find((variant) => isPurchasable(variant))
    ?? variants[0]
  const [chosen, setChosen] = useState<Values>(initial ? valuesOf(initial) : ["", "", ""])
  const [state, action] = useActionState(addToCart, null)
  const groups = useMemo(() => {
    const order = { colour: 0, other: 1, material: 2 }
    return ([0, 1, 2] as const)
      .map((slot) => {
        const label = variants.find((variant) => variant[nameKeys[slot]])?.[nameKeys[slot]] || "Option"
        const kind = kindOf(label)
        const values = optionValues(variants, slot)
        if (kind === "material") {
          const rank = (value: string) => {
            const index = materialOptions.findIndex((material) => material.name.toLowerCase() === value.toLowerCase())
            return index === -1 ? materialOptions.length : index
          }
          values.sort((left, right) => rank(left) - rank(right))
        }
        if (kind === "colour") {
          const first = ["black", "white"]
          const rank = (value: string) => {
            const lower = value.toLowerCase()
            if (first.includes(lower)) return first.indexOf(lower)
            const index = colours.findIndex((colour) => colour.name.toLowerCase() === lower)
            return first.length + (index === -1 ? colours.length : index)
          }
          values.sort((left, right) => rank(left) - rank(right))
        }
        return { slot, label, kind, values }
      })
      .filter((group) => group.values.length > 0)
      .sort((left, right) => order[left.kind] - order[right.kind])
  }, [variants, colours])
  const active = groups.map((group) => group.slot)
  const matches = (variant: PublicVariant, values: Values, skip?: Slot) =>
    active.every((slot) => slot === skip || variant[valueKeys[slot]] === values[slot])
  const selected = variants.find((variant) => matches(variant, chosen)) ?? null
  const purchasable = selected ? isPurchasable(selected) : false

  useEffect(() => {
    const button = submitRef.current
    const footer = document.querySelector(".site-footer")
    if (!button) return
    const seen = new Map<Element, boolean>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target, entry.isIntersecting)
      setBarVisible(!seen.get(button) && !(footer && seen.get(footer)))
    })
    observer.observe(button)
    if (footer) observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  function choose(slot: Slot, value: string) {
    const next: Values = [...chosen]
    next[slot] = value
    const exact = variants.find((variant) => matches(variant, next))
    if (exact) {
      setChosen(valuesOf(exact))
      return
    }
    const score = (variant: PublicVariant) =>
      active.filter((other) => variant[valueKeys[other]] === chosen[other]).length * 2 + (isPurchasable(variant) ? 1 : 0)
    const closest = variants
      .filter((variant) => variant[valueKeys[slot]] === value)
      .sort((left, right) => score(right) - score(left))[0]
    if (closest) setChosen(valuesOf(closest))
  }

  const offered = (slot: Slot, value: string) => {
    const next: Values = [...chosen]
    next[slot] = value
    return variants.some((variant) => matches(variant, next))
  }

  const materialGroup = groups.find((group) => group.kind === "material")
  const lockedColour = (slot: Slot, colour: string) => {
    if (!materialGroup) return false
    const material = chosen[materialGroup.slot]
    return !variants.some((variant) => variant[valueKeys[slot]] === colour && variant[valueKeys[materialGroup.slot]] === material)
  }

  const priceCents = selected?.priceCents ?? 0
  const lineCents = priceCents * quantity
  const shipsFree = freeShippingFromCents != null && lineCents >= freeShippingFromCents
  const buttonLabel = purchasable ? "Add to cart" : selected ? "Sold out" : "Unavailable"

  return (
    <form id={formId} action={action} className="grid gap-8">
      {selected ? <input type="hidden" name="variantId" value={selected.id} /> : null}
      {groups.map((group) => {
        const value = chosen[group.slot]
        if (group.kind === "colour") {
          return (
            <ColourGroup
              key={group.slot}
              label={group.label}
              value={value}
              values={group.values}
              colours={colours}
              offered={(item) => offered(group.slot, item)}
              locked={(item) => lockedColour(group.slot, item)}
              material={materialGroup ? chosen[materialGroup.slot] : ""}
              onChange={(item) => choose(group.slot, item)}
            />
          )
        }
        const note = group.kind === "material" ? materialOptions.find((material) => material.name === value)?.note : undefined
        return (
          <OptionGroup
            key={group.slot}
            label={group.label}
            value={value}
            values={group.values}
            note={note}
            offered={(item) => offered(group.slot, item)}
            onChange={(item) => choose(group.slot, item)}
          />
        )
      })}
      <div>
        <p className="text-2xl leading-none">{selected ? formatMoney(priceCents, currency) : "Unavailable"}</p>
        {selected && priceCents > 0 && priceCents <= payLaterMaxCents ? (
          <p className="pay-later">
            or 4 interest-free payments of {formatMoney(Math.round(priceCents / 4), currency)} with Afterpay
          </p>
        ) : null}
      </div>
      <div className="grid gap-4">
        <label className="label max-w-28">
          Qty
          <input
            className="field normal-case"
            name="quantity"
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
          />
        </label>
        <div ref={submitRef}>
          <SubmitButton disabled={!purchasable} label={buttonLabel} />
        </div>
        {state?.error ? <p className="text-sm" role="alert">{state.error}</p> : null}
        {state?.ok ? (
          <div className="added-to-cart glass" role="status">
            <span className="added-to-cart-tick" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            </span>
            <span className="flex-1">Added to cart</span>
            <Link href="/cart" className="added-to-cart-link no-underline">View cart</Link>
            <Link href="/checkout" className="btn added-to-cart-checkout no-underline">Checkout</Link>
          </div>
        ) : null}
      </div>
      <ul className="buy-assurance glass">
        <li>
          <AssuranceIcon d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
          <span>
            <strong>Dispatched by {dispatchBy}</strong>
            <span>Printed to order and sent with Australia Post.</span>
          </span>
        </li>
        {freeShippingFromCents != null ? (
          <li>
            <AssuranceIcon d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
            <span>
              <strong>{shipsFree ? "Free shipping on this order" : `Free shipping over ${formatMoney(freeShippingFromCents, currency)}`}</strong>
              <span>{shipsFree ? "Your order qualifies for free standard delivery." : `Add ${formatMoney(freeShippingFromCents - lineCents, currency)} more to ship free.`}</span>
            </span>
          </li>
        ) : null}
        <li>
          <AssuranceIcon d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
          <span>
            <strong>{returnDays}-day returns</strong>
            <span>Not the right fit? <Link href="/returns">Send it back</Link> for a refund.</span>
          </span>
        </li>
        <li>
          <AssuranceIcon d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5zM9 12l2 2 4-4" />
          <span>
            <strong>Secure checkout</strong>
            <span>Apple Pay, Google Pay, cards, Afterpay and Zip.</span>
          </span>
        </li>
      </ul>
      <div className="buy-bar glass" data-visible={barVisible && purchasable ? "" : undefined} aria-hidden={!barVisible}>
        <span className="buy-bar-copy">
          <span className="buy-bar-title">{title}</span>
          <span className="buy-bar-price">{selected ? formatMoney(priceCents, currency) : ""}</span>
        </span>
        <button className="btn" type="submit" form={formId} disabled={!purchasable} tabIndex={barVisible ? 0 : -1}>
          {buttonLabel}
        </button>
      </div>
    </form>
  )
}

function AssuranceIcon({ d }: { d: string }) {
  return (
    <svg className="buy-assurance-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function ColourGroup({
  label,
  value,
  values,
  colours,
  offered,
  locked,
  material,
  onChange,
}: {
  label: string
  value: string
  values: string[]
  colours: Array<{ name: string, hex: string }>
  offered: (value: string) => boolean
  locked: (value: string) => boolean
  material: string
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 text-xs uppercase tracking-wide">
        {label}<span className="option-current">{value}</span>
      </legend>
      <div className="swatches">
        {values.map((item) => {
          const hex = colours.find((colour) => colour.name.toLowerCase() === item.toLowerCase())?.hex ?? "#c7c7cc"
          const isLocked = locked(item)
          const name = isLocked ? `${item}, not available in ${material}` : item
          return (
            <button
              key={item}
              type="button"
              className="swatch"
              data-unavailable={offered(item) ? undefined : ""}
              disabled={isLocked}
              style={{ "--swatch": hex } as CSSProperties}
              onClick={() => onChange(item)}
              aria-pressed={item === value}
              aria-label={name}
              title={name}
            />
          )
        })}
      </div>
    </fieldset>
  )
}

function OptionGroup({
  label,
  value,
  values,
  note,
  offered,
  onChange,
}: {
  label: string
  value: string
  values: string[]
  note?: string
  offered: (value: string) => boolean
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 text-xs uppercase tracking-wide">{label}</legend>
      <div className="flex flex-wrap gap-3">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            className={item === value ? "btn" : "btn-ghost"}
            data-unavailable={offered(item) ? undefined : ""}
            onClick={() => onChange(item)}
            aria-pressed={item === value}
          >
            {item}
          </button>
        ))}
      </div>
      {note ? <p className="option-note">{note}</p> : null}
    </fieldset>
  )
}
