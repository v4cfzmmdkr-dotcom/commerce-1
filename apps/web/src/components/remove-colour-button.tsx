"use client"

import { useTransition } from "react"
import { removeColour } from "@/app/admin/option-actions"

export function RemoveColourButton({ name }: { name: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      className="colour-chip-remove"
      aria-label={`Remove ${name}`}
      title={`Remove ${name}`}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault()
        const data = new FormData()
        data.set("name", name)
        startTransition(async () => {
          await removeColour(data)
        })
      }}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3 3l6 6M9 3l-6 6" />
      </svg>
    </button>
  )
}
