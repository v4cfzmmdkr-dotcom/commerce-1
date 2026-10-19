"use client"

import { useEffect, useRef, useState } from "react"
import type { CircleMarker, Map as LeafletMap } from "leaflet"
import type { ParsedAddress } from "@/lib/photon-address"
import "leaflet/dist/leaflet.css"

export function AddressFinder({ onSelect }: { onSelect: (address: ParsedAddress) => void }) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<CircleMarker | null>(null)
  const leafletRef = useRef<typeof import("leaflet") | null>(null)
  const onSelectRef = useRef(onSelect)
  const skipSearch = useRef(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ParsedAddress[]>([])
  const [status, setStatus] = useState("")
  onSelectRef.current = onSelect

  const apply = (address: ParsedAddress) => {
    const map = mapRef.current
    const L = leafletRef.current
    onSelectRef.current(address)
    skipSearch.current = true
    setQuery(address.label)
    setResults([])
    setStatus("")
    if (!map || !L) return
    markerRef.current?.remove()
    markerRef.current = L.circleMarker([address.lat, address.lng], {
      radius: 8,
      color: "#111111",
      weight: 2,
      fillColor: "#111111",
      fillOpacity: 1,
    }).addTo(map)
    map.setView([address.lat, address.lng], 17)
  }

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      const L = await import("leaflet")
      if (cancelled || !mapEl.current || mapRef.current) return
      leafletRef.current = L
      const map = L.map(mapEl.current, { scrollWheelZoom: false, zoomControl: false }).setView([-25.27, 133.77], 4)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
        maxZoom: 19,
      }).addTo(map)
      map.on("click", async (event) => {
        try {
          const response = await fetch(`/api/geocode?lat=${event.latlng.lat}&lng=${event.latlng.lng}`)
          const data = await response.json() as { results?: ParsedAddress[] }
          const address = data.results?.[0]
          if (address) apply(address)
          else setStatus("No address found at that point.")
        } catch {
          setStatus("Address lookup is unavailable.")
        }
      })
      mapRef.current = map
    }
    start()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false
      return
    }
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
        const data = await response.json() as { results?: ParsedAddress[], error?: string }
        setResults(data.results ?? [])
        setStatus(data.error ?? "")
      } catch {
        setStatus("Address lookup is unavailable.")
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="grid gap-2">
      <label className="label">
        Find address
        <input
          className="field normal-case"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault()
          }}
          placeholder="Start typing a street address"
        />
      </label>
      {results.length > 0 ? (
        <ul className="grid gap-1 border border-[var(--border)] p-1" role="listbox">
          {results.map((item) => (
            <li key={`${item.lat}-${item.lng}-${item.label}`}>
              <button
                className="btn-ghost w-full justify-start px-3 text-left text-sm font-normal normal-case"
                type="button"
                onClick={() => apply(item)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="address-map-wrap">
        <div ref={mapEl} className="address-map" />
        <div className="address-map-zoom">
          <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>−</button>
        </div>
      </div>
      <p className="text-xs">Search, or tap the map. Map data from OpenStreetMap.</p>
      {status ? <p className="text-sm" role="status">{status}</p> : null}
    </div>
  )
}
