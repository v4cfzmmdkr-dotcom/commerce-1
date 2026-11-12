"use client"

import { useActionState, useState } from "react"
import { createConnectedAppKey } from "@/app/admin/bulk-import-actions"

export function ConnectedAppKey({ shopUrl }: { shopUrl: string }) {
  const [state, action, pending] = useActionState(createConnectedAppKey, null)
  const [copied, setCopied] = useState(false)

  if (state?.key) {
    return (
      <div className="grid gap-2" role="status">
        <p className="text-sm font-medium">Key for {state.name} created. Copy it now; it is not shown again.</p>
        <code className="admin-card select-all break-all p-3 text-sm">{state.key}</code>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => navigator.clipboard.writeText(state.key).then(() => setCopied(true))}
          >
            {copied ? "Copied" : "Copy key"}
          </button>
          <span className="admin-note text-sm">
            In the sourcing app open Settings, Shop connection, and paste it with the shop address {shopUrl}
          </span>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="label grow">
        Name
        <input className="field normal-case" name="name" defaultValue="Niche Parts Sourcing" maxLength={80} />
      </label>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Creating…" : "Create key"}</button>
    </form>
  )
}
