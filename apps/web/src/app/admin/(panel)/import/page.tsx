import { downloadImageBatch, runImport } from "@/app/admin/actions"
import { getSql } from "@/db/client"
import type { ImportReport } from "@/lib/types"

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string, collections?: string, collectionError?: string, images?: string }>
}) {
  const params = await searchParams
  const sql = getSql()
  const pending = await sql<{ count: number }[]>`
    select count(*)::int as count from product_images where storage_path is null and source_url is not null
  `
  const runs = params.run
    ? await sql<Array<{ report: ImportReport }>>`select report from import_runs where id = ${params.run}`
    : []
  const report = runs[0]?.report
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="text-3xl font-semibold">Import</h1>
      <p className="text-sm">Upload a Shopify product CSV. Products are matched by handle, so importing the same file again updates them. Images are copied into this shop’s storage. A large catalogue should also be imported with the local command so every image can finish.</p>
      <p className="text-sm">{pending[0]?.count ?? 0} images are still hosted on Shopify.</p>
      {params.images ? <p className="text-sm">Image batch finished.</p> : null}
      {params.collections ? <p className="text-sm">Synced {params.collections} collections.</p> : null}
      {params.collectionError ? <p className="text-sm">{params.collectionError}</p> : null}
      <form action={runImport} className="grid gap-3">
        <input name="file" type="file" accept=".csv,text/csv" required />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="images" defaultChecked /> Download a batch of images now</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="collections" defaultChecked /> Sync collections from the live store</label>
        <label className="label">Store URL<input className="field normal-case" name="storeUrl" defaultValue="https://nicheparts.com.au" /></label>
        <button className="btn w-fit" type="submit">Import CSV</button>
      </form>
      <form action={downloadImageBatch}>
        <button className="btn-ghost" type="submit">Download the next image batch</button>
      </form>
      {report ? (
        <section className="grid gap-2 text-sm">
          <h2 className="text-lg">Last report</h2>
          <p>Created {report.productsCreated}, updated {report.productsUpdated}, skipped {report.productsSkipped}, variants {report.variantsImported}.</p>
          <p>Images waiting {report.imagesPending}. Failures {report.failures.length}. Warnings {report.warnings.length}.</p>
          <ul>
            {report.failures.slice(0, 20).map((issue, index) => (
              <li key={index}>Record {issue.record} {issue.handle}: {issue.message}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
