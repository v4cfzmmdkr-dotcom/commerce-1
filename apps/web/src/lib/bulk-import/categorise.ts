import { getSql } from "@/db/client"
import { slugify } from "@/lib/slug"

export type CollectionProfile = {
  id: string
  handle: string
  title: string
  products: Array<{ title: string, tags: string[], productType: string }>
}

export type ProductText = {
  title: string
  category?: string
  tags?: string[]
  description?: string
}

export type Categorisation = {
  method: "category" | "auto" | "none"
  collections: Array<{ id: string, title: string, score: number }>
}

type Model = {
  collections: Array<{
    id: string
    handle: string
    title: string
    weights: Map<string, number>
    norm: number
    nameWords: string[]
    markers: string[]
  }>
  idf: Map<string, number>
}

// Scores run from 0 to 1. Measured against the shop's own catalogue, matches above this are
// right about nine times in ten; weaker ones are left for a person.
export const minimumScore = 0.2
const secondChoiceRatio = 0.6
const nameBonus = 0.15

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it", "of", "on", "or",
  "the", "to", "with", "without", "your", "you", "this", "that", "these", "set", "pcs", "pc", "piece", "pieces",
  "pack", "pair", "x", "mm", "cm", "inch", "imported", "3d", "printed", "print", "printing", "printable", "new",
  "compatible", "fits", "fit", "type", "version", "v", "style", "design", "model", "includes", "include", "ideal",
  "great", "perfect", "easy", "use", "used", "using", "high", "quality", "durable", "custom", "diy", "petg", "pla",
  "abs", "asa", "filament",
])

function stem(word: string) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`
  if (word.length > 4 && /(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1)
  return word
}

export function tokens(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !/^\d+$/.test(word) && !stopWords.has(word))
    .map(stem)
}

function add(target: Map<string, number>, words: string[], weight: number) {
  for (const word of words) target.set(word, (target.get(word) ?? 0) + weight)
}

function productVector(product: ProductText) {
  const vector = new Map<string, number>()
  add(vector, tokens(product.title), 2)
  add(vector, tokens(product.category ?? ""), 2)
  add(vector, (product.tags ?? []).flatMap(tokens), 1)
  add(vector, tokens((product.description ?? "").slice(0, 600)), 0.3)
  return vector
}

export function buildModel(profiles: CollectionProfile[]): Model {
  const raw = profiles.map((profile) => {
    const counts = new Map<string, number>()
    const name = [...tokens(profile.title), ...tokens(profile.handle.replace(/-/g, " "))]
    add(counts, [...new Set(name)], Math.max(4, profile.products.length * 0.6))
    for (const product of profile.products) {
      add(counts, [...new Set(tokens(product.title))], 1)
      add(counts, [...new Set([...product.tags.flatMap(tokens), ...tokens(product.productType)])], 0.5)
    }
    return { profile, counts }
  })
  const documentFrequency = new Map<string, number>()
  for (const { counts } of raw) for (const word of counts.keys()) documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1)
  const total = Math.max(1, raw.length)
  const idf = new Map([...documentFrequency].map(([word, df]) => [word, Math.log((total + 1) / (df + 1)) + 1]))
  const nameUse = new Map<string, number>()
  const names = raw.map(({ profile }) => [...new Set(tokens(`${profile.title} ${profile.handle.replace(/-/g, " ")}`))])
  for (const words of names) for (const word of words) nameUse.set(word, (nameUse.get(word) ?? 0) + 1)
  return {
    idf,
    collections: raw.map(({ profile, counts }, index) => {
      const weights = new Map<string, number>()
      for (const [word, count] of counts) weights.set(word, Math.log(1 + count) * (idf.get(word) ?? 1))
      const norm = Math.sqrt([...weights.values()].reduce((sum, value) => sum + value * value, 0)) || 1
      const nameWords = names[index].filter((word) => nameUse.get(word) === 1)
      // A word from the collection name that most of its products mention, like a brand, must
      // appear in the product too: "Yamaha Gears" should not collect every speedometer gear.
      const markers = profile.products.length < 3 ? [] : nameWords.filter((word) => {
        const mentions = profile.products.filter((product) => tokens(`${product.title} ${product.tags.join(" ")}`).includes(word)).length
        return mentions / profile.products.length >= 0.5
      })
      return { id: profile.id, handle: profile.handle, title: profile.title, weights, norm, nameWords, markers }
    }),
  }
}

export function categorise(model: Model, product: ProductText): Categorisation {
  const category = (product.category ?? "").trim()
  if (category) {
    const handle = slugify(category)
    const exact = model.collections.find((collection) => collection.handle === handle || collection.title.toLowerCase() === category.toLowerCase())
    if (exact) return { method: "category", collections: [{ id: exact.id, title: exact.title, score: 1 }] }
  }
  const vector = new Map<string, number>()
  for (const [word, count] of productVector(product)) {
    if (model.idf.has(word)) vector.set(word, Math.log(1 + count) * model.idf.get(word)!)
  }
  const norm = Math.sqrt([...vector.values()].reduce((sum, value) => sum + value * value, 0))
  if (!norm) return { method: "none", collections: [] }
  const mentioned = new Set([...tokens(product.title), ...tokens(product.category ?? ""), ...(product.tags ?? []).flatMap(tokens)])
  const scored = model.collections
    .filter((collection) => !collection.markers.length || collection.markers.some((word) => mentioned.has(word)))
    .map((collection) => {
      let dot = 0
      for (const [word, value] of vector) dot += value * (collection.weights.get(word) ?? 0)
      const named = collection.nameWords.filter((word) => mentioned.has(word)).length
      return {
        id: collection.id,
        title: collection.title,
        branded: collection.markers.length > 0,
        score: Math.min(1, dot / (norm * collection.norm) + named * nameBonus),
      }
    })
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score < minimumScore) return { method: "none", collections: [] }
  // A brand collection the product names sits alongside its best type match, like DeWalt Parts and Wall Mounts.
  const second = scored.slice(1).find((item) => item.branded !== best.branded
    && item.score >= minimumScore && item.score >= best.score * secondChoiceRatio)
  const chosen = second ? [best, second] : [best]
  return {
    method: "auto",
    collections: chosen.map((item) => ({ id: item.id, title: item.title, score: Math.round(item.score * 1000) / 1000 })),
  }
}

export async function loadCollectionProfiles(excludeProductIds: string[] = []): Promise<CollectionProfile[]> {
  const sql = getSql()
  const collections = await sql<Array<{ id: string, handle: string, title: string }>>`
    select id, handle, title from collections order by position, title
  `
  const members = await sql<Array<{ collectionId: string, productId: string, title: string, tags: string, productType: string }>>`
    select cp.collection_id as "collectionId", p.id as "productId", p.title, p.tags::text as tags, p.product_type as "productType"
    from collection_products cp join products p on p.id = cp.product_id
  `
  const skip = new Set(excludeProductIds)
  return collections.map((collection) => ({
    ...collection,
    products: members
      .filter((member) => member.collectionId === collection.id && !skip.has(member.productId))
      .map((member) => ({ title: member.title, tags: parseTextArray(member.tags), productType: member.productType ?? "" })),
  }))
}

function parseTextArray(value: string) {
  if (!value || value === "{}") return []
  const items: string[] = []
  const pattern = /"((?:[^"\\]|\\.)*)"|([^,{}]+)/g
  for (const match of value.slice(1, -1).matchAll(pattern)) items.push(match[1] !== undefined ? match[1].replace(/\\(.)/g, "$1") : match[2])
  return items
}

let cached: { model: Model, at: number } | null = null

export async function loadCategoriser() {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.model
  const model = buildModel(await loadCollectionProfiles())
  cached = { model, at: Date.now() }
  return model
}

export function forgetCategoriser() {
  cached = null
}
