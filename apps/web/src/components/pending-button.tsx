"use client"

import { useFormStatus } from "react-dom"

export function PendingButton({ children, pendingText }: { children: React.ReactNode, pendingText: string }) {
  const status = useFormStatus()
  return (
    <button className="btn" type="submit" disabled={status.pending} aria-live="polite">
      {status.pending ? pendingText : children}
    </button>
  )
}
