"use client"

import { useState } from "react"
import { saveTheme } from "@/app/admin/actions"
import type { ThemeSettings } from "@/lib/types"

export function ThemeEditor({ theme }: { theme: ThemeSettings }) {
  const [draft, setDraft] = useState(theme)
  const set = (key: keyof ThemeSettings, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  return (
    <form action={saveTheme} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["background", "Background"],
            ["foreground", "Text"],
            ["muted", "Muted surface"],
            ["accent", "Buttons"],
            ["accentForeground", "Button text"],
            ["border", "Borders"],
          ] as const).map(([key, label]) => (
            <label key={key} className="label">
              {label}
              <span className="flex gap-2 normal-case">
                <input type="color" value={draft[key]} onChange={(event) => set(key, event.target.value)} />
                <input className="field" name={key} value={draft[key]} onChange={(event) => set(key, event.target.value)} />
              </span>
            </label>
          ))}
        </div>
        <label className="label">
          Type
          <select className="select normal-case" name="font" value={draft.font} onChange={(event) => set("font", event.target.value)}>
            <option value="archivo">Archivo</option>
            <option value="plex">IBM Plex Sans</option>
            <option value="inter">Inter</option>
            <option value="system">System (San Francisco on Apple)</option>
          </select>
        </label>
        <label className="label">
          Spacing
          <select className="select normal-case" name="density" value={draft.density} onChange={(event) => set("density", event.target.value)}>
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
        <label className="label">
          Corners
          <select className="select normal-case" name="radius" value={draft.radius} onChange={(event) => set("radius", event.target.value)}>
            <option value="none">Square</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label className="label">
          Logo
          <input className="normal-case" name="logo" type="file" accept="image/*" />
        </label>
        <button className="btn" type="submit">Save theme</button>
      </div>
      <aside
        data-density={draft.density}
        data-radius={draft.radius}
        className="border p-4"
        style={{
          background: draft.background,
          color: draft.foreground,
          borderColor: draft.border,
          borderRadius: draft.radius === "none" ? 0 : draft.radius === "small" ? 4 : draft.radius === "medium" ? 10 : 18,
        }}
      >
        <p className="text-xs uppercase tracking-[0.16em]">Preview</p>
        <p className="mt-3 font-semibold" style={{ fontSize: draft.density === "compact" ? "1.4rem" : draft.density === "spacious" ? "2.2rem" : "1.8rem" }}>
          Australian made parts
        </p>
        <button
          type="button"
          className="mt-4 px-3 py-2 text-sm"
          style={{ background: draft.accent, color: draft.accentForeground, borderRadius: "inherit" }}
        >
          Add to cart
        </button>
      </aside>
    </form>
  )
}
