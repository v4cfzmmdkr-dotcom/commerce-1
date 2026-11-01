import { NextResponse } from "next/server"
import { addressFromPhoton, type PhotonProperties } from "@/lib/photon-address"

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
const newZealand = "166.0,-47.5,179.0,-34.0"

async function search(query: string) {
  const q = encodeURIComponent(query)
  const [au, nz] = await Promise.all([
    photon(`/api/?q=${q}&limit=6&lang=en&bbox=${australia}`),
    photon(`/api/?q=${q}&limit=3&lang=en&bbox=${newZealand}`).catch(() => ({ features: [] })),
  ])
  return { features: [...(au.features ?? []), ...(nz.features ?? [])] }
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
    const seen = new Set<string>()
    const results = (data.features ?? [])
      .map(addressFromPhoton)
      .filter((item) => item !== null)
      .filter((item) => !seen.has(item.label) && seen.add(item.label))
      .slice(0, 8)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: "Address lookup is unavailable" }, { status: 502 })
  }
}
