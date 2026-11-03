"use client"

import { usePathname } from "next/navigation"

export function HomeOnly({ children }: { children: React.ReactNode }) {
  return usePathname() === "/" ? children : null
}
