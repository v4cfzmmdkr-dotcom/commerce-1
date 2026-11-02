"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

type Choice = "accepted" | "declined"

const storageKey = "np_cookie_consent"
const changeEvent = "np-cookie-consent"

function readChoice(): Choice | null {
  try {
    const value = window.localStorage.getItem(storageKey)
    return value === "accepted" || value === "declined" ? value : null
  } catch {
    return null
  }
}

function saveChoice(choice: Choice) {
  try {
    window.localStorage.setItem(storageKey, choice)
  } catch {}
  window.dispatchEvent(new Event(changeEvent))
}

function useChoice() {
  const [state, setState] = useState<{ ready: boolean; choice: Choice | null }>({ ready: false, choice: null })
  useEffect(() => {
    const sync = () => setState({ ready: true, choice: readChoice() })
    sync()
    window.addEventListener(changeEvent, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(changeEvent, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])
  return state
}

export function CookieConsent() {
  const { ready, choice } = useChoice()
  if (!ready) return null
  if (choice === "accepted") return <><Analytics /><SpeedInsights /></>
  if (choice === "declined") return null
  return (
    <div className="cookie-banner" role="region" aria-label="Cookie notice">
      <p className="text-sm">
        We use essential cookies to keep your cart and checkout working. With your OK, we also measure visits and page speed
        to improve the shop. <Link className="underline underline-offset-2" href="/cookies">Learn more</Link>
      </p>
      <div className="cookie-banner-actions">
        <button type="button" className="btn-ghost" onClick={() => saveChoice("declined")}>Decline</button>
        <button type="button" className="btn" onClick={() => saveChoice("accepted")}>Accept</button>
      </div>
    </div>
  )
}

export function CookieChoice() {
  const { ready, choice } = useChoice()
  if (!ready) return null
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <p className="text-sm">
        {choice === "accepted" ? "You have accepted analytics." : choice === "declined" ? "You have declined analytics." : "You have not chosen yet."}
      </p>
      <button type="button" className="btn-ghost" disabled={choice === "declined"} onClick={() => saveChoice("declined")}>Decline</button>
      <button type="button" className="btn" disabled={choice === "accepted"} onClick={() => saveChoice("accepted")}>Accept</button>
    </div>
  )
}
