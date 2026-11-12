import type { PackageFile } from "@/lib/bulk-import/files"
import {
  formatIssues,
  limits,
  manifestSchema,
  parseVersion,
  productSchema,
  productsFileSchema,
  supportedMajorVersion,
  supportedMinorVersion,
  type PackageManifest,
  type PackageProduct,
} from "@/lib/bulk-import/schema"

export type ItemPlan = {
  position: number
  sourceName: string
  externalId: string
  sku: string
  title: string
  data: PackageProduct | null
  errors: string[]
  warnings: string[]
  blocked: boolean
}

export type PackageAnalysis = {
  errors: string[]
  warnings: string[]
  manifest: PackageManifest | null
  items: ItemPlan[]
}

function parseJson(text: string, name: string) {
  try {
    return { value: JSON.parse(text.replace(/^\uFEFF/, "")) as unknown }
  } catch (error) {
    return { error: `${name} is not valid JSON: ${error instanceof Error ? error.message : "parse error"}` }
  }
}

function rawField(value: unknown, ...keys: string[]) {
  let current = value
  for (const key of keys) {
    if (!current || typeof current !== "object") return ""
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === "string" ? current.trim().slice(0, 200) : ""
}

export function analysePackage(input: { files: PackageFile[], manifestText: string, productsText: string, shopMaterials: string[] }): PackageAnalysis {
  const errors: string[] = []
  const warnings: string[] = []
  const empty = (manifest: PackageManifest | null = null) => ({ errors, warnings, manifest, items: [] })

  const manifestJson = parseJson(input.manifestText, "manifest.json")
  if ("error" in manifestJson) return { ...empty(), errors: [manifestJson.error!] }
  const manifestResult = manifestSchema.safeParse(manifestJson.value)
  if (!manifestResult.success) return { ...empty(), errors: formatIssues(manifestResult.error, "manifest.json:") }
  const manifest = manifestResult.data
  const version = parseVersion(manifest.schema_version)
  if (version.major !== supportedMajorVersion) {
    errors.push(`manifest.json: schema_version ${manifest.schema_version} is not supported. This shop reads version ${supportedMajorVersion}.x packages`)
    return empty(manifest)
  }
  if (version.minor > supportedMinorVersion) {
    warnings.push(`Package uses schema version ${manifest.schema_version}, newer than ${supportedMajorVersion}.${supportedMinorVersion}. Fields this shop does not know are ignored`)
  }

  const productsJson = parseJson(input.productsText, "products.json")
  if ("error" in productsJson) return { ...empty(manifest), errors: [productsJson.error!] }
  const productsResult = productsFileSchema.safeParse(productsJson.value)
  if (!productsResult.success) return { ...empty(manifest), errors: formatIssues(productsResult.error, "products.json:") }
  const productsFile = productsResult.data
  if (productsFile.schema_version !== manifest.schema_version) {
    errors.push(`products.json schema_version ${productsFile.schema_version} does not match manifest.json ${manifest.schema_version}`)
  }
  if (manifest.product_count !== productsFile.products.length) {
    errors.push(`manifest.json says ${manifest.product_count} products but products.json lists ${productsFile.products.length}. The package may be incomplete`)
  }

  const byPath = new Map(input.files.map((file) => [file.path.toLowerCase(), file]))
  if (manifest.files) {
    const listed = new Set<string>()
    for (const file of manifest.files) {
      const key = file.path.toLowerCase()
      listed.add(key)
      const actual = byPath.get(key)
      if (!actual) errors.push(`manifest.json lists ${file.path} but it is not in the ZIP`)
      else if (actual.size !== file.size) errors.push(`${file.path} is ${actual.size} bytes but manifest.json says ${file.size}. The file may be damaged`)
    }
    const unlisted = input.files.filter((file) => !listed.has(file.path.toLowerCase()))
    if (unlisted.length) errors.push(`${unlisted.length} ${unlisted.length === 1 ? "file is" : "files are"} in the ZIP but not in manifest.json, for example ${unlisted[0].path}`)
  }

  const materials = input.shopMaterials.map((name) => name.toLowerCase())
  const used = new Set<string>()
  const identities = new Map<string, number>()
  const skus = new Map<string, number>()
  const items: ItemPlan[] = productsFile.products.map((raw, position) => {
    const parsed = productSchema.safeParse(raw)
    const label = `Product ${position + 1}`
    if (!parsed.success) {
      return {
        position,
        sourceName: rawField(raw, "source", "name") || "unknown",
        externalId: rawField(raw, "external_id") || `missing-${position + 1}`,
        sku: rawField(raw, "sku"),
        title: rawField(raw, "title") || label,
        data: null,
        errors: formatIssues(parsed.error),
        warnings: [],
        blocked: false,
      }
    }
    const data = parsed.data
    const itemErrors: string[] = []
    const itemWarnings: string[] = []
    const identity = `${data.source.name}:${data.external_id}`.toLowerCase()
    const sameIdentity = identities.get(identity)
    if (sameIdentity !== undefined) errors.push(`Products ${sameIdentity + 1} and ${position + 1} share the external ID ${data.source.name}:${data.external_id}`)
    else identities.set(identity, position)
    const sameSku = skus.get(data.sku.toLowerCase())
    if (sameSku !== undefined) errors.push(`Products ${sameSku + 1} and ${position + 1} share the SKU ${data.sku}`)
    else skus.set(data.sku.toLowerCase(), position)

    const check = (path: string, kind: PackageFile["kind"]) => {
      const file = byPath.get(path.toLowerCase())
      if (!file) itemErrors.push(`${path} is listed but is not in the ZIP`)
      else if (file.kind !== kind) itemErrors.push(`${path} must be in the ${kind === "image" ? "images/" : "models/"} folder`)
      else used.add(file.path.toLowerCase())
      return file?.path ?? path
    }
    const seenImages = new Set<string>()
    data.images = data.images.filter((image) => {
      image.path = check(image.path, "image")
      const key = image.path.toLowerCase()
      if (seenImages.has(key)) {
        itemWarnings.push(`${image.path} is listed twice; the copy was skipped`)
        return false
      }
      seenImages.add(key)
      return true
    })
    const seenModels = new Set<string>()
    data.models = data.models.filter((model) => {
      model.path = check(model.path, "model")
      const key = model.path.toLowerCase()
      if (seenModels.has(key)) {
        itemWarnings.push(`${model.path} is listed twice; the copy was skipped`)
        return false
      }
      seenModels.add(key)
      return true
    })

    const missingAlt = data.images.filter((image) => !image.alt).length
    if (missingAlt) itemWarnings.push(`${missingAlt} ${missingAlt === 1 ? "image has" : "images have"} no alt text; the product title will be used`)
    if (data.seo.title.length > 70) itemWarnings.push(`SEO title is ${data.seo.title.length} characters; search engines show about 60`)
    if (data.seo.description.length > 160) itemWarnings.push(`SEO description is ${data.seo.description.length} characters; search engines show about 155`)
    if (!data.seo.title) itemWarnings.push("SEO title is empty; the product title will be used")
    if (materials.length && !materials.includes(data.print.filament_type.toLowerCase())) {
      itemWarnings.push(`${data.print.filament_type} is not one of the shop's materials; customers are offered the shop's usual materials`)
    }
    if (data.compare_at_price_cents != null && data.compare_at_price_cents <= data.price_cents) {
      itemWarnings.push("Compare-at price is not above the price, so it was ignored")
      data.compare_at_price_cents = null
    }
    let blocked = false
    if (data.licence.commercial_use === "not_allowed") {
      blocked = true
      itemErrors.push(`The ${data.licence.name} licence does not allow commercial use, so this product cannot be sold`)
    } else if (data.licence.commercial_use === "unknown") {
      itemWarnings.push("Commercial use is not confirmed for this licence. Check it before approving")
    }
    return {
      position,
      sourceName: data.source.name,
      externalId: data.external_id,
      sku: data.sku,
      title: data.title,
      data,
      errors: itemErrors,
      warnings: itemWarnings,
      blocked,
    }
  })

  const seen = new Set<string>()
  for (const item of items) {
    const key = `${item.sourceName}:${item.externalId}`.toLowerCase()
    if (seen.has(key)) item.externalId = `${item.externalId}-duplicate-${item.position + 1}`
    seen.add(`${item.sourceName}:${item.externalId}`.toLowerCase())
  }
  const unused = input.files.filter((file) => !used.has(file.path.toLowerCase())).length
  if (unused) warnings.push(`${unused} ${unused === 1 ? "file is" : "files are"} in the ZIP but not used by any product; ${unused === 1 ? "it" : "they"} will be ignored`)
  if (items.length > limits.products) errors.push(`A package can hold at most ${limits.products} products`)
  return { errors, warnings, manifest, items }
}
