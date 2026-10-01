"use client"

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

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

export function ImagesEditor({
  value,
  onChange,
}: {
  value: unknown
  onChange: (next: unknown) => void
  error?: string
}) {
  const rows: ImageRow[] = Array.isArray(value)
    ? (value as ImageRow[]).map((row) => ({
        url: String(row.url ?? ""),
        alt: String(row.alt ?? ""),
      }))
    : []

  const update = (index: number, patch: Partial<ImageRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No images yet. Add the photography you want on the site.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-background p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-end"
        >
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

      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={Plus}
        onClick={() => onChange([...rows, { url: "", alt: "" }])}
      >
        Add image
      </Button>
    </div>
  )
}
