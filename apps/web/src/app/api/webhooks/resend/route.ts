import { Resend } from "resend"
import { forwardReceivedEmail } from "@/lib/inbound-email"
import { getSettings } from "@/lib/settings"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const apiKey = process.env.RESEND_API_KEY
  if (!secret || !apiKey) return new Response("Resend is not configured", { status: 500 })
  const id = request.headers.get("svix-id")
  const timestamp = request.headers.get("svix-timestamp")
  const signature = request.headers.get("svix-signature")
  if (!id || !timestamp || !signature) return new Response("Missing signature", { status: 400 })
  const payload = await request.text()
  let event
  try {
    event = new Resend(apiKey).webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret: secret })
  } catch {
    return new Response("Invalid signature", { status: 400 })
  }
  if (event.type !== "email.received") return new Response("ok")
  const settings = await getSettings()
  const status = await forwardReceivedEmail(event.data.email_id, settings.name)
  if (status === "not_configured") return new Response("Forwarding is not configured", { status: 500 })
  return new Response("ok")
}
