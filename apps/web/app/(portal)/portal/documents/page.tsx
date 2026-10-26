'use client'

/**
 * Documents (plan-slice-7 §3): paperwork bound to the tenant or their
 * leases. Remote (https) files open directly; generated evidence rows are
 * caption-only — no download bytes live in this app.
 */

import { Download, FileText, Info } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'

import { formatDate } from '@/app/(dashboard)/_components/domain/format'

import { usePortalApi, type PortalDocument } from '../../_components/portal-data'

interface DocsRes {
  success: boolean
  documents: PortalDocument[]
}

function formatSize(bytes: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PortalDocumentsPage() {
  const { data, error, loading } = usePortalApi<DocsRes>('/api/portal/documents')

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PageLoader title="Loading documents..." />
      </div>
    )
  }
  if (error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    )
  }

  const documents = data?.documents ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Agreements, receipts and evidence attached to you or your leases.
        </p>
      </div>

      {documents.length === 0 ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>No documents yet</CardTitle>
            <CardDescription>
              Anything your property team uploads for you will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((doc) => {
            const size = formatSize(doc.sizeBytes)
            return (
              <Card key={doc.id} variant="outlined">
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-medium" title={doc.fileName}>
                      {doc.fileName}
                    </CardTitle>
                    <CardDescription>
                      {doc.kind.replace(/_/g, ' ').toLowerCase()} · {formatDate(doc.createdAt)}
                      {size ? ` · ${size}` : ''}
                      {doc.version > 1 ? ` · v${doc.version}` : ''}
                    </CardDescription>
                  </div>
                  <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    {doc.caption ?? (doc.downloadUrl ? 'Open or download the file.' : '')}
                  </p>
                  {doc.downloadUrl ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="size-4" aria-hidden="true" /> Open
                      </a>
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                      <Info className="size-3.5" aria-hidden="true" /> Reference only
                    </span>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
