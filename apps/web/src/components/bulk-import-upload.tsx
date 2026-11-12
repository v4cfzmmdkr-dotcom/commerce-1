"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, type DragEvent } from "react"
import { finishBulkImport, startBulkImport } from "@/app/admin/bulk-import-actions"
import { formatFileSize } from "@/lib/print-file-rules"

type State =
  | { step: "idle" }
  | { step: "uploading", name: string, progress: number }
  | { step: "checking", name: string }
  | { step: "error", message: string }

function put(url: string, file: File, local: boolean, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("PUT", url)
    request.setRequestHeader("Content-Type", local ? "application/octet-stream" : "application/zip")
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    request.onload = () => (request.status < 300 ? resolve() : reject(new Error(request.responseText.slice(0, 200) || `Upload failed (${request.status})`)))
    request.onerror = () => reject(new Error("Upload failed. Check your connection and try again."))
    request.send(file)
  })
}

export function BulkImportUpload({ maxBytes }: { maxBytes: number }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ step: "idle" })
  const [dragging, setDragging] = useState(false)
  const busy = state.step === "uploading" || state.step === "checking"

  async function send(file: File | undefined) {
    if (!file || busy) return
    if (!/\.zip$/i.test(file.name)) return setState({ step: "error", message: "Choose a .zip product package" })
    if (file.size > maxBytes) return setState({ step: "error", message: `Packages must be under ${formatFileSize(maxBytes)}` })
    setState({ step: "uploading", name: file.name, progress: 0 })
    try {
      const start = await startBulkImport(file.name, file.size)
      if (!start.ok) return setState({ step: "error", message: start.error })
      await put(start.uploadUrl, file, start.mode === "local", (progress) => setState({ step: "uploading", name: file.name, progress }))
      setState({ step: "checking", name: file.name })
      const result = await finishBulkImport(start.batchId)
      if (!result.ok) return setState({ step: "error", message: result.error ?? "The package could not be checked" })
      router.push(`/admin/bulk-import/${start.batchId}`)
    } catch (error) {
      setState({ step: "error", message: error instanceof Error ? error.message : "Upload failed" })
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void send(event.dataTransfer.files[0])
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        className="print-drop"
        data-dragging={dragging || undefined}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>
        <span className="font-medium">Drop a product package or choose</span>
        <span className="admin-note">A .zip with manifest.json, products.json, images/ and models/, up to {formatFileSize(maxBytes)}</span>
      </button>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept=".zip,application/zip"
        tabIndex={-1}
        onChange={(event) => { void send(event.target.files?.[0]); event.target.value = "" }}
      />
      <div aria-live="polite" className="grid gap-1 text-sm">
        {state.step === "uploading" ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate">{state.name}</span>
              <span className="admin-note shrink-0">{Math.round(state.progress * 100)}%</span>
            </div>
            <div className="print-progress"><span style={{ width: `${Math.max(2, state.progress * 100)}%` }} /></div>
          </>
        ) : null}
        {state.step === "checking" ? <p>Uploaded {state.name}. Checking the package…</p> : null}
        {state.step === "error" ? <p className="text-[#ff3b30]" role="alert">{state.message}</p> : null}
      </div>
    </div>
  )
}
