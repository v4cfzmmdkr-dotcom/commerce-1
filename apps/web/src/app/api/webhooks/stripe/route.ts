import { fulfillPaidOrder, markOrderFailed } from "@/lib/orders"
import { getStripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new Response("Webhook secret is not set", { status: 500 })
  const signature = request.headers.get("stripe-signature")
  if (!signature) return new Response("Missing signature", { status: 400 })
  const body = await request.text()
  let event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret)
  } catch {
    return new Response("Invalid signature", { status: 400 })
  }
  const session = event.data.object
  if (!("metadata" in session)) return new Response("ok")
  const orderId = session.metadata?.orderId
  if (!orderId) return new Response("ok")
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if ("payment_status" in session) await fulfillPaidOrder(orderId, session)
  }
  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    await markOrderFailed(orderId)
  }
  return new Response("ok")
}
