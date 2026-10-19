"use server"

import { revalidatePath } from "next/cache"
import { addVariantToCart, updateCartQuantity } from "@/lib/cart"

export async function addToCart(
  _previous: { error?: string, ok?: boolean } | null,
  formData: FormData,
) {
  const variantId = String(formData.get("variantId") || "")
  const quantity = Number(formData.get("quantity") || 1)
  if (!variantId) return { error: "Choose an option" }
  try {
    await addVariantToCart(variantId, Number.isFinite(quantity) ? quantity : 1)
    revalidatePath("/cart")
    revalidatePath("/", "layout")
    return { ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add to cart" }
  }
}

export async function updateCart(formData: FormData) {
  const itemId = String(formData.get("itemId") || "")
  const quantity = Number(formData.get("quantity") || 0)
  if (!itemId) return
  await updateCartQuantity(itemId, Number.isFinite(quantity) ? quantity : 0)
  revalidatePath("/cart")
  revalidatePath("/", "layout")
}
