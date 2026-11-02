import { SignOutButton } from "@clerk/nextjs"
import { AdminTabs } from "@/components/admin-tabs"
import { requireAdmin } from "@/lib/auth/current"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  return (
    <div className="admin-shell">
      <header className="admin-bar">
        <div className="wrap admin-bar-top">
          <p className="admin-bar-title">Dashboard</p>
          <div className="admin-bar-actions">
            <span className="admin-account hidden sm:inline">{admin.email}</span>
            <a className="nav-link shrink-0" href="/" target="_blank" rel="noreferrer">View shop</a>
            <SignOutButton redirectUrl="/admin/login">
              <button className="nav-link shrink-0" type="button">Sign out</button>
            </SignOutButton>
          </div>
        </div>
        <AdminTabs />
      </header>
      <main id="content" className="wrap admin-main">{children}</main>
    </div>
  )
}
