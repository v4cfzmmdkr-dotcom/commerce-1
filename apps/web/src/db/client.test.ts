import { describe, expect, it } from "vitest"
import { textArray } from "@/db/client"

describe("textArray", () => {
  it("passes arrays through", () => {
    expect(textArray(["a", "b"])).toEqual(["a", "b"])
  })

  it("parses Postgres array literals", () => {
    expect(textArray("{}")).toEqual([])
    expect(textArray("{dewalt,tstak}")).toEqual(["dewalt", "tstak"])
    expect(textArray("{\"wall mount\",\"say \\\"hi\\\"\",NULL,\"NULL\"}")).toEqual(["wall mount", "say \"hi\"", "NULL"])
  })

  it("returns an empty list for anything else", () => {
    expect(textArray(null)).toEqual([])
    expect(textArray(undefined)).toEqual([])
  })
})
