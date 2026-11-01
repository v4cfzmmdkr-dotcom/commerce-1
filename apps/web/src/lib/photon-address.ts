export type PhotonProperties = {
  name?: string
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  locality?: string
  district?: string
  county?: string
  state?: string
  country?: string
  countrycode?: string
  type?: string
}

export type ParsedAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postcode: string
  country: string
  lat: number
  lng: number
  label: string
}

export type StreetQuery = {
  number: string
  houseNumber: string
  street: string
}

// Matches "47 truro st", "47a truro st" and "3/47 truro st" (unit 3 at number 47).
export function parseStreetQuery(query: string): StreetQuery | null {
  const match = query.trim().match(/^((?:\d+[a-z]?\s*\/\s*)?(\d+[a-z]?))\s+([^\d\s].*)$/i)
  if (!match) return null
  return {
    number: match[1].replace(/\s+/g, ""),
    houseNumber: match[2].toLowerCase(),
    street: match[3].trim(),
  }
}

function sameStreet(name: string | undefined, typed: string) {
  const first = typed.toLowerCase().split(/\s+/)[0]
  const word = (name || "").toLowerCase().split(/\s+/)[0]
  return Boolean(first && word && word.startsWith(first))
}

export function addressFromPhoton(feature: {
  geometry?: { coordinates?: number[] }
  properties?: PhotonProperties
}, typed: StreetQuery | null = null): ParsedAddress | null {
  const properties = feature.properties ?? {}
  const country = (properties.countrycode || "").toUpperCase()
  if (country !== "AU") return null
  const [lng, lat] = feature.geometry?.coordinates ?? []
  if (typeof lat !== "number" || typeof lng !== "number") return null
  const streetName = properties.street || (properties.type === "street" ? properties.name : "") || ""
  let number = properties.housenumber || ""
  if (typed) {
    if (!sameStreet(streetName, typed.street)) return null
    if (properties.housenumber) {
      if (properties.housenumber.toLowerCase() !== typed.houseNumber) return null
    } else if (properties.type !== "street") {
      return null
    }
    number = typed.number
  }
  const line1 = [number, streetName].filter(Boolean).join(" ") || properties.name || ""
  const city = properties.city || properties.locality || properties.district || properties.county || ""
  const label = [line1, city, properties.state, properties.postcode, country].filter(Boolean).join(", ")
  return {
    line1,
    line2: "",
    city,
    state: properties.state || "",
    postcode: properties.postcode || "",
    country,
    lat,
    lng,
    label,
  }
}
