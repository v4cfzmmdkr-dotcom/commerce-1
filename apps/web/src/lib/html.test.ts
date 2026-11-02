import { describe, expect, it } from "vitest"
import { summaryText } from "@/lib/html"

describe("summaryText", () => {
  it("strips tags and entities into one line", () => {
    expect(summaryText("<p>Fits <strong>Dyson</strong> V11&nbsp;&amp; V15.</p>\n<p>Made in Australia.</p>")).toBe("Fits Dyson V11 & V15. Made in Australia.")
  })

  it("shortens long text on a word boundary", () => {
    const result = summaryText("word ".repeat(60))
    expect(result.length).toBeLessThanOrEqual(155)
    expect(result.endsWith("word…")).toBe(true)
  })

  it("returns an empty string for empty input", () => {
    expect(summaryText(null)).toBe("")
  })
})
import { formatDescription } from "@/lib/html"

describe("formatDescription", () => {
  it("turns blank-line separated text into paragraphs", () => {
    expect(formatDescription("3d printed mount\n\nHolds 99 bits.\nFits tight")).toBe(
      "<p>3d printed mount</p><p>Holds 99 bits.<br />Fits tight</p>",
    )
  })

  it("builds lists from emoji, symbol, and dash bullets", () => {
    expect(formatDescription("✅ Durable\n✅ Precise\n\n• Fits SKÅDIS\n- Holds 5 rulers")).toBe(
      "<ul><li>Durable</li><li>Precise</li><li>Fits SKÅDIS</li><li>Holds 5 rulers</li></ul>",
    )
  })

  it("builds numbered lists", () => {
    expect(formatDescription("1. Drill the gear\n2) Fit the shaft")).toBe(
      "<ol><li>Drill the gear</li><li>Fit the shaft</li></ol>",
    )
  })

  it("turns short lines ending in a colon into headings and bolds labels", () => {
    expect(formatDescription("Important Notes:\n📌 Check Your Worm Shaft: clean it first")).toBe(
      "<h3>Important Notes</h3><ul><li><strong>Check Your Worm Shaft:</strong> clean it first</li></ul>",
    )
  })

  it("escapes plain text and leaves existing HTML structure alone", () => {
    expect(formatDescription("Size <5mm & light")).toBe("<p>Size &lt;5mm &amp; light</p>")
    expect(formatDescription("<p>Already <strong>formatted</strong></p>")).toBe("<p>Already <strong>formatted</strong></p>")
  })

  it("does not treat negative numbers or times as bullets or labels", () => {
    expect(formatDescription("-5mm tolerance\nOpen 10:30 daily")).toBe("<p>-5mm tolerance<br />Open 10:30 daily</p>")
  })
})
