"use client"

import { useState } from "react"
import { downloadImageStep } from "@/app/admin/actions"

export function ImageDownload({ pending }: { pending: number }) {
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(pending)
  const [copied, setCopied] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  const run = async () => {
    setRunning(true)
    setMessage(null)
    let total = 0
    try {
      for (;;) {
        const step = await downloadImageStep()
        total += step.stored
        setCopied(total)
        setRemaining(step.pending)
        if (step.pending === 0) {
          setMessage("All images are now stored in this shop.")
          break
        }
        if (step.stored === 0) {
          setMessage(`${step.pending} images could not be copied${step.error ? `: ${step.error}` : ""}. Try again later.`)
          break
        }
      }
    } catch {
      setMessage("The download stopped. Press the button again to continue.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="grid gap-2">
      <button className="btn w-fit" type="button" onClick={run} disabled={running || remaining === 0}>
        {running ? "Downloading images..." : "Download all images"}
      </button>
      <p className="text-sm" aria-live="polite">
        {running || copied > 0 ? `Copied ${copied}. ${remaining} still on Shopify.` : null}
        {message ? ` ${message}` : null}
      </p>
    </div>
  )
}
