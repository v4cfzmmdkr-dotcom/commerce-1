export function assertPublicHttps(value: string) {
  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error("Store URL must start with https")
  if (url.username || url.password) throw new Error("Store URL cannot include credentials")
  const host = url.hostname.toLowerCase()
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.includes(":")
  ) {
    throw new Error("Store URL must be a public hostname")
  }
  return url.origin
}

export type RemoteCollection = {
  title: string
  handle: string
  descriptionHtml: string
  imageUrl: string | null
  position: number
  productHandles: string[]
}

export async function fetchShopifyCollections(storeUrl: string) {
  const origin = assertPublicHttps(storeUrl)
  const response = await fetch(`${origin}/collections.json`, {
    headers: { accept: "application/json" },
  })
  if (!response.ok) throw new Error(`Could not read collections (${response.status})`)
  const body = (await response.json()) as {
    collections?: Array<{
      title: string
      handle: string
      description: string | null
      image?: { src?: string } | null
    }>
  }
  const collections = body.collections ?? []
  const result: RemoteCollection[] = []
  for (const [index, collection] of collections.entries()) {
    if (!/^[a-z0-9-]+$/i.test(collection.handle)) continue
    const productHandles: string[] = []
    for (let page = 1; page <= 20; page += 1) {
      const productResponse = await fetch(
        `${origin}/collections/${collection.handle}/products.json?limit=250&page=${page}`,
        { headers: { accept: "application/json" } },
      )
      if (!productResponse.ok) {
        throw new Error(`Could not read collection ${collection.handle} (${productResponse.status})`)
      }
      const products = (await productResponse.json()) as { products?: Array<{ handle: string }> }
      const batch = products.products ?? []
      productHandles.push(...batch.map((product) => product.handle).filter(Boolean))
      if (batch.length < 250) break
    }
    result.push({
      title: collection.title,
      handle: collection.handle,
      descriptionHtml: collection.description || "",
      imageUrl: collection.image?.src || null,
      position: index,
      productHandles,
    })
  }
  return result
}
