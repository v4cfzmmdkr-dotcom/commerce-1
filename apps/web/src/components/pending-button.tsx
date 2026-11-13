"use client"

import { useFormStatus } from "react-dom"

export function PendingButton({ children, pendingText, className = "btn" }: { children: React.ReactNode, pendingText: string, className?: string }) {
  const status = useFormStatus()
  return (
    <button className={className} type="submit" disabled={status.pending} aria-live="polite">
      {status.pending ? pendingText : children}
    </button>
  )
}
