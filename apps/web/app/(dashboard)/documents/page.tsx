'use client'

/**
 * /documents — org-wide documents library (roadmap Phase 4; kills dead nav
 * entry #2). Lists GET /api/documents in library mode (no entityId): own-org
 * rows plus property rows in scope (MM/PM see agreement properties), with
 * entity-type + kind filters, search, and click-through to the owning
 * entity. View/Download hit the Phase-2 download route (inline view /
 * attachment; uploaded objects 307 to their storage URL). Server gate =
 * document.read; the UI gate below is UX only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, FileText } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  ResponsiveDataListing,
  type CardMapper,
  type ColumnDef,
} from '@workspace/ui/components/shared'
import { toast } from '@workspace/ui/components/toast'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { DOCUMENT_KINDS, formatDocumentKind } from '@/lib/domain/document-constants'
import {
  DOCUMENT_ENTITY_TYPE_OPTIONS,
  documentEntityHref,
  filterLibraryDocuments,
  formatDocumentEntityType,
  formatSizeBytes,
  type LibraryDocRow,
} from '@/lib/domain/document-library'

function downloadUrl(row: LibraryDocRow, inline: boolean): string {
  return `/api/documents/${row.id}/download${inline ? '?disposition=inline' : ''}`
}

function triggerDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function openInline(row: LibraryDocRow) {
  window.open(downloadUrl(row, true), '_blank', 'noopener,noreferrer')
}

export default function DocumentsPage() {
  const { hasUiPermission } = useUiPermission()

  const [rows, setRows] = useState<LibraryDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')

  const load = useCallback(() => {
    let cancelled = false
    fetch('/api/documents', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load documents')
        const data = await res.json()
        return (data.documents ?? []) as LibraryDocRow[]
      })
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load documents')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  const filtered = useMemo(
    () => filterLibraryDocuments(rows, { entityType: entityFilter, kind: kindFilter, q: search }),
    [rows, entityFilter, kindFilter, search],
  )

  if (!hasUiPermission('document.read')) {
    return (
      <ScopeDenied message="You need the document.read permission to view the documents library. Ask an owner or admin of your organization." />
    )
  }

  const columns: ColumnDef<LibraryDocRow>[] = [
    {
      header: 'Document',
      cell: (d) => (
        <div className="min-w-0">
          <Link href={documentEntityHref(d)} className="block truncate font-medium hover:underline">
            {d.fileName}
          </Link>
          {d.caption ? <p className="truncate text-xs text-muted-foreground">{d.caption}</p> : null}
        </div>
      ),
    },
    {
      header: 'Kind',
      cell: (d) => (
        <Badge variant="neutral" size="sm">
          {formatDocumentKind(d.kind)}
        </Badge>
      ),
    },
    {
      header: 'Type',
      cell: (d) => <span className="text-sm text-muted-foreground">{formatDocumentEntityType(d.entityType)}</span>,
    },
    {
      header: 'Property',
      cell: (d) => <span className="text-sm text-muted-foreground">{d.property?.name ?? '—'}</span>,
    },
    {
      header: 'Added',
      cell: (d) => <span className="text-sm text-muted-foreground">{formatDate(d.createdAt)}</span>,
    },
    {
      header: '',
      className: 'w-24',
      cell: (d) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`View ${d.fileName}`}
            onClick={() => openInline(d)}
          >
            <ExternalLink size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Download ${d.fileName}`}
            onClick={() => triggerDownload(downloadUrl(d, false))}
          >
            <Download size={16} />
          </Button>
        </div>
      ),
    },
  ]

  const cardMapper: CardMapper<LibraryDocRow> = {
    id: (d) => d.id,
    title: (d) => d.fileName,
    subtitle: (d) =>
      `${formatDocumentEntityType(d.entityType)}${d.property ? ` · ${d.property.name}` : ''}`,
    statusBadge: (d) => (
      <Badge variant="neutral" size="sm">
        {formatDocumentKind(d.kind)}
      </Badge>
    ),
    detailFields: (d) => [
      { label: 'Kind', value: formatDocumentKind(d.kind) },
      ...(d.caption ? [{ label: 'Caption', value: d.caption }] : []),
      { label: 'Added', value: formatDate(d.createdAt) },
      { label: 'Size', value: formatSizeBytes(d.sizeBytes) },
    ],
    detailHref: (d) => documentEntityHref(d),
    actions: (d) => [
      { label: 'View', variant: 'outline', onClick: () => openInline(d) },
      { label: 'Download', variant: 'outline', onClick: () => triggerDownload(downloadUrl(d, false)) },
    ],
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description={`${rows.length} document${rows.length === 1 ? '' : 's'} in scope`}
      />

      <ResponsiveDataListing<LibraryDocRow>
        title="Documents"
        hideHeaderOnMobile
        items={filtered}
        columns={columns}
        cardMapper={cardMapper}
        loading={loading}
        skeletonCount={6}
        count={rows.length}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search file name, caption or property"
        filters={[
          {
            key: 'entityType',
            label: 'Type',
            value: entityFilter,
            onChange: setEntityFilter,
            options: [{ value: '', label: 'Type' }, ...DOCUMENT_ENTITY_TYPE_OPTIONS],
          },
          {
            key: 'kind',
            label: 'Kind',
            value: kindFilter,
            onChange: setKindFilter,
            options: [{ value: '', label: 'Kind' }, ...DOCUMENT_KINDS],
          },
        ]}
        inlineFilters
        rowKey={(d) => d.id}
        emptyState={{
          icon: FileText,
          title: 'No documents yet',
          description:
            rows.length > 0
              ? 'No documents match these filters.'
              : 'Documents appear here once files, photos or signed contracts are uploaded.',
        }}
      />
    </div>
  )
}
