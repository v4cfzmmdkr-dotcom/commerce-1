"use client"

import { useMemo, useState, type CSSProperties } from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { addToCart } from "@/app/(shop)/cart/actions"
import { formatMoney, isPurchasable } from "@/lib/money"
import { materialOptions } from "@/lib/product-options"
import type { PublicVariant } from "@/lib/catalog"

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
  variants,
  currency,
  colours,
  initialVariantId,
}: {
  variants: PublicVariant[]
  currency: string
  colours: Array<{ name: string, hex: string }>
  initialVariantId?: string
}) {
  const requested = variants.find((variant) => variant.id === initialVariantId)
  const initial = requested ?? variants.find((variant) => isPurchasable(variant)) ?? variants[0]
  const [chosen, setChosen] = useState<Values>(initial ? valuesOf(initial) : ["", "", ""])
  const [state, action] = useActionState(addToCart, null)
  const groups = useMemo(() => {
    const order = { colour: 0, other: 1, material: 2 }
    return ([0, 1, 2] as const)
      .map((slot) => {
        const label = variants.find((variant) => variant[nameKeys[slot]])?.[nameKeys[slot]] || "Option"
        return { slot, label, kind: kindOf(label), values: optionValues(variants, slot) }
      })
      .filter((group) => group.values.length > 0)
      .sort((left, right) => order[left.kind] - order[right.kind])
  }, [variants])
  const active = groups.map((group) => group.slot)
  const matches = (variant: PublicVariant, values: Values, skip?: Slot) =>
    active.every((slot) => slot === skip || variant[valueKeys[slot]] === values[slot])
  const selected = variants.find((variant) => matches(variant, chosen)) ?? null
  const purchasable = selected ? isPurchasable(selected) : false

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

  return (
    <form action={action} className="grid gap-8">
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
      <p className="text-2xl leading-none">{selected ? formatMoney(selected.priceCents, currency) : "Unavailable"}</p>
      <div className="grid gap-4">
        <label className="label max-w-28">
          Qty
          <input className="field normal-case" name="quantity" type="number" min={1} max={99} defaultValue={1} />
        </label>
        <SubmitButton disabled={!purchasable} label={purchasable ? "Add to cart" : selected ? "Sold out" : "Unavailable"} />
        {state?.error ? <p className="text-sm" role="alert">{state.error}</p> : null}
        {state?.ok ? <p className="text-sm" role="status">Added to cart.</p> : null}
      </div>
    </form>
  )
}

function ColourGroup({
  label,
  value,
  values,
  colours,
  offered,
  onChange,
}: {
  label: string
  value: string
  values: string[]
  colours: Array<{ name: string, hex: string }>
  offered: (value: string) => boolean
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
          return (
            <button
              key={item}
              type="button"
              className="swatch"
              data-unavailable={offered(item) ? undefined : ""}
              style={{ "--swatch": hex } as CSSProperties}
              onClick={() => onChange(item)}
              aria-pressed={item === value}
              aria-label={item}
              title={item}
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
