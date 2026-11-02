'use client'

/**
 * Signed contract card (roadmap Phase 2): surfaces the contract document
 * the approve transaction stored for a lease / management agreement — view
 * in a new tab or download. Renders nothing until a signed document exists,
 * so drafts keep a clean page. The fetched result is keyed by entity so a
 * changed entity (or revoked permission) derives back to "no card" without
 * a setState-in-effect reset. Server-side scoping is the real gate
 * (`document.read` + entity scope on /api/documents); this fetch skip is UX.
 */

import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileSignature } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { useUiPermission } from '@/components/shell/use-ui-permission'

type SignedContractDoc = {
  id: string
  kind: string
  fileName: string
  caption: string | null
}

export function SignedContractCard({
  entityType,
  entityId,
}: {
  entityType: 'LEASE' | 'AGREEMENT'
  entityId: string
}) {
  const { hasUiPermission } = useUiPermission()
  const canRead = hasUiPermission('document.read')
  const key = canRead && entityId ? `${entityType}/${entityId}` : ''
  const [fetched, setFetched] = useState<{ key: string; doc: SignedContractDoc | null } | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const kind = entityType === 'LEASE' ? 'TENANCY_AGREEMENT' : 'CONTRACT'
    fetch(`/api/documents?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return null
        const data = await res.json().catch(() => ({}))
        const docs = Array.isArray(data.documents) ? (data.documents as SignedContractDoc[]) : []
        return docs.find((d) => d.kind === kind) ?? null
      })
      .then((doc) => {
        if (!cancelled) setFetched({ key, doc })
      })
      .catch(() => {
        if (!cancelled) setFetched({ key, doc: null })
      })
    return () => {
      cancelled = true
    }
  }, [entityId, entityType, key])

  const doc = fetched && fetched.key === key ? fetched.doc : null
  if (!doc) return null

  return (
    <Card variant="outlined">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <FileSignature size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-sm font-medium">Signed contract</CardTitle>
          <CardDescription className="truncate">
            {doc.fileName}
            {doc.caption ? ` · ${doc.caption}` : ''}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/api/documents/${doc.id}/download?disposition=inline`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="size-4" aria-hidden="true" /> View
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/documents/${doc.id}/download`} download>
            <Download className="size-4" aria-hidden="true" /> Download
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
