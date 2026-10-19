import type { ThemeSettings } from "@/lib/types"

export const defaultTheme: ThemeSettings = {
  background: "#ffffff",
  foreground: "#111111",
  muted: "#f3f3f3",
  accent: "#111111",
  accentForeground: "#ffffff",
  border: "#e6e6e6",
  font: "archivo",
  density: "comfortable",
  radius: "none",
}

const fonts = new Set<ThemeSettings["font"]>(["archivo", "plex", "inter", "system"])
const densities = new Set<ThemeSettings["density"]>(["compact", "comfortable", "spacious"])
const radii = new Set<ThemeSettings["radius"]>(["none", "small", "medium", "large"])

function hex(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const next = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(next) ? next : fallback
}

export function parseTheme(value: unknown): ThemeSettings {
  const raw = value && typeof value === "object" ? (value as Partial<ThemeSettings>) : {}
  return {
    background: hex(raw.background, defaultTheme.background),
    foreground: hex(raw.foreground, defaultTheme.foreground),
    muted: hex(raw.muted, defaultTheme.muted),
    accent: hex(raw.accent, defaultTheme.accent),
    accentForeground: hex(raw.accentForeground, defaultTheme.accentForeground),
    border: hex(raw.border, defaultTheme.border),
    font: fonts.has(raw.font as ThemeSettings["font"]) ? (raw.font as ThemeSettings["font"]) : defaultTheme.font,
    density: densities.has(raw.density as ThemeSettings["density"])
      ? (raw.density as ThemeSettings["density"])
      : defaultTheme.density,
    radius: radii.has(raw.radius as ThemeSettings["radius"])
      ? (raw.radius as ThemeSettings["radius"])
      : defaultTheme.radius,
  }
}

export function themeStyle(theme: ThemeSettings): Record<string, string> {
  return {
    "--bg": theme.background,
    "--fg": theme.foreground,
    "--muted": theme.muted,
    "--accent": theme.accent,
    "--accent-fg": theme.accentForeground,
    "--border": theme.border,
  }
}
