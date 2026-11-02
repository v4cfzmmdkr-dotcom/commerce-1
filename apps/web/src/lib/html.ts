import sanitizeHtml from "sanitize-html"

export function cleanHtml(input: string) {
  return sanitizeHtml(input, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "span",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title", "width", "height"],
      a: ["href", "name", "target", "rel"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  })
}

const blockTag = /<(p|br|ul|ol|li|div|h[1-6]|table|hr|blockquote)[\s>/]/i
const bulletMarker = /^(?:[-•*▪●◦–]\s+|(?:✅|✔️|✔|☑️|☑|🔹|🔸|📌|👉|⭐|✨|➡️|➡|→)\s*)/u
const numberMarker = /^\d{1,2}[.)]\s+/

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function inline(line: string) {
  const text = escapeHtml(line)
  const label = text.match(/^([^:.!?]{2,40}):\s+(.+)$/)
  return label ? `<strong>${label[1]}:</strong> ${label[2]}` : text
}

function isHeading(line: string) {
  return line.length <= 60 && /:$/.test(line) && !/[.!?]\s/.test(line)
}

function plainTextToHtml(text: string) {
  const out: string[] = []
  let paragraph: string[] = []
  let list: { tag: "ul" | "ol", items: string[] } | null = null

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.join("<br>")}</p>`)
    paragraph = []
  }
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((item) => `<li>${item}</li>`).join("")}</${list.tag}>`)
    list = null
  }

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim()
    if (!line) {
      flushParagraph()
      continue
    }
    const marker = line.match(bulletMarker) ?? line.match(numberMarker)
    if (marker) {
      flushParagraph()
      const tag = numberMarker.test(line) ? "ol" : "ul"
      if (list && list.tag !== tag) flushList()
      list ??= { tag, items: [] }
      list.items.push(inline(line.slice(marker[0].length)))
      continue
    }
    flushList()
    if (isHeading(line)) {
      flushParagraph()
      out.push(`<h3>${escapeHtml(line.replace(/:$/, ""))}</h3>`)
      continue
    }
    paragraph.push(inline(line))
  }
  flushParagraph()
  flushList()
  return out.join("")
}

// Most imported descriptions are plain text with line breaks, which HTML
// collapses into one run-on paragraph. Structure those; pass real HTML through.
export function formatDescription(input: string | null | undefined) {
  const text = (input ?? "").trim()
  if (!text) return ""
  return cleanHtml(blockTag.test(text) ? text : plainTextToHtml(text))
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", "#39": "'" }

// Search engines show roughly 155-160 characters of a meta description.
export function summaryText(input: string | null | undefined, max = 155) {
  const text = (input ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (match, name: string) => entities[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:-]+$/, "")}…`
}
