import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.fn(() => {
  throw new Error("database touched")
})

vi.mock("@/lib/auth/current", () => ({
  currentAdmin: vi.fn(async () => null),
  requireAdmin: vi.fn(async () => {
    throw new Error("NEXT_REDIRECT:/admin/login")
  }),
}))

vi.mock("@/db/client", () => ({
  getSql: database,
  databaseConfigured: () => true,
  textArray: (value: unknown) => value,
  textArrayLiteral: (values: string[]) => values.join(","),
}))

function form(values: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe("bulk import access control", () => {
  beforeEach(() => {
    database.mockClear()
  })

  it("refuses package previews and uploads without an admin session", async () => {
    const preview = await import("@/app/api/admin/bulk-import/[id]/file/route")
    const upload = await import("@/app/api/admin/bulk-import/[id]/package/route")
    const params = Promise.resolve({ id: "batch" })
    expect((await preview.GET(new Request("http://shop.test/api/admin/bulk-import/batch/file?path=images/a.png"), { params })).status).toBe(401)
    expect((await upload.PUT(new Request("http://shop.test/api/admin/bulk-import/batch/package", { method: "PUT", body: "zip" }), { params })).status).toBe(401)
    expect(database).not.toHaveBeenCalled()
  })

  it("refuses every server action without an admin session", async () => {
    const actions = await import("@/app/admin/bulk-import-actions")
    const fields = form({ batchId: "batch", itemIds: "item", decision: "approved" })
    const calls: Array<() => Promise<unknown>> = [
      () => actions.startBulkImport("package.zip", 100),
      () => actions.finishBulkImport("batch"),
      () => actions.decideItems(fields),
      () => actions.approveAllItems(fields),
      () => actions.rejectPendingItems(fields),
      () => actions.startImport(fields),
      () => actions.retryFailedItems(fields),
      () => actions.pauseImport(fields),
      () => actions.removeImportPackage(fields),
      () => actions.deleteImport(fields),
      () => actions.importStep("batch"),
      () => actions.createConnectedAppKey(null, form({ name: "App" })),
      () => actions.revokeConnectedAppKey(form({ keyId: "key" })),
      () => actions.archivePreviousListingsAction(form({ confirm: "on" })),
      () => actions.restorePreviousListingsAction(),
    ]
    for (const call of calls) await expect(call()).rejects.toThrow(/NEXT_REDIRECT/)
    expect(database).not.toHaveBeenCalled()
  })

  it("refuses the sourcing app API without a well-formed key", async () => {
    const params = Promise.resolve({ id: "batch" })
    const routes = await Promise.all([
      import("@/app/api/sourcing/v1/route").then((route) => route.GET(new Request("http://shop.test/api/sourcing/v1"))),
      import("@/app/api/sourcing/v1/batches/route").then((route) => route.POST(new Request("http://shop.test/api/sourcing/v1/batches", {
        method: "POST",
        headers: { authorization: "Bearer not-a-key" },
        body: "{}",
      }))),
      import("@/app/api/sourcing/v1/batches/[id]/route").then((route) => route.GET(new Request("http://shop.test/x"), { params })),
      import("@/app/api/sourcing/v1/batches/[id]/package/route").then((route) => route.PUT(new Request("http://shop.test/x", { method: "PUT", body: "zip" }), { params })),
      import("@/app/api/sourcing/v1/batches/[id]/validate/route").then((route) => route.POST(new Request("http://shop.test/x", { method: "POST" }), { params })),
      import("@/app/api/sourcing/v1/batches/[id]/import/route").then((route) => route.POST(new Request("http://shop.test/x", { method: "POST" }), { params })),
      import("@/app/api/sourcing/v1/batches/[id]/step/route").then((route) => route.POST(new Request("http://shop.test/x", { method: "POST" }), { params })),
    ])
    expect(routes.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401])
    expect(database).not.toHaveBeenCalled()
  })

  it("only runs the background step with the cron secret", async () => {
    const cron = await import("@/app/api/cron/bulk-import/route")
    delete process.env.CRON_SECRET
    expect((await cron.GET(new Request("http://shop.test/api/cron/bulk-import"))).status).toBe(401)
    process.env.CRON_SECRET = "s3cret-value"
    expect((await cron.GET(new Request("http://shop.test/api/cron/bulk-import", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401)
    expect(database).not.toHaveBeenCalled()
    delete process.env.CRON_SECRET
  })

  it("keeps the admin API behind Clerk middleware", async () => {
    vi.doMock("@clerk/nextjs/server", () => ({
      clerkMiddleware: (handler: unknown) => handler,
      createRouteMatcher: () => () => false,
    }))
    const { config } = await import("@/middleware")
    expect(config.matcher).toEqual(expect.arrayContaining(["/admin/:path*", "/api/admin/:path*"]))
  })
})
