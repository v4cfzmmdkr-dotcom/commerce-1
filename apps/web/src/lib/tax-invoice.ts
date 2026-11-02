const abnWeights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]

// Returns the ABN as "12 345 678 901", "" for empty input, or null when it fails the ATO checksum.
export function normaliseAbn(input: string) {
  const digits = input.replace(/\s/g, "")
  if (!digits) return ""
  if (!/^\d{11}$/.test(digits)) return null
  const sum = digits.split("").reduce((total, digit, index) => {
    const value = Number(digit) - (index === 0 ? 1 : 0)
    return total + value * abnWeights[index]
  }, 0)
  if (sum % 89 !== 0) return null
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
}

export function invoiceDate(value: string | Date | null | undefined) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Brisbane" })
}
