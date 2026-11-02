"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type KeyboardEvent } from "react"

export type SearchHit = {
  handle: string
  title: string
  price: string
  imageUrl: string | null
  purchasable: boolean
}

type SearchState = { query: string, hits: SearchHit[], total: number }

export function useLiveSearch(query: string) {
  const router = useRouter()
  const [results, setResults] = useState<SearchState | null>(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const term = query.trim()

  useEffect(() => {
    setActive(-1)
    if (term.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        if (!response.ok) throw new Error("Search failed")
        const data = await response.json() as { results: SearchHit[], total: number }
        setResults({ query: term, hits: data.results, total: data.total })
      } catch {
        if (!controller.signal.aborted) setResults({ query: term, hits: [], total: 0 })
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 140)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [term])

  const hits = results?.hits ?? []
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!hits.length) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => (index + 1) % hits.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => (index <= 0 ? hits.length - 1 : index - 1))
    } else if (event.key === "Enter" && active >= 0 && hits[active]) {
      event.preventDefault()
      router.push(`/products/${hits[active].handle}`)
    }
  }

  return { term, results, loading, active, setActive, onKeyDown }
}

export function searchOptionId(listId: string, index: number) {
  return `${listId}-option-${index}`
}

export function LiveSearchResults({
  id,
  className,
  search,
  onPick,
}: {
  id: string
  className?: string
  search: ReturnType<typeof useLiveSearch>
  onPick?: () => void
}) {
  const { term, results, loading, active, setActive } = search
  const stale = loading || results?.query !== term
  return (
    <div
      className={`live-search glass ${className ?? ""}`}
      data-loading={stale ? "" : undefined}
      onPointerDown={(event) => event.preventDefault()}
    >
      {results && results.hits.length ? (
        <>
          <ul id={id} role="listbox" aria-label="Search suggestions" className="live-search-list">
            {results.hits.map((hit, index) => (
              <li key={hit.handle} role="presentation">
                <Link
                  id={searchOptionId(id, index)}
                  role="option"
                  aria-selected={index === active}
                  href={`/products/${hit.handle}`}
                  className="live-search-item"
                  tabIndex={-1}
                  onPointerEnter={() => setActive(index)}
                  onClick={onPick}
                >
                  <span className="live-search-thumb">
                    {hit.imageUrl ? <img src={hit.imageUrl} alt="" loading="lazy" /> : null}
                  </span>
                  <span className="live-search-text">
                    <span className="live-search-title"><Highlight text={hit.title} term={results.query} /></span>
                    <span className="live-search-price">{hit.purchasable ? hit.price : `${hit.price} · Sold out`}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/search?q=${encodeURIComponent(results.query)}`} className="live-search-all" tabIndex={-1} onClick={onPick}>
            {results.total > results.hits.length ? `See all ${results.total} results` : "Show in shop"}
          </Link>
        </>
      ) : (
        <p className="live-search-empty" role="status">
          {stale ? "Searching…" : `No parts found for “${results?.query ?? term}”`}
        </p>
      )}
    </div>
  )
}

function Highlight({ text, term }: { text: string, term: string }) {
  const index = text.toLowerCase().indexOf(term.toLowerCase())
  if (!term || index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  )
}
