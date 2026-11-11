import { cache } from "react"
import { listActiveShippingRates } from "@/lib/orders"
import { freeShippingFrom } from "@/lib/product-seo"

export const freeShippingThreshold = cache(async () => {
  try {
    return freeShippingFrom(await listActiveShippingRates())
  } catch {
    return null
  }
})
