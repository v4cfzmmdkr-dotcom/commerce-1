"use client"

import { useActionState } from "react"
import { login } from "@/app/admin/login/actions"

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action] = useActionState(login, null)
  return (
    <main id="content" className="wrap flex min-h-screen items-center py-16">
      <form action={action} className="grid w-full max-w-sm gap-4">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <input type="hidden" name="next" value={nextPath} />
        <label className="label">Email<input className="field normal-case" name="email" type="email" autoComplete="username" required /></label>
        <label className="label">Password<input className="field normal-case" name="password" type="password" autoComplete="current-password" required /></label>
        {state?.error ? <p className="text-sm">{state.error}</p> : null}
        <button className="btn" type="submit">Sign in</button>
      </form>
    </main>
  )
}
