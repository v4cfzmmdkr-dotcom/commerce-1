import { formatMoney } from "@/lib/money"

const labels: Record<string, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
}

export function paymentLabel(
  status: string,
  refund?: { refundedCents: number, totalCents: number, currency: string },
) {
  const label = labels[status] ?? status
  if (status !== "partially_refunded" || !refund) return label
  const refunded = formatMoney(Number(refund.refundedCents), refund.currency)
  const total = formatMoney(Number(refund.totalCents), refund.currency)
  return `${label} (${refunded} of ${total})`
}
