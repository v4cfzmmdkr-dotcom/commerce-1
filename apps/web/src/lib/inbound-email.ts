import PostalMime from "postal-mime"
import { Resend } from "resend"
import { social } from "@/lib/social"

export type ForwardStatus = "forwarded" | "not_configured"

export function forwardSender(from: string, storeName: string) {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  const name = (match?.[1] || match?.[2] || from).replace(/["\\\r\n<>]/g, "").trim()
  return `"${name} via ${storeName}" <${social.email.address}>`
}

export function replyAddresses(email: { from: string, reply_to: string[] | null }) {
  return email.reply_to?.length ? email.reply_to : [email.from]
}

export async function forwardReceivedEmail(emailId: string, storeName: string): Promise<ForwardStatus> {
  const apiKey = process.env.RESEND_API_KEY
  const forwardTo = process.env.CONTACT_FORWARD_TO
  if (!apiKey || !forwardTo) return "not_configured"
  const resend = new Resend(apiKey)
  const { data: email, error } = await resend.emails.receiving.get(emailId)
  if (error) throw new Error(`Resend could not load received email ${emailId}: ${error.message}`)
  if (!email.raw?.download_url) throw new Error(`Received email ${emailId} has no raw content`)
  const raw = await fetch(email.raw.download_url)
  if (!raw.ok) throw new Error(`Raw email download failed with ${raw.status}`)
  const parsed = await PostalMime.parse(await raw.arrayBuffer(), { attachmentEncoding: "base64" })
  const attachments = parsed.attachments.map((attachment) => ({
    filename: attachment.filename || undefined,
    content: String(attachment.content),
    contentType: attachment.mimeType,
    contentId: attachment.contentId?.replace(/^<|>$/g, "") || undefined,
  }))
  const sent = await resend.emails.send(
    {
      from: forwardSender(email.from, storeName),
      to: forwardTo.split(",").map((address) => address.trim()).filter(Boolean),
      replyTo: replyAddresses(email),
      subject: email.subject || "(no subject)",
      text: parsed.text || email.text || " ",
      html: parsed.html || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    },
    { idempotencyKey: `forward/${emailId}` },
  )
  if (sent.error) throw new Error(`Resend could not forward ${emailId}: ${sent.error.message}`)
  return "forwarded"
}
