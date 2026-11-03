"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, type DragEvent } from "react"
import { finishPrintFileUpload, startPrintFileUpload, uploadLocalPrintFile } from "@/app/admin/print-file-actions"
import { checkPrintFile, printFileAccept } from "@/lib/print-file-rules"

type Upload = { key: string, name: string, progress: number, error: string | null, done: boolean }

function put(url: string, file: File, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("PUT", url)
    request.setRequestHeader("Content-Type", "application/octet-stream")
    request.setRequestHeader("x-upsert", "true")
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    request.onload = () => (request.status < 300 ? resolve() : reject(new Error(`Upload failed (${request.status})`)))
    request.onerror = () => reject(new Error("Upload failed. Check your connection."))
    request.send(file)
  })
}

export function PrintFileUpload({ productId }: { productId: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)

  const patch = (key: string, change: Partial<Upload>) =>
    setUploads((current) => current.map((upload) => (upload.key === key ? { ...upload, ...change } : upload)))

  async function send(file: File, key: string) {
    const problem = checkPrintFile(file.name, file.size)
    if (problem) return patch(key, { error: problem })
    try {
      const start = await startPrintFileUpload(productId, file.name, file.size)
      if (!start.ok) return patch(key, { error: start.error })
      if (start.mode === "local") {
        const form = new FormData()
        form.set("productId", productId)
        form.set("file", file)
        const result = await uploadLocalPrintFile(form)
        return patch(key, result.ok ? { progress: 1, done: true } : { error: result.error ?? "Upload failed" })
      }
      await put(start.uploadUrl, file, (progress) => patch(key, { progress }))
      const result = await finishPrintFileUpload(productId, start.path, file.name)
      patch(key, result.ok ? { progress: 1, done: true } : { error: result.error ?? "Upload failed" })
    } catch (error) {
      patch(key, { error: error instanceof Error ? error.message : "Upload failed" })
    }
  }

  async function add(files: FileList | null) {
    if (!files?.length) return
    const batch = [...files].map((file) => ({ file, key: `${file.name}-${file.size}-${Math.random()}` }))
    setUploads((current) => [
      ...current.filter((upload) => !upload.done),
      ...batch.map(({ file, key }) => ({ key, name: file.name, progress: 0, error: null, done: false })),
    ])
    await Promise.all(batch.map(({ file, key }) => send(file, key)))
    router.refresh()
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void add(event.dataTransfer.files)
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        className="print-drop"
        data-dragging={dragging || undefined}
        onClick={() => input.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>
        <span className="font-medium">Drop print files or choose</span>
        <span className="admin-note">3MF, STL, OBJ, STEP or G-code, up to 50 MB each</span>
      </button>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept={printFileAccept}
        multiple
        tabIndex={-1}
        onChange={(event) => { void add(event.target.files); event.target.value = "" }}
      />
      {uploads.length ? (
        <ul className="grid gap-2" aria-live="polite">
          {uploads.map((upload) => (
            <li key={upload.key} className="grid gap-1 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate">{upload.name}</span>
                <span className="admin-note shrink-0">
                  {upload.error ? "Failed" : upload.done ? "Uploaded" : `${Math.round(upload.progress * 100)}%`}
                </span>
              </div>
              {upload.error ? (
                <p className="text-xs text-[#ff3b30]">{upload.error}</p>
              ) : (
                <div className="print-progress" data-done={upload.done || undefined}>
                  <span style={{ width: `${Math.max(2, upload.progress * 100)}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
