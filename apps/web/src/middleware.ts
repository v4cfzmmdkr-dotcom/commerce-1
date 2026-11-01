import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isSignIn = createRouteMatcher(["/admin/login(.*)"])

export default clerkMiddleware(async (auth, request) => {
  if (!isSignIn(request)) await auth.protect()
}, { signInUrl: "/admin/login" })

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
