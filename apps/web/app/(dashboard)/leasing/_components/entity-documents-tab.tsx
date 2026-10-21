'use client'

/**
 * EntityDocumentsTab — generic documents list + register dialog for any
 * entity type the documents API resolves (plan-slice-2: APPLICATION,
 * LEASE screening/tenancy files). Storage is key-registration only.
 */

import { useCallback, useEffect, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import type { PropertyDocument } from '@workspace/database'

import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { formatDocumentKind } from '@/lib/domain/document-constants'

export interface EntityDocumentsTabProps {
  entityType: string
  entityId: string
  kindOptions?: { value: string; label: string }[]
  /** Path prefix used in the storage-key helper text. */
  storageHint?: string
}

const DEFAULT_KINDS = [
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'PHOTO_ID', label: 'Photo ID' },
  { value: 'PAYSLIP', label: 'Payslip' },
  { value: 'BANK_STATEMENT', label: 'Bank statement' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'TENANCY_AGREEMENT', label: 'Tenancy agreement' },
  { value: 'DEPOSIT_RECEIPT', label: 'Deposit receipt' },
  { value: 'OTHER', label: 'Other' },
]

export function EntityDocumentsTab({
  entityType,
  entityId,
  kindOptions = DEFAULT_KINDS,
  storageHint = 'Private bucket path',
}: EntityDocumentsTabProps) {
  const { hasUiPermission } = useUiPermission()
  const canUpload = hasUiPermission('document.upload')

  const [docs, setDocs] = useState<PropertyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [kind, setKind] = useState(kindOptions[0]?.value ?? 'OTHER')
  const [fileName, setFileName] = useState('')
  const [storageKey, setStorageKey] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/documents?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load documents')
        const data = await res.json()
        return (data.documents ?? []) as PropertyDocument[]
      })
      .then((list) => {
        if (!cancelled) setDocs(list)
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
  }, [entityType, entityId])

  useEffect(() => load(), [load])

  const submit = async () => {
    if (!fileName.trim() || !storageKey.trim()) {
      toast.error('File name and storage key are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          kind,
          fileName: fileName.trim(),
          storageKey: storageKey.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to register document')
      toast.success('Document registered')
      setUploadOpen(false)
      setFileName('')
      setStorageKey('')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to register document')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader title="Loading documents…" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canUpload ? (
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" aria-hidden />
            Register document
          </Button>
        ) : null}
      </div>

      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-xs">
          <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No documents</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canUpload ? 'Register screening or tenancy files.' : 'No documents registered.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-xs">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={doc.fileName}>
                  {doc.fileName}
                </p>
                <p className="text-xs text-muted-foreground">{doc.caption ?? doc.storageKey}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="neutral" size="sm">{formatDocumentKind(doc.kind)}</Badge>
                {doc.version > 1 ? <Badge variant="neutral" size="sm">v{doc.version}</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register document</DialogTitle>
            <DialogDescription>{storageHint} — bytes stay in private storage.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-kind">Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="ed-kind" className="h-11 w-full">
                  <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent>
                  {kindOptions.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-name">File name</Label>
              <Input id="ed-name" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="signed-lease.pdf" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-key">Storage key</Label>
              <Input id="ed-key" value={storageKey} onChange={(e) => setStorageKey(e.target.value)} placeholder={`leases/${entityId}/signed-lease.pdf`} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUploadOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={saving} disabled={saving}>
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
