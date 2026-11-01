import { SignIn, SignOutButton } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { currentAdmin } from "@/lib/auth/current"

function adminPath(value: string | undefined) {
  if (!value) return null
  let path = value
  try {
    path = new URL(value, "http://local").pathname
  } catch {
    return null
  }
  return path.startsWith("/admin") && !path.startsWith("/admin/login") ? path : null
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string, redirect_url?: string }>
}) {
  const params = await searchParams
  const next = adminPath(params.next) ?? adminPath(params.redirect_url) ?? "/admin"
  const { userId } = await auth()
  if (userId && await currentAdmin()) redirect(next)
  return (
    <main id="content" className="wrap flex min-h-screen flex-col items-center justify-center gap-6 py-16">
      <h1 className="text-2xl font-semibold">Admin</h1>
      {userId ? (
        <div className="grid max-w-sm gap-4 text-center">
          <p className="text-sm">This account does not have admin access. Sign in with the shop owner&apos;s account.</p>
          <SignOutButton redirectUrl="/admin/login">
            <button className="btn" type="button">Sign out</button>
          </SignOutButton>
        </div>
      ) : (
        <SignIn routing="hash" forceRedirectUrl={next} withSignUp={false} />
      )}
    </main>
  )
}
