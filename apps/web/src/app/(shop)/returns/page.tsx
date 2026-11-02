import Link from "next/link"
import { RETURN_DAYS } from "@/lib/returns"

export const metadata = {
  title: "Returns",
  description: `Not happy with your part? Return it within ${RETURN_DAYS} days for a refund.`,
  alternates: { canonical: "/returns" },
}

export default function ReturnsPage() {
  return (
    <div className="wrap max-w-2xl py-[var(--section)]">
      <h1 className="text-3xl font-semibold tracking-tight">Returns</h1>
      <div className="prose mt-6">
        <h2>Change of mind</h2>
        <p>
          If you are not happy with your purchase, you can return it within {RETURN_DAYS} days of receiving it for a
          refund. Return shipping is paid by the customer.
        </p>
        <p>
          <Link href="/contact">Contact us</Link> with your order number before sending anything back and we will give you
          the return address. Once the part arrives, we refund the item price to your original payment method.
        </p>
        <h2>Faulty or not as described</h2>
        <p>
          This policy does not limit your rights under the Australian Consumer Law. If a part is faulty, damaged in
          transit, or not as described, contact us and we will arrange a replacement or refund and cover reasonable return
          postage.
        </p>
      </div>
    </div>
  )
}
