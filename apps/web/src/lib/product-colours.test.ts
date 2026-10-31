import { describe, expect, it } from "vitest"
import { keepBlackWhiteColours, limitVariantsToBlackWhite } from "@/lib/product-colours"

describe("product colours", () => {
  it("keeps only black and white colour options", () => {
    const kept = keepBlackWhiteColours([
      { option1Name: "Colour", option1Value: "Red", option2Name: "", option2Value: "", option3Name: "", option3Value: "" },
      { option1Name: "Colour", option1Value: "Black", option2Name: "", option2Value: "", option3Name: "", option3Value: "" },
      { option1Name: "Colour", option1Value: "Green", option2Name: "", option2Value: "", option3Name: "", option3Value: "" },
      { option1Name: "Colour", option1Value: "White", option2Name: "", option2Value: "", option3Name: "", option3Value: "" },
    ])
    expect(kept.map((variant) => variant.option1Value)).toEqual(["Black", "White"])
  })

  it("adds black and white to products with no colour option", () => {
    const limited = limitVariantsToBlackWhite([
      {
        sku: "PEG",
        option1Name: "Title",
        option1Value: "Default Title",
        option2Name: "",
        option2Value: "",
        option3Name: "",
        option3Value: "",
      },
    ])
    expect(limited).toHaveLength(2)
    expect(limited.map((variant) => variant.option1Value)).toEqual(["Black", "White"])
    expect(limited[1].sku).toBe("PEG-W")
  })
})
