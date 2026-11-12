import { describe, expect, it } from "vitest"
import { check3mf, checkEntries, checkStl, classifyPath, commonRoot, safeFileName, sniffImage, type RawEntry } from "@/lib/bulk-import/files"
import { cube3mf, cubeStl, solidPng, zipBuffer } from "@/lib/bulk-import/test-package"

function entry(name: string, size = 100, extra: Partial<RawEntry> = {}): RawEntry {
  return { name, compressedSize: size, uncompressedSize: size, isSymlink: false, isEncrypted: false, ...extra }
}

const base = [entry("manifest.json"), entry("products.json")]

describe("classifyPath", () => {
  it("accepts the package layout", () => {
    expect(classifyPath("manifest.json")).toEqual({ kind: "manifest" })
    expect(classifyPath("images/a/1.jpg")).toEqual({ kind: "image" })
    expect(classifyPath("models/part.3MF")).toEqual({ kind: "model" })
  })

  it("rejects traversal, odd names and other files", () => {
    expect(classifyPath("images/../../etc/passwd.png")).toHaveProperty("error")
    expect(classifyPath("images/.hidden.png")).toHaveProperty("error")
    expect(classifyPath("images/my photo.png")).toHaveProperty("error")
    expect(classifyPath("images/shell.php")).toHaveProperty("error")
    expect(classifyPath("models/part.exe")).toHaveProperty("error")
    expect(classifyPath("run.sh")).toHaveProperty("error")
    expect(classifyPath("images/")).toHaveProperty("error")
  })
})

describe("checkEntries", () => {
  it("lists images and models", () => {
    const result = checkEntries([...base, entry("images/"), entry("images/a.png"), entry("models/a.stl")])
    expect(result.errors).toEqual([])
    expect(result.files.map((file) => file.kind)).toEqual(["image", "model"])
  })

  it("strips a single wrapping folder and ignores system files", () => {
    const result = checkEntries([
      entry("pkg/manifest.json"), entry("pkg/products.json"), entry("pkg/images/a.png"),
      entry("__MACOSX/pkg/._a.png"), entry("pkg/.DS_Store"),
    ])
    expect(result.errors).toEqual([])
    expect(result.root).toBe("pkg/")
    expect(result.files[0].path).toBe("images/a.png")
    expect(result.warnings[0]).toMatch(/Ignored 2 system files/)
    expect(commonRoot(["a/manifest.json", "b/products.json"])).toBe("")
  })

  it("reports missing package files", () => {
    expect(checkEntries([entry("images/a.png")]).errors).toEqual([
      "products.json is missing from the top of the ZIP",
      "manifest.json is missing from the top of the ZIP",
    ])
  })

  it("rejects links, encryption, duplicates and unknown files", () => {
    const result = checkEntries([
      ...base,
      entry("images/link.png", 10, { isSymlink: true }),
      entry("images/secret.png", 10, { isEncrypted: true }),
      entry("images/A.png"), entry("images/a.png"),
      entry("notes.txt"),
    ])
    expect(result.errors.join("\n")).toMatch(/symbolic link/)
    expect(result.errors.join("\n")).toMatch(/encrypted/)
    expect(result.errors.join("\n")).toMatch(/appears more than once/)
    expect(result.errors.join("\n")).toMatch(/notes.txt is not allowed/)
  })

  it("enforces size limits and catches ZIP bombs", () => {
    const result = checkEntries([
      ...base,
      entry("images/huge.png", 13 * 1024 * 1024),
      entry("models/huge.stl", 51 * 1024 * 1024),
      { ...entry("models/bomb.stl"), compressedSize: 10_000, uncompressedSize: 40 * 1024 * 1024 },
    ])
    expect(result.errors).toHaveLength(3)
    expect(result.errors[2]).toMatch(/ZIP bomb/)
  })
})

describe("content checks", () => {
  it("sniffs real image types, not extensions", () => {
    expect(sniffImage(solidPng([1, 2, 3]))).toEqual({ type: "image/png", extension: "png" })
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ type: "image/jpeg", extension: "jpg" })
    expect(sniffImage(Buffer.from("RIFF0000WEBPVP8 "))).toEqual({ type: "image/webp", extension: "webp" })
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull()
    expect(sniffImage(Buffer.from("<?php echo 1; ?>"))).toBeNull()
  })

  it("checks STL files", () => {
    expect(checkStl(cubeStl())).toBeNull()
    expect(checkStl(Buffer.from("solid cube\nfacet normal 0 0 1\nouter loop\nendloop\nendfacet\nendsolid cube\n"))).toBeNull()
    expect(checkStl(Buffer.from("MZ this is an exe"))).toMatch(/not a valid STL/)
    expect(checkStl(cubeStl().subarray(0, 200))).toMatch(/not a valid STL/)
  })

  it("checks 3MF files", async () => {
    expect(await check3mf(await cube3mf())).toBeNull()
    expect(await check3mf(await zipBuffer([{ name: "readme.txt", bytes: Buffer.from("hi") }]))).toMatch(/no 3D model/)
    expect(await check3mf(Buffer.from("not a zip"))).toMatch(/not a valid 3MF/)
  })

  it("makes download names safe", () => {
    expect(safeFileName("models/a/../Clip \"v2\".stl")).toBe("Clip__v2_.stl")
  })
})
