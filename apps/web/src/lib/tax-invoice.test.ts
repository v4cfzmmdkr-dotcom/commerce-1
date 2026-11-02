import { describe, expect, it } from "vitest"
import { invoiceDate, normaliseAbn } from "@/lib/tax-invoice"

describe("normaliseAbn", () => {
  it("formats a valid ABN", () => {
    expect(normaliseAbn("51824753556")).toBe("51 824 753 556")
    expect(normaliseAbn(" 51 824 753 556 ")).toBe("51 824 753 556")
  })

  it("rejects an ABN that fails the checksum or has the wrong length", () => {
    expect(normaliseAbn("51824753557")).toBeNull()
    expect(normaliseAbn("1234")).toBeNull()
  })

  it("allows clearing the ABN", () => {
    expect(normaliseAbn("")).toBe("")
  })
})

describe("invoiceDate", () => {
  it("shows the date in Queensland time", () => {
    expect(invoiceDate("2026-11-01T15:30:00Z")).toBe("2 November 2026")
  })
})
