"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  ["Overview", "/admin"],
  ["Products", "/admin/products"],
  ["Collections", "/admin/collections"],
  ["Orders", "/admin/orders"],
  ["Shipping", "/admin/shipping"],
  ["Theme", "/admin/theme"],
  ["Settings", "/admin/settings"],
]

export function AdminTabs() {
  const pathname = usePathname()
  return (
    <nav className="wrap admin-tabs" aria-label="Admin">
      {links.map(([label, href]) => {
        const current = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link key={href} className="admin-tab" href={href} aria-current={current ? "page" : undefined}>{label}</Link>
        )
      })}
    </nav>
  )
}
