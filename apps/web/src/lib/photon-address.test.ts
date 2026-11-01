import { describe, expect, it } from "vitest"
import { addressFromPhoton, parseStreetQuery } from "@/lib/photon-address"

const street = (name: string, city: string) => ({
  geometry: { coordinates: [152.85, -25.29] },
  properties: { type: "street", name, city, state: "Queensland", postcode: "4655", countrycode: "au" },
})

describe("parseStreetQuery", () => {
  it("reads the house number and street", () => {
    expect(parseStreetQuery("47 truro st")).toEqual({ number: "47", houseNumber: "47", street: "truro st" })
    expect(parseStreetQuery("3 / 47a truro st")).toEqual({ number: "3/47a", houseNumber: "47a", street: "truro st" })
  })

  it("ignores searches without a leading number", () => {
    expect(parseStreetQuery("truro st")).toBeNull()
    expect(parseStreetQuery("47")).toBeNull()
  })
})

describe("addressFromPhoton with a typed house number", () => {
  const typed = parseStreetQuery("47 truro st")

  it("adds the typed number to a matching street", () => {
    expect(addressFromPhoton(street("Truro Street", "Hervey Bay"), typed)?.label)
      .toBe("47 Truro Street, Hervey Bay, Queensland, 4655, AU")
  })

  it("keeps a unit prefix", () => {
    expect(addressFromPhoton(street("Truro Street", "Hervey Bay"), parseStreetQuery("3/47 truro st"))?.line1)
      .toBe("3/47 Truro Street")
  })

  it("drops other streets, places and house numbers", () => {
    expect(addressFromPhoton(street("St Kitts Road", "Truro"), typed)).toBeNull()
    expect(addressFromPhoton({
      geometry: { coordinates: [152.85, -25.29] },
      properties: { type: "other", name: "Truro Street Park", city: "Hervey Bay", countrycode: "au" },
    }, typed)).toBeNull()
    expect(addressFromPhoton({
      geometry: { coordinates: [151.2, -33.87] },
      properties: { type: "house", street: "Truro Street", housenumber: "474", city: "Sydney", countrycode: "au" },
    }, typed)).toBeNull()
  })

  it("keeps an exact house match", () => {
    expect(addressFromPhoton({
      geometry: { coordinates: [144.8, -37.7] },
      properties: { type: "house", street: "Truro Crescent", housenumber: "47", city: "Melbourne", countrycode: "au" },
    }, typed)?.line1).toBe("47 Truro Crescent")
  })
})

describe("addressFromPhoton", () => {
  it("fills an Australian street address", () => {
    expect(addressFromPhoton({
      geometry: { coordinates: [151.2093, -33.8688] },
      properties: {
        housenumber: "123",
        street: "George Street",
        city: "Sydney",
        state: "New South Wales",
        postcode: "2000",
        countrycode: "au",
      },
    })).toEqual({
      line1: "123 George Street",
      line2: "",
      city: "Sydney",
      state: "New South Wales",
      postcode: "2000",
      country: "AU",
      lat: -33.8688,
      lng: 151.2093,
      label: "123 George Street, Sydney, New South Wales, 2000, AU",
    })
  })

  it("ignores addresses outside Australia", () => {
    expect(addressFromPhoton({
      geometry: { coordinates: [-0.1276, 51.5072] },
      properties: { street: "Downing Street", city: "London", countrycode: "gb" },
    })).toBeNull()
    expect(addressFromPhoton({
      geometry: { coordinates: [174.7633, -36.8485] },
      properties: { street: "Queen Street", city: "Auckland", countrycode: "nz" },
    })).toBeNull()
  })
})
