import { describe, expect, it } from "vitest"
import { trackingUrl } from "@/lib/tracking"

describe("trackingUrl", () => {
  it("builds a carrier link with the tracking number", () => {
    expect(trackingUrl("Australia Post", " 33ABC123 ")).toBe("https://auspost.com.au/mypost/track/details/33ABC123")
    expect(trackingUrl("sendle", "SNDL 1")).toBe("https://track.sendle.com/tracking?ref=SNDL%201")
  })

  it("returns null for unknown carriers or missing numbers", () => {
    expect(trackingUrl("Pigeon", "123")).toBeNull()
    expect(trackingUrl("Australia Post", "  ")).toBeNull()
  })
})
