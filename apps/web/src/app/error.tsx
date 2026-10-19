"use client"

export default function ErrorPage({ reset }: { error: Error, reset: () => void }) {
  return (
    <div className="wrap py-[var(--section)]">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-sm">The page could not be loaded. Try again.</p>
      <button className="btn mt-6" type="button" onClick={reset}>Try again</button>
    </div>
  )
}
