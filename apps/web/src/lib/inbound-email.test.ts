import { describe, expect, it } from "vitest"
import { forwardSender, replyAddresses } from "@/lib/inbound-email"

describe("forwardSender", () => {
  it("shows the customer's name and sends from the contact address", () => {
    expect(forwardSender("Jane Smith <jane@example.com>", "Niche Parts"))
      .toBe("\"Jane Smith via Niche Parts\" <contact@nicheparts.com.au>")
    expect(forwardSender("\"Smith, Jane\" <jane@example.com>", "Niche Parts"))
      .toBe("\"Smith, Jane via Niche Parts\" <contact@nicheparts.com.au>")
  })

  it("falls back to the sender address when there is no name", () => {
    expect(forwardSender("jane@example.com", "Niche Parts"))
      .toBe("\"jane@example.com via Niche Parts\" <contact@nicheparts.com.au>")
    expect(forwardSender("<jane@example.com>", "Niche Parts"))
      .toBe("\"jane@example.com via Niche Parts\" <contact@nicheparts.com.au>")
  })
})

describe("replyAddresses", () => {
  it("replies to the sender unless they asked for another address", () => {
    expect(replyAddresses({ from: "jane@example.com", reply_to: null })).toEqual(["jane@example.com"])
    expect(replyAddresses({ from: "jane@example.com", reply_to: [] })).toEqual(["jane@example.com"])
    expect(replyAddresses({ from: "jane@example.com", reply_to: ["help@example.com"] })).toEqual(["help@example.com"])
  })
})
