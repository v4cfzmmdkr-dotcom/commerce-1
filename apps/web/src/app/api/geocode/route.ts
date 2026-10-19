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

export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.get("q")?.trim() ?? ""
  const lat = url.searchParams.get("lat")
  const lng = url.searchParams.get("lng")
  try {
    const data = lat && lng
      ? await photon(`/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`)
      : query.length >= 3
        ? await photon(`/api/?q=${encodeURIComponent(query)}&limit=6&lang=en&lat=-25.27&lon=133.77`)
        : { features: [] }
    const results = (data.features ?? []).map(addressFromPhoton).filter((item) => item !== null)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: "Address lookup is unavailable" }, { status: 502 })
  }
}
