import { NextResponse } from "next/server"
import { addressFromPhoton, parseStreetQuery, type PhotonProperties } from "@/lib/photon-address"

export const runtime = "nodejs"

const headers = {
  Accept: "application/json",
  "User-Agent": "NicheParts/1.0 (checkout address lookup)",
}

type PhotonResponse = {
  features?: Array<{
    geometry?: { coordinates?: number[] }
    properties?: PhotonProperties
  }>
}

async function photon(path: string) {
  const response = await fetch(`https://photon.komoot.io${path}`, { headers, cache: "no-store" })
  if (!response.ok) throw new Error("Address lookup failed")
  return response.json() as Promise<PhotonResponse>
}

const australia = "112.5,-44.0,154.0,-9.0"

function search(query: string) {
  return photon(`/api/?q=${encodeURIComponent(query)}&limit=15&lang=en&bbox=${australia}`)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.get("q")?.trim() ?? ""
  const lat = url.searchParams.get("lat")
  const lng = url.searchParams.get("lng")
  try {
    const data = lat && lng
      ? await photon(`/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`)
      : query.length >= 3
        ? await search(query)
        : { features: [] }
    const typed = lat && lng ? null : parseStreetQuery(query)
    const features = [...(data.features ?? [])]
    if (typed) features.sort((a, b) => Number(Boolean(b.properties?.housenumber)) - Number(Boolean(a.properties?.housenumber)))
    const seen = new Set<string>()
    const results = features
      .map((feature) => addressFromPhoton(feature, typed))
      .filter((item) => item !== null)
      .filter((item) => !seen.has(item.label) && seen.add(item.label))
      .slice(0, 8)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: "Address lookup is unavailable" }, { status: 502 })
  }
}
