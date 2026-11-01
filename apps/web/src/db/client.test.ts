import { describe, expect, it } from "vitest"
import { textArray, vercelSafeTarget } from "@/db/client"

describe("vercelSafeTarget", () => {
  it("moves the Supabase transaction pooler to the session pooler", () => {
    expect(vercelSafeTarget("postgresql://web.abc:pw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"))
      .toMatchObject({ host: "aws-0-ap-northeast-1.pooler.supabase.com", port: 5432, username: "web.abc" })
  })

  it("sends a direct Supabase host through the session pooler", () => {
    expect(vercelSafeTarget("postgresql://postgres:pw@db.abc.supabase.co:5432/postgres"))
      .toMatchObject({ port: 5432, username: "postgres.abc" })
  })

  it("leaves other hosts alone", () => {
    expect(vercelSafeTarget("postgres://seth@localhost:5432/nicheparts"))
      .toMatchObject({ host: "localhost", port: 5432, username: "seth" })
  })
})

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
