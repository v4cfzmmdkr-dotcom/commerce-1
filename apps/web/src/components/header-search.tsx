"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { LiveSearchResults, searchOptionId, useLiveSearch } from "@/components/live-search"

export function HeaderSearch() {
  const form = useRef<HTMLFormElement>(null)
  const pathname = usePathname()
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const search = useLiveSearch(query)
  const open = focused && search.term.length >= 2

  useEffect(() => {
    setFocused(false)
  }, [pathname])

  useEffect(() => {
    if (!focused) return
    const onPointerDown = (event: PointerEvent) => {
      if (!form.current?.contains(event.target as Node)) setFocused(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [focused])

  return (
    <form
      ref={form}
      action="/search"
      className="site-header-search"
      role="search"
      onSubmit={(event) => {
        if (!query.trim()) event.preventDefault()
      }}
    >
      <label className="sr-only" htmlFor="header-search">Search parts</label>
      <input
        id="header-search"
        name="q"
        placeholder="Search parts"
        className="field glass"
        enterKeyHint="search"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="header-search-results"
        aria-activedescendant={open && search.active >= 0 ? searchOptionId("header-search-results", search.active) : undefined}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setFocused(false)
            event.currentTarget.blur()
            return
          }
          search.onKeyDown(event)
        }}
      />
      {open ? <div className="search-backdrop" aria-hidden="true" /> : null}
      {open ? (
        <LiveSearchResults
          id="header-search-results"
          className="live-search-header"
          search={search}
          onPick={() => setFocused(false)}
        />
      ) : null}
    </form>
  )
}
