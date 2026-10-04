"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Link2, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { FileUpload } from "@workspace/ui/components/form"
import type { UploadedFile } from "@workspace/ui/types/components/forms"

interface ImageRow {
  url: string
  alt: string
}

export function RowActions({
  index,
  count,
  label,
  onMove,
  onRemove,
}: {
  index: number
  count: number
  label: string
  onMove?: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="flex items-center gap-1 self-end pb-1">
      {onMove ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${label} ${index + 1} up`}
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${label} ${index + 1} down`}
            disabled={index === count - 1}
            onClick={() => onMove(index, 1)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${label} ${index + 1}`}
        onClick={() => onRemove(index)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function moveRow<T>(rows: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= rows.length) return rows
  const next = [...rows]
  const [row] = next.splice(index, 1)
  if (row === undefined) return rows
  next.splice(target, 0, row)
  return next
}

function altFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function uploadImage(
  file: File,
  folder: string | undefined,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/admin/api/upload-image")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as {
          url?: string
          error?: string
        }
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          resolve(data.url)
        } else {
          reject(new Error(data.error || "Upload failed."))
        }
      } catch {
        reject(new Error("Upload failed."))
      }
    }
    xhr.onerror = () => reject(new Error("Network error — check your connection."))
    const body = new FormData()
    body.append("file", file)
    if (folder) body.append("folder", folder)
    xhr.send(body)
  })
}

export function ImagesEditor({
  value,
  onChange,
  folder,
  error,
}: {
  value: unknown
  onChange: (next: unknown) => void
  folder?: string
  error?: string
}) {
  const rows: ImageRow[] = useMemo(() => {
    if (!Array.isArray(value)) return []
    return (value as ImageRow[]).map((row) => ({
      url: String(row.url ?? ""),
      alt: String(row.alt ?? ""),
    }))
  }, [value])

  const rowsRef = useRef(rows)
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  const update = (index: number, patch: Partial<ImageRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const handleFilesChange = (next: UploadedFile[]) => {
    const succeeded = next.filter((f) => f.status === "success" && f.remoteUrl)
    const remaining = next.filter((f) => !(f.status === "success" && f.remoteUrl))

    if (succeeded.length > 0) {
      for (const file of succeeded) {
        if (file.url?.startsWith("blob:")) URL.revokeObjectURL(file.url)
      }
      const appended = succeeded.map((f) => ({
        url: f.remoteUrl as string,
        alt: altFromFilename(f.name),
      }))
      const merged = [...rowsRef.current, ...appended]
      rowsRef.current = merged
      onChange(merged)
      setUploadError(null)
    } else if (next.some((f) => f.status === "error")) {
      const failed = next.find((f) => f.status === "error")
      setUploadError(failed?.errorMessage || "Upload failed.")
    }

    setFiles(remaining)
  }

  const handleUpload = async (file: File, onProgress: (pct: number) => void) => {
    try {
      return await uploadImage(file, folder, onProgress)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed."
      setUploadError(message)
      throw err
    }
  }

  return (
    <div className="space-y-3">
      <FileUpload
        files={files}
        onFilesChange={handleFilesChange}
        onUpload={handleUpload}
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        multiple
        maxFiles={20}
        maxSizeMB={10}
        compact
        label="Upload images"
        error={uploadError ?? error}
      />

      {rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-background p-3 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-end"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted/50">
                {row.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.url}
                    alt={row.alt || `Image ${index + 1} preview`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Link2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <Input
                id={`image-url-${index}`}
                label="Image URL"
                inputSize="sm"
                placeholder="https://..."
                value={row.url}
                onChange={(e) => update(index, { url: e.target.value })}
              />
              <Input
                id={`image-alt-${index}`}
                label="Alt text"
                inputSize="sm"
                placeholder="Describe what the image shows"
                value={row.alt}
                onChange={(e) => update(index, { alt: e.target.value })}
              />
              <RowActions
                index={index}
                count={rows.length}
                label="image"
                onMove={(i, dir) => onChange(moveRow(rows, i, dir))}
                onRemove={(i) => onChange(rows.filter((_, j) => j !== i))}
              />
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No images yet. Upload photography or paste an image URL.
        </p>
      ) : null}
    </div>
  )
}
