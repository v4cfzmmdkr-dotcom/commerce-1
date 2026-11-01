export const carriers = [
  { name: "Australia Post", url: "https://auspost.com.au/mypost/track/details/{n}" },
  { name: "StarTrack", url: "https://startrack.com.au/track/details/{n}" },
  { name: "Aramex", url: "https://www.aramex.com.au/tools/track?l={n}" },
  { name: "CouriersPlease", url: "https://www.couriersplease.com.au/tools-track/no/{n}" },
  { name: "Sendle", url: "https://track.sendle.com/tracking?ref={n}" },
  { name: "DHL", url: "https://www.dhl.com/au-en/home/tracking.html?tracking-id={n}" },
] as const

export function trackingUrl(carrier: string, number: string) {
  const trimmed = number.trim()
  if (!trimmed) return null
  const match = carriers.find((item) => item.name.toLowerCase() === carrier.trim().toLowerCase())
  return match ? match.url.replace("{n}", encodeURIComponent(trimmed)) : null
}
