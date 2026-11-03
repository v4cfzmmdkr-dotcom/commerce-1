import { NextResponse } from "next/server"
import { getSql } from "@/db/client"
import { currentAdmin } from "@/lib/auth/current"
import { readLocalPrintFile, signPrintFileDownload } from "@/lib/print-files"
import { storageMode } from "@/lib/storage"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin()
  if (!admin) return new Response("Unauthorized", { status: 401 })
  const { id } = await params
  const rows = await getSql()<{ fileName: string, storagePath: string }[]>`
    select file_name as "fileName", storage_path as "storagePath" from product_print_files where id = ${id}
  `
  const file = rows[0]
  if (!file) return new Response("Not found", { status: 404 })
  if (storageMode() === "supabase") {
    return NextResponse.redirect(await signPrintFileDownload(file.storagePath, file.fileName), { headers: { "Cache-Control": "no-store" } })
  }
  const bytes = await readLocalPrintFile(file.storagePath)
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "no-store",
    },
  })
}
