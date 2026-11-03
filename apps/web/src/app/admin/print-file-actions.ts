"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getSql } from "@/db/client"
import { requireAdmin } from "@/lib/auth/current"
import {
  checkPrintFile,
  deletePrintFileObject,
  printFileBelongsTo,
  printFilePath,
  printFileSize,
  saveLocalPrintFile,
  signPrintFileUpload,
} from "@/lib/print-files"
import { storageMode } from "@/lib/storage"

type UploadStart = { ok: true, mode: "signed", path: string, uploadUrl: string } | { ok: true, mode: "local" } | { ok: false, error: string }

async function productExists(productId: string) {
  const rows = await getSql()<{ id: string }[]>`select id from products where id = ${productId}`
  return rows.length > 0
}

async function insertPrintFile(productId: string, objectPath: string, fileName: string, size: number) {
  await getSql()`
    insert into product_print_files (id, product_id, file_name, storage_path, size_bytes, position)
    values (
      ${randomUUID()}, ${productId}, ${fileName.slice(0, 200)}, ${objectPath}, ${size},
      coalesce((select max(position) + 1 from product_print_files where product_id = ${productId}), 0)
    )
  `
  revalidatePath(`/admin/products/${productId}`)
}

export async function startPrintFileUpload(productId: string, fileName: string, size: number): Promise<UploadStart> {
  await requireAdmin()
  const problem = checkPrintFile(fileName, size)
  if (problem) return { ok: false, error: problem }
  if (!(await productExists(productId))) return { ok: false, error: "Product not found" }
  if (storageMode() === "local") return { ok: true, mode: "local" }
  const objectPath = printFilePath(productId, fileName)
  return { ok: true, mode: "signed", path: objectPath, uploadUrl: await signPrintFileUpload(objectPath) }
}

export async function finishPrintFileUpload(productId: string, objectPath: string, fileName: string) {
  await requireAdmin()
  if (!printFileBelongsTo(objectPath, productId) || checkPrintFile(fileName, 1)) return { ok: false, error: "Upload did not match this product" }
  const size = await printFileSize(objectPath)
  if (!size) return { ok: false, error: "The upload did not reach storage. Try again." }
  await insertPrintFile(productId, objectPath, fileName, size)
  return { ok: true }
}

export async function uploadLocalPrintFile(formData: FormData) {
  await requireAdmin()
  if (storageMode() !== "local") return { ok: false, error: "Uploads go straight to storage" }
  const productId = String(formData.get("productId") || "")
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "Choose a file" }
  const problem = checkPrintFile(file.name, file.size)
  if (problem) return { ok: false, error: problem }
  if (!(await productExists(productId))) return { ok: false, error: "Product not found" }
  const objectPath = printFilePath(productId, file.name)
  await saveLocalPrintFile(objectPath, Buffer.from(await file.arrayBuffer()))
  await insertPrintFile(productId, objectPath, file.name, file.size)
  return { ok: true }
}

export async function updatePrintFile(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get("id") || "")
  const productId = String(formData.get("productId") || "")
  const copies = Math.min(100, Math.max(1, Math.round(Number(formData.get("copies")) || 1)))
  const variantId = String(formData.get("variantId") || "") || null
  const notes = String(formData.get("notes") || "").trim().slice(0, 500)
  await getSql()`
    update product_print_files
    set copies = ${copies}, notes = ${notes},
      variant_id = (select id from variants where id = ${variantId} and product_id = ${productId})
    where id = ${id} and product_id = ${productId}
  `
  revalidatePath(`/admin/products/${productId}`)
}

export async function deletePrintFile(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get("id") || "")
  const productId = String(formData.get("productId") || "")
  const sql = getSql()
  const rows = await sql<{ storagePath: string }[]>`
    delete from product_print_files where id = ${id} and product_id = ${productId}
    returning storage_path as "storagePath"
  `
  if (rows[0]) await deletePrintFileObject(rows[0].storagePath)
  revalidatePath(`/admin/products/${productId}`)
}
