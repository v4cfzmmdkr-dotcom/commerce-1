import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { adminCookieName, readAdminSession } from "@/lib/auth/session"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === "/admin/login") return NextResponse.next()
  const token = request.cookies.get(adminCookieName)?.value
  const session = token ? await readAdminSession(token) : null
  if (!session) {
    const login = new URL("/admin/login", request.url)
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
