import Link from "next/link"
import { updateCart } from "@/app/(shop)/cart/actions"
import { CartQuantity } from "@/components/cart-quantity"
import { getCart } from "@/lib/cart"
import { formatMoney } from "@/lib/money"
import { getSettings } from "@/lib/settings"

export const metadata = { title: "Cart" }

export default async function CartPage() {
  const [cart, settings] = await Promise.all([getCart(), getSettings()])
  const subtotal = cart.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  return (
    <div className="wrap py-[var(--section)]">
      <h1 className="text-3xl font-semibold tracking-tight">Cart</h1>
      {cart.lines.length === 0 ? (
        <p className="mt-6 text-sm">Your cart is empty. <Link href="/search">Browse parts</Link>.</p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
          <ul className="grid gap-6">
            {cart.lines.map((line) => (
              <li key={line.id} className="grid grid-cols-[88px_1fr] gap-4 border-b border-[var(--border)] pb-6">
                <div className="product-media">
                  {line.imageUrl ? <img src={line.imageUrl} alt={line.productTitle} /> : null}
                </div>
                <div>
                  <Link href={`/products/${line.productHandle}`} className="font-medium no-underline">{line.productTitle}</Link>
                  {line.variantTitle ? <p className="text-sm">{line.variantTitle}</p> : null}
                  <p className="mt-1 text-sm">{formatMoney(line.unitPriceCents, settings.currency)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CartQuantity itemId={line.id} quantity={line.quantity} />
                    <form action={updateCart}>
                      <input type="hidden" name="itemId" value={line.id} />
                      <input type="hidden" name="quantity" value="0" />
                      <button className="btn-ghost" type="submit">Remove</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="h-fit border border-[var(--border)] p-4">
            <p className="flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(subtotal, settings.currency)}</span></p>
            <p className="mt-2 text-xs">Shipping and GST are confirmed at checkout.</p>
            <Link href="/checkout" className="btn mt-4 w-full">Checkout</Link>
          </aside>
        </div>
      )}
    </div>
  )
}
