"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { importStep } from "@/app/admin/bulk-import-actions"

type Progress = { imported: number, failed: number, approved: number, remaining: number }

export function BulkImportRunner({ batchId, active, initial }: { batchId: string, active: boolean, initial: Progress }) {
  const router = useRouter()
  const [progress, setProgress] = useState(initial)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const started = useRef(false)

  const run = async () => {
    if (started.current) return
    started.current = true
    setRunning(true)
    setMessage(null)
    let failures = 0
    try {
      for (;;) {
        let step
        try {
          step = await importStep(batchId)
          failures = 0
        } catch {
          failures += 1
          if (failures >= 3) {
            setMessage("The connection dropped. Nothing is lost: press Resume to carry on where it stopped.")
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 2000 * failures))
          continue
        }
        setProgress({ imported: step.counts.imported, failed: step.counts.failed, approved: step.counts.approved, remaining: step.remaining })
        router.refresh()
        if (step.remaining === 0 || step.status !== "importing") {
          setMessage(step.counts.failed ? `Finished with ${step.counts.failed} failed. Check them below and retry.` : "Import finished.")
          break
        }
        if (step.imported === 0 && step.failed === 0) await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    } finally {
      started.current = false
      setRunning(false)
      router.refresh()
    }
  }

  useEffect(() => {
    if (active) void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const done = progress.imported + progress.failed
  const fraction = progress.approved ? Math.min(1, done / progress.approved) : 0
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          {progress.imported} imported{progress.failed ? `, ${progress.failed} failed` : ""} of {progress.approved} approved
        </span>
        <span className="admin-note">{progress.remaining ? `${progress.remaining} waiting` : running ? "Finishing…" : ""}</span>
      </div>
      <div className="print-progress" data-done={(!progress.remaining && progress.approved > 0 && !progress.failed) || undefined}>
        <span style={{ width: `${Math.max(2, fraction * 100)}%` }} />
      </div>
      {progress.remaining > 0 && !running ? (
        <button className="btn w-fit" type="button" onClick={() => void run()}>Resume import</button>
      ) : null}
      {running ? <p className="admin-note text-sm" aria-live="polite">Importing. Keep this page open, or come back later to resume.</p> : null}
      {message ? <p className="text-sm" role="status">{message}</p> : null}
    </div>
  )
}
