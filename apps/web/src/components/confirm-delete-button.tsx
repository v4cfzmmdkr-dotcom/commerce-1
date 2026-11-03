"use client"

import { useFormStatus } from "react-dom"

export function ConfirmDeleteButton({ message, label = "Delete" }: { message: string, label?: string }) {
  const status = useFormStatus()
  return (
    <button
      className="btn-ghost btn-tint-red"
      type="submit"
      disabled={status.pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault()
      }}
    >
      {status.pending ? "Deleting" : label}
    </button>
  )
}
