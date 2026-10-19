import type { ThemeSettings } from "@/lib/types"

export const defaultTheme: ThemeSettings = {
  background: "#ffffff",
  foreground: "#111111",
  muted: "#f3f3f3",
  accent: "#111111",
  accentForeground: "#ffffff",
  border: "#e6e6e6",
  font: "system",
  density: "comfortable",
  radius: "medium",
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

function luminance(hexColor: string) {
  const channel = (offset: number) => {
    const value = parseInt(hexColor.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export function darkTheme(theme: ThemeSettings): ThemeSettings {
  if (luminance(theme.background) < luminance(theme.foreground)) return theme
  const accentIsDark = luminance(theme.accent) < 0.4
  return {
    ...theme,
    background: "#000000",
    foreground: "#f5f5f7",
    muted: "#1c1c1e",
    border: "#38383a",
    accent: accentIsDark ? "#f5f5f7" : theme.accent,
    accentForeground: accentIsDark ? "#000000" : theme.accentForeground,
  }
}

function themeBlock(theme: ThemeSettings) {
  return `--bg:${theme.background};--fg:${theme.foreground};--muted:${theme.muted};--accent:${theme.accent};--accent-fg:${theme.accentForeground};--border:${theme.border};`
}

export function themeCss(theme: ThemeSettings) {
  return `:root{${themeBlock(theme)}color-scheme:light}@media (prefers-color-scheme: dark){:root{${themeBlock(darkTheme(theme))}color-scheme:dark}}@media (prefers-contrast: more){:root{--border:var(--fg)}}`
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
