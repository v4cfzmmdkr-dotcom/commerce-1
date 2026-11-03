import { describe, expect, it } from "vitest"
import { checkPrintFile, formatFileSize, printFileExtension } from "@/lib/print-file-rules"
import { printFileBelongsTo, printFilePath } from "@/lib/print-files"

describe("print file rules", () => {
  it("accepts slicer and model formats only", () => {
    expect(printFileExtension("Adapter 36ID.3MF")).toBe("3mf")
    expect(printFileExtension("plate_1.gcode")).toBe("gcode")
    expect(printFileExtension("photo.jpg")).toBeNull()
    expect(checkPrintFile("bracket.stl", 1200)).toBeNull()
    expect(checkPrintFile("bracket.zip", 1200)).toMatch(/Upload a 3MF/)
    expect(checkPrintFile("bracket.stl", 0)).toBe("That file is empty")
    expect(checkPrintFile("bracket.stl", 60 * 1024 * 1024)).toMatch(/under 50MB/)
  })

  it("formats sizes", () => {
    expect(formatFileSize(512)).toBe("1 KB")
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB")
  })
})

describe("printFilePath", () => {
  it("keeps files under the product folder with a safe name", () => {
    const objectPath = printFilePath("prod_123", "Hose Adapter (v2).3mf", 1700000000000)
    expect(objectPath).toBe("prod-123/1700000000000-hose-adapter-v2.3mf")
    expect(printFileBelongsTo(objectPath, "prod_123")).toBe(true)
    expect(printFileBelongsTo(objectPath, "prod_456")).toBe(false)
  })

  it("rejects unsupported files", () => {
    expect(() => printFilePath("prod", "notes.txt")).toThrow()
  })
})
