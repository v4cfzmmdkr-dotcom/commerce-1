import { z } from "zod"

export const packageSchemaId = "nicheparts.product-package"
export const supportedMajorVersion = 1
export const supportedMinorVersion = 0

export const limits = {
  packageBytes: 5 * 1024 * 1024 * 1024,
  entries: 20_000,
  products: 1000,
  manifestBytes: 2 * 1024 * 1024,
  productsBytes: 40 * 1024 * 1024,
  imageBytes: 12 * 1024 * 1024,
  modelBytes: 50 * 1024 * 1024,
  imagesPerProduct: 20,
  modelsPerProduct: 30,
  pathLength: 200,
  compressionRatio: 200,
} as const

export const imageExtensions = ["jpg", "jpeg", "png", "webp"] as const
export const modelExtensions = ["stl", "3mf"] as const

const safeText = (max: number) => z.string().trim().max(max)
const requiredText = (max: number) => z.string().trim().min(1, "is required").max(max)
const webUrl = z.string().trim().max(2000).refine((value) => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}, "must be an http or https link")
const packagePath = z.string().trim().min(1).max(limits.pathLength)

export const commercialUseValues = ["allowed", "not_allowed", "unknown"] as const

export const productSchema = z.object({
  external_id: requiredText(200).regex(/^[A-Za-z0-9._:-]+$/, "may only use letters, numbers, dot, dash, underscore and colon"),
  source: z.object({
    name: requiredText(60).regex(/^[a-z0-9][a-z0-9_-]*$/, "must be lowercase letters, numbers, dash or underscore"),
    url: webUrl,
  }),
  creator: z.object({
    name: requiredText(200),
    url: webUrl.optional(),
  }),
  licence: z.object({
    name: requiredText(200),
    url: webUrl.optional(),
    commercial_use: z.enum(commercialUseValues),
    attribution_required: z.boolean().optional().default(false),
    notes: safeText(2000).optional().default(""),
  }),
  title: requiredText(250),
  handle: z.string().trim().max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase words joined by dashes").optional(),
  description_html: z.string().max(100_000),
  seo: z.object({
    title: safeText(200),
    description: safeText(500),
  }),
  category: requiredText(120),
  tags: z.array(requiredText(60)).max(50).default([]),
  sku: requiredText(64).regex(/^[A-Za-z0-9._-]+$/, "may only use letters, numbers, dot, dash and underscore"),
  price_cents: z.number().int("must be whole cents").min(1).max(10_000_000),
  compare_at_price_cents: z.number().int("must be whole cents").min(1).max(10_000_000).nullable().optional(),
  print: z.object({
    filament_type: requiredText(40),
    filament_grams: z.number().positive().max(100_000),
    print_minutes: z.number().int("must be whole minutes").positive().max(100_000),
  }),
  shipping_weight_grams: z.number().int("must be whole grams").positive().max(30_000),
  images: z.array(z.object({
    path: packagePath,
    alt: safeText(250).optional().default(""),
  })).min(1, "needs at least one image").max(limits.imagesPerProduct),
  models: z.array(z.object({
    path: packagePath,
    copies: z.number().int().min(1).max(100).optional().default(1),
    notes: safeText(500).optional().default(""),
  })).max(limits.modelsPerProduct).optional().default([]),
})

export type PackageProduct = z.infer<typeof productSchema>

const versionString = z.string().trim().regex(/^\d+\.\d+$/, "must look like 1.0")

export const manifestSchema = z.object({
  schema: z.literal(packageSchemaId, { error: `must be "${packageSchemaId}"` }),
  schema_version: versionString,
  package_id: requiredText(120).regex(/^[A-Za-z0-9._:-]+$/, "may only use letters, numbers, dot, dash, underscore and colon"),
  generated_at: z.string().trim().max(40).optional(),
  generator: z.object({ name: requiredText(100), version: safeText(40).optional().default("") }).optional(),
  currency: z.string().trim().toUpperCase().refine((value) => value === "AUD", "must be AUD").optional().default("AUD"),
  product_count: z.number().int().min(1).max(limits.products),
  files: z.array(z.object({
    path: packagePath,
    size: z.number().int().min(0),
    sha256: z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/, "must be a SHA-256 hex digest"),
  })).max(limits.entries).optional(),
})

export type PackageManifest = z.infer<typeof manifestSchema>

export const productsFileSchema = z.object({
  schema_version: versionString,
  products: z.array(z.unknown()).min(1, "must list at least one product").max(limits.products, `can list at most ${limits.products} products per package`),
})

export function parseVersion(value: string) {
  const [major, minor] = value.split(".").map(Number)
  return { major, minor }
}

export function formatIssues(error: z.ZodError, prefix = "") {
  return error.issues.map((issue) => {
    const where = issue.path
      .map((part) => (typeof part === "number" ? `[${part}]` : `.${String(part)}`))
      .join("")
      .replace(/^\./, "")
    return [prefix, where, issue.message].filter(Boolean).join(" ")
  })
}
