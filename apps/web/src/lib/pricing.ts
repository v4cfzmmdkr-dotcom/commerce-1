export type PricedLine = {
  variantId: string
  productTitle: string
  variantTitle: string
  sku: string
  quantity: number
  unitPriceCents: number
  taxable: boolean
  inventoryQty: number
  inventoryPolicy: string
}

export function merchandiseSubtotal(lines: Array<{ unitPriceCents: number, quantity: number }>) {
  return lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
}

export function quoteOrder(input: {
  lines: Array<Pick<PricedLine, "unitPriceCents" | "quantity" | "taxable">>
  shippingCents: number
  gstRateBps: number
  pricesIncludeTax: boolean
}) {
  const subtotal = merchandiseSubtotal(input.lines)
  const taxable = input.lines
    .filter((line) => line.taxable)
    .reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  const taxBase = taxable + input.shippingCents
  const tax = input.pricesIncludeTax
    ? Math.round((Math.max(0, taxBase) * input.gstRateBps) / (10000 + input.gstRateBps))
    : Math.round((Math.max(0, taxBase) * input.gstRateBps) / 10000)
  const total = input.pricesIncludeTax ? subtotal + input.shippingCents : subtotal + input.shippingCents + tax
  return { subtotal, shipping: input.shippingCents, tax, total }
}
