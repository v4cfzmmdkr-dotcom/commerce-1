import Link from "next/link"
import { logout } from "@/app/admin/login/actions"
import { requireAdmin } from "@/lib/auth/current"

const links = [
  ["Overview", "/admin"],
  ["Products", "/admin/products"],
  ["Collections", "/admin/collections"],
  ["Orders", "/admin/orders"],
  ["Shipping", "/admin/shipping"],
  ["Import", "/admin/import"],
  ["Theme", "/admin/theme"],
  ["Settings", "/admin/settings"],
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  return (
    <div className="min-h-screen bg-[var(--bg)] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="border-b border-[var(--border)]">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm tracking-[0.16em]">DASHBOARD</p>
          <form action={logout}>
            <button className="nav-link text-sm" type="submit">Sign out {admin.email}</button>
          </form>
        </div>
        <nav className="wrap flex gap-4 overflow-x-auto text-sm" aria-label="Admin">
          {links.map(([label, href]) => (
            <Link key={href} className="nav-link" href={href}>{label}</Link>
          ))}
        </nav>
      </div>
      <main id="content" className="wrap py-8">{children}</main>
    </div>
  )
}
