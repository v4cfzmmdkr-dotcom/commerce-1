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

const allowed = new Set(["au", "nz"])

export function addressFromPhoton(feature: {
  geometry?: { coordinates?: number[] }
  properties?: PhotonProperties
}): ParsedAddress | null {
  const properties = feature.properties ?? {}
  const country = (properties.countrycode || "").toUpperCase()
  if (!allowed.has(country.toLowerCase())) return null
  const [lng, lat] = feature.geometry?.coordinates ?? []
  if (typeof lat !== "number" || typeof lng !== "number") return null
  const street = [properties.housenumber, properties.street].filter(Boolean).join(" ")
  const line1 = street || properties.name || ""
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
