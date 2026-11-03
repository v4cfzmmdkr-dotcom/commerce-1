export const printFileExtensions = ["3mf", "stl", "obj", "step", "stp", "gcode", "bgcode"] as const
export const printFileAccept = printFileExtensions.map((extension) => `.${extension}`).join(",")
export const maxPrintFileBytes = 50 * 1024 * 1024

export function printFileExtension(fileName: string) {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return printFileExtensions.find((allowed) => allowed === extension) ?? null
}

export function checkPrintFile(fileName: string, size: number) {
  if (!printFileExtension(fileName)) return `Upload a ${printFileExtensions.map((extension) => extension.toUpperCase()).join(", ")} file`
  if (!Number.isFinite(size) || size <= 0) return "That file is empty"
  if (size > maxPrintFileBytes) return `Print files must be under ${maxPrintFileBytes / 1024 / 1024}MB`
  return null
}

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
