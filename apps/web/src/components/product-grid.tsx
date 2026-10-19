import Link from "next/link"
import { formatMoney } from "@/lib/money"
import type { ProductCard } from "@/lib/catalog"

export function ProductGrid({ products, currency }: { products: ProductCard[], currency: string }) {
  if (products.length === 0) {
    return <p className="text-sm">No parts match this view.</p>
  }
  return (
    <div className="card-grid">
      {products.map((product) => (
        <Link key={product.id} href={`/products/${product.handle}`} className="group no-underline">
          <div className="product-media">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.imageAlt || product.title} />
            ) : (
              <div className="flex h-full items-end p-3 text-xs tracking-wide">No image</div>
            )}
          </div>
          <h2 className="mt-3 text-sm leading-snug">{product.title}</h2>
          <p className="mt-1 text-sm">
            {formatMoney(product.priceCents, currency)}
            {!product.purchasable ? <span className="ml-2 text-xs uppercase tracking-wide">Sold out</span> : null}
          </p>
        </Link>
      ))}
    </div>
  )
}
