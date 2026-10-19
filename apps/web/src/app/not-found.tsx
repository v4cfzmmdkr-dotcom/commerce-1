import Link from "next/link"

export default function NotFound() {
  return (
    <div className="wrap py-[var(--section)]">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 text-sm">That page is not in the shop.</p>
      <Link href="/" className="btn mt-6">Back home</Link>
    </div>
  )
}
