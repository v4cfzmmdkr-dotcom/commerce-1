import { LoginForm } from "@/app/admin/login/login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  return <LoginForm nextPath={params.next && params.next.startsWith("/admin") ? params.next : "/admin"} />
}
