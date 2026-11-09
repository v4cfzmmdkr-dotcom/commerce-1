import Link from "next/link"
import { updateCart } from "@/app/(shop)/cart/actions"
import { CartQuantity } from "@/components/cart-quantity"
import { ProductGrid } from "@/components/product-grid"
import { SwipeToDelete } from "@/components/swipe-to-delete"
import { getCart } from "@/lib/cart"
import { listFeaturedProducts } from "@/lib/catalog"
import { formatMoney } from "@/lib/money"
import { getSettings } from "@/lib/settings"

export const metadata = { title: "Cart" }

export default async function CartPage() {
  const [cart, settings, featured] = await Promise.all([getCart(), getSettings(), listFeaturedProducts()])
  const inCart = new Set(cart.lines.map((line) => line.productHandle))
  const suggestions = featured.filter((product) => !inCart.has(product.handle)).slice(0, 8)
  const subtotal = cart.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  return (
    <div className="wrap py-[var(--section)]">
      <h1 className="text-3xl font-semibold tracking-tight">Cart</h1>
      {cart.lines.length === 0 ? (
        <div className="cart-empty glass mt-8">
          <p>Your cart is empty.</p>
          <Link href="/search" className="btn">Browse parts</Link>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_300px]">
          <ul className="cart-lines glass">
            {cart.lines.map((line) => (
              <SwipeToDelete key={line.id} action={updateCart} fields={{ itemId: line.id, quantity: "0" }} fullSwipe className="cart-line">
                <div className="product-media">
                  {line.imageUrl ? <img src={line.imageUrl} alt={line.productTitle} /> : null}
                </div>
                <div>
                  <Link href={`/products/${line.productHandle}`} className="font-medium no-underline">{line.productTitle}</Link>
                  {line.variantTitle ? <p className="text-sm opacity-70">{line.variantTitle}</p> : null}
                  <p className="mt-1 text-sm">{formatMoney(line.unitPriceCents, settings.currency)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CartQuantity itemId={line.id} quantity={line.quantity} />
                    <form action={updateCart}>
                      <input type="hidden" name="itemId" value={line.id} />
                      <input type="hidden" name="quantity" value="0" />
                      <button className="cart-remove glass" type="submit">Remove</button>
                    </form>
                  </div>
                </div>
              </SwipeToDelete>
            ))}
          </ul>
          <aside className="cart-summary glass">
            <p className="flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(subtotal, settings.currency)}</span></p>
            <p className="mt-2 text-xs opacity-70">Shipping and GST are confirmed at checkout.</p>
            <Link href="/checkout" className="btn mt-4 w-full">Checkout</Link>
          </aside>
        </div>
      )}
      {suggestions.length > 0 ? (
        <section className="mt-12">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="collection-group-title">Suggested parts</h2>
            <Link href="/search" className="view-all glass no-underline">View all</Link>
          </div>
          <ProductGrid products={suggestions} currency={settings.currency} />
        </section>
      ) : null}
    </div>
  )
}
