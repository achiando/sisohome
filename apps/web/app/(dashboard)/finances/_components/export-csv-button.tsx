'use client'

/**
 * Shared "Export CSV" button for the finance registers (Slice 9 gap pass).
 * Serializes the already-authorized rows in memory — no extra API round-trip.
 */

import { Download } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { downloadCsv, type CsvColumn } from '@/lib/csv'

export function ExportCsvButton<T>({
  filename,
  columns,
  rows,
  className,
}: {
  filename: string
  columns: CsvColumn<T>[]
  rows: T[]
  className?: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, columns, rows)}
      aria-label={`Export ${rows.length} rows as CSV`}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      Export CSV
    </Button>
  )
}
