import { ClerkProvider } from "@clerk/nextjs"

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signInUrl="/admin/login" afterSignOutUrl="/admin/login">
      {children}
    </ClerkProvider>
  )
}
