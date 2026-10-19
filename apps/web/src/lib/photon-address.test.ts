import { describe, expect, it } from "vitest"
import { addressFromPhoton } from "@/lib/photon-address"

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

  it("ignores addresses outside AU and NZ", () => {
    expect(addressFromPhoton({
      geometry: { coordinates: [-0.1276, 51.5072] },
      properties: { street: "Downing Street", city: "London", countrycode: "gb" },
    })).toBeNull()
  })
})
