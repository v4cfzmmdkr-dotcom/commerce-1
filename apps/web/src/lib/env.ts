import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

// Same precedence as Next.js: values in .env.local win over .env.
export function loadEnvFile() {
  for (const name of [".env.local", ".env"]) loadFile(path.resolve(process.cwd(), name))
}

function loadFile(file: string) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const index = trimmed.indexOf("=")
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}
