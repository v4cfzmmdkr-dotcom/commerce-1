"use server"

import { redirect } from "next/navigation"
import { getCart } from "@/lib/cart"
import { getSettings } from "@/lib/settings"
import { isPurchasable, maxPurchasable } from "@/lib/money"
import { attachStripeSession, cancelUnpaidOrder, createPendingOrder } from "@/lib/orders"
import { siteUrl } from "@/lib/site"
import { getStripe, stripeConfigured } from "@/lib/stripe"
import type { Address } from "@/lib/types"

function read(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim()
}

function redirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
}

export async function placeOrder(
  _previous: { error?: string } | null,
  formData: FormData,
) {
  if (!stripeConfigured()) return { error: "Payments are not configured yet. Add STRIPE_SECRET_KEY." }
  const address: Address = {
    name: read(formData, "name"),
    line1: read(formData, "line1"),
    line2: read(formData, "line2"),
    city: read(formData, "city"),
    state: read(formData, "state"),
    postcode: read(formData, "postcode"),
    country: read(formData, "country").toUpperCase(),
    phone: read(formData, "phone"),
  }
  const email = read(formData, "email").toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email" }
  if (!address.name || !address.line1 || !address.city || !address.state || !address.postcode || address.country.length !== 2) {
    return { error: "Complete the delivery address" }
  }
  if (address.country === "AU" && !/^\d{4}$/.test(address.postcode)) {
    return { error: "Enter a 4-digit Australian postcode" }
  }
  const cart = await getCart()
  if (cart.lines.length === 0) return { error: "Your cart is empty" }
  for (const line of cart.lines) {
    if (!isPurchasable(line) || line.quantity > maxPurchasable(line)) {
      return { error: `${line.productTitle} is no longer available in that quantity` }
    }
  }
  const shippingRateId = read(formData, "shippingRateId")
  let orderId = ""
  try {
    const order = await createPendingOrder({
      email,
      cartId: cart.id,
      shippingRateId,
      address,
      lines: cart.lines.map((line) => ({
        variantId: line.variantId,
        productTitle: line.productTitle,
        variantTitle: line.variantTitle,
        sku: line.sku,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        taxable: line.taxable,
        inventoryQty: line.inventoryQty,
        inventoryPolicy: line.inventoryPolicy,
      })),
    })
    orderId = order.id
    if (order.quote.total <= 0) throw new Error("This order does not have an amount to charge")
    const settings = await getSettings()
    const stripe = getStripe()
    const lineItems = cart.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: order.currency,
        unit_amount: line.unitPriceCents,
        product_data: {
          name: line.variantTitle ? `${line.productTitle} — ${line.variantTitle}` : line.productTitle,
        },
      },
    }))
    if (order.quote.shipping > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: order.currency,
          unit_amount: order.quote.shipping,
          product_data: { name: order.shippingName },
        },
      })
    }
    if (!settings.pricesIncludeTax && order.quote.tax > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: order.currency,
          unit_amount: order.quote.tax,
          product_data: { name: "GST" },
        },
      })
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      client_reference_id: order.id,
      success_url: `${siteUrl()}/orders/${order.token}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/checkout?cancelled=1`,
      metadata: { orderId: order.id },
      line_items: lineItems,
    })
    if (!session.url) throw new Error("Stripe did not return a checkout link")
    await attachStripeSession(order.id, session.id)
    redirect(session.url)
  } catch (error) {
    if (redirectError(error)) throw error
    if (orderId) await cancelUnpaidOrder(orderId)
    return { error: error instanceof Error ? error.message : "Could not start payment" }
  }
}
