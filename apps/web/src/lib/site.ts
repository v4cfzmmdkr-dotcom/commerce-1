export function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  try {
    return new URL(value).origin
  } catch {
    return "http://localhost:3000"
  }
}
