"use client"

import { useMemo, useState } from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { addToCart } from "@/app/(shop)/cart/actions"
import { formatMoney, isPurchasable } from "@/lib/money"
import type { PublicVariant } from "@/lib/catalog"

function SubmitButton({ disabled, label }: { disabled: boolean, label: string }) {
  const pending = useFormStatus()
  return (
    <button className="btn w-full" type="submit" disabled={disabled || pending.pending}>
      {pending.pending ? "Adding…" : label}
    </button>
  )
}

function values(variants: PublicVariant[], key: "option1Value" | "option2Value" | "option3Value") {
  return Array.from(new Set(variants.map((variant) => variant[key]).filter((value) => value && value.toLowerCase() !== "default title")))
}

export function PurchaseBox({
  variants,
  currency,
}: {
  variants: PublicVariant[]
  currency: string
}) {
  const initial = variants.find((variant) => isPurchasable(variant)) ?? variants[0]
  const [option1, setOption1] = useState(initial?.option1Value ?? "")
  const [option2, setOption2] = useState(initial?.option2Value ?? "")
  const [option3, setOption3] = useState(initial?.option3Value ?? "")
  const [state, action] = useActionState(addToCart, null)
  const option1Values = values(variants, "option1Value")
  const option2Values = values(variants, "option2Value")
  const option3Values = values(variants, "option3Value")
  const selected = useMemo(() => {
    return variants.find((variant) => {
      if (option1Values.length && variant.option1Value !== option1) return false
      if (option2Values.length && variant.option2Value !== option2) return false
      if (option3Values.length && variant.option3Value !== option3) return false
      return true
    }) ?? null
  }, [option1, option1Values.length, option2, option2Values.length, option3, option3Values.length, variants])
  const purchasable = selected ? isPurchasable(selected) : false
  const names = {
    option1: variants.find((variant) => variant.option1Name)?.option1Name,
    option2: variants.find((variant) => variant.option2Name)?.option2Name,
    option3: variants.find((variant) => variant.option3Name)?.option3Name,
  }

  return (
    <form action={action} className="grid gap-4">
      {selected ? <input type="hidden" name="variantId" value={selected.id} /> : null}
      {option1Values.length > 0 ? (
        <OptionGroup label={names.option1 || "Option"} value={option1} values={option1Values} onChange={setOption1} />
      ) : null}
      {option2Values.length > 0 ? (
        <OptionGroup label={names.option2 || "Option"} value={option2} values={option2Values} onChange={setOption2} />
      ) : null}
      {option3Values.length > 0 ? (
        <OptionGroup label={names.option3 || "Option"} value={option3} values={option3Values} onChange={setOption3} />
      ) : null}
      <p className="text-2xl">{selected ? formatMoney(selected.priceCents, currency) : "Unavailable"}</p>
      {selected?.sku ? <p className="text-xs tracking-wide">SKU {selected.sku}</p> : null}
      <label className="label max-w-28">
        Qty
        <input className="field normal-case" name="quantity" type="number" min={1} max={99} defaultValue={1} />
      </label>
      <SubmitButton disabled={!purchasable} label={purchasable ? "Add to cart" : "Sold out"} />
      {state?.error ? <p className="text-sm" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm" role="status">Added to cart.</p> : null}
    </form>
  )
}

function OptionGroup({
  label,
  value,
  values,
  onChange,
}: {
  label: string
  value: string
  values: string[]
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs uppercase tracking-wide">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            className={item === value ? "btn" : "btn-ghost"}
            onClick={() => onChange(item)}
            aria-pressed={item === value}
          >
            {item}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
