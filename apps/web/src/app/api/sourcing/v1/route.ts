import { getSql } from "@/db/client"
import { apiJson, authorise } from "@/lib/bulk-import/api"
import { packageStorageSupported } from "@/lib/bulk-import/package-store"
import { limits, packageSchemaId, supportedMajorVersion, supportedMinorVersion } from "@/lib/bulk-import/schema"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const caller = await authorise(request)
  if (caller instanceof Response) return caller
  const collections = await getSql()<Array<{ handle: string, title: string }>>`
    select handle, title from collections order by position, title
  `
  return apiJson({
    ok: true,
    key: caller.name,
    uploads: packageStorageSupported(),
    schema: packageSchemaId,
    schemaVersion: `${supportedMajorVersion}.${supportedMinorVersion}`,
    limits,
    collections,
  })
}
