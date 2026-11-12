export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export function formatGrams(grams: number) {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2).replace(/\.?0+$/, "")} kg`
  return `${Math.round(grams * 10) / 10} g`
}

type Tone = "neutral" | "blue" | "green" | "orange" | "red"

export const batchStatusLabels: Record<string, [string, Tone]> = {
  uploading: ["Upload not finished", "orange"],
  validating: ["Checking", "blue"],
  invalid: ["Rejected package", "red"],
  review: ["Ready for review", "blue"],
  importing: ["Importing", "blue"],
  completed: ["Completed", "green"],
}

export function itemStatusLabel(item: { status: string, decision: string, blocked: boolean }): [string, Tone] {
  if (item.blocked) return ["Licence blocks sale", "red"]
  if (item.status === "invalid") return ["Invalid", "red"]
  if (item.status === "imported") return ["Imported", "green"]
  if (item.status === "failed") return ["Failed", "red"]
  if (item.status === "processing") return ["Importing", "blue"]
  if (item.status === "queued") return ["Queued", "blue"]
  if (item.decision === "approved") return ["Approved", "green"]
  if (item.decision === "rejected") return ["Rejected", "neutral"]
  return ["Needs review", "orange"]
}

export const licenceLabels: Record<string, [string, Tone]> = {
  allowed: ["Commercial use allowed", "green"],
  unknown: ["Commercial use unconfirmed", "orange"],
  not_allowed: ["No commercial use", "red"],
}

export const noticeText: Record<string, string> = {
  paused: "Import paused. Approved products that were waiting are back to approved.",
  "nothing-queued": "Nothing to import. Approve some products first.",
  "package-removed": "Package file deleted from storage. The import history is kept.",
  "package-kept": "The package can't be removed while an import is running.",
  "delete-blocked": "This import created or updated products, so it is kept as history. You can delete its package file instead.",
}

export function noticeFor(value: string | undefined) {
  if (!value) return null
  if (noticeText[value]) return noticeText[value]
  const match = value.match(/^(approved|rejected|queued)-(\d+)$/)
  if (!match) return null
  const count = Number(match[2])
  const products = `${count} ${count === 1 ? "product" : "products"}`
  if (match[1] === "queued") return `${products} queued for import.`
  return `${products} ${match[1]}.`
}
