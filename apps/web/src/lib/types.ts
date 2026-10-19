export type ThemeSettings = {
  background: string
  foreground: string
  muted: string
  accent: string
  accentForeground: string
  border: string
  font: "archivo" | "plex" | "inter" | "system"
  density: "compact" | "comfortable" | "spacious"
  radius: "none" | "small" | "medium" | "large"
}

export type ProductMetadata = {
  material?: string
  mountingType?: string
  color?: string
  compatibleVacuum?: string
  compatibleCoffee?: string
}

export type Address = {
  name: string
  line1: string
  line2: string
  city: string
  state: string
  postcode: string
  country: string
  phone: string
}

export type ParseIssue = {
  record: number
  handle: string
  level: "error" | "skipped" | "warning"
  message: string
}

export type ImportReport = {
  encoding: string
  productsCreated: number
  productsUpdated: number
  productsSkipped: number
  variantsImported: number
  imagesStored: number
  imagesFailed: number
  imagesPending: number
  collectionsSynced: number
  failures: ParseIssue[]
  skipped: ParseIssue[]
  warnings: ParseIssue[]
}
