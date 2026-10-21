'use client'

/**
 * TenantDocumentsTab — documents for entityType=TENANT via the slice-1
 * polymorphic documents API (PII-gated at the route layer: document.read).
 * Upload gated document.upload; storage is key-registration only (no bytes).
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
import { toast } from '@workspace/ui/components/toast'
import { PageLoader } from '@workspace/ui/components/loader'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { formatDocumentKind } from '@/lib/domain/document-constants'

const TENANT_DOC_KINDS = [
  { value: 'PHOTO_ID', label: 'Photo ID' },
  { value: 'PAYSLIP', label: 'Payslip' },
  { value: 'BANK_STATEMENT', label: 'Bank statement' },
  { value: 'CONTRACT', label: 'Contract / reference' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'OTHER', label: 'Other' },
]

interface UploadValues {
  kind: string
  fileName: string
  storageKey: string
}

export function TenantDocumentsTab({ tenantId }: { tenantId: string }) {
  const { hasUiPermission } = useUiPermission()
  const canUpload = hasUiPermission('document.upload')

  const [docs, setDocs] = useState<PropertyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [values, setValues] = useState<UploadValues>({ kind: 'PHOTO_ID', fileName: '', storageKey: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/documents?entityType=TENANT&entityId=${encodeURIComponent(tenantId)}`, { credentials: 'include' })
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
  }, [tenantId])

  useEffect(() => load(), [load])

  const submit = async () => {
    if (!values.fileName.trim() || !values.storageKey.trim()) {
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
          entityType: 'TENANT',
          entityId: tenantId,
          kind: values.kind,
          fileName: values.fileName.trim(),
          storageKey: values.storageKey.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to register document')
      toast.success('Document registered')
      setUploadOpen(false)
      setValues({ kind: 'PHOTO_ID', fileName: '', storageKey: '' })
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to register document')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader title="Loading documents…" />

  if (docs.length === 0) {
    return (
      <>
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-xs">
          <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No documents</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canUpload
              ? 'Register ID copies, pay slips and references for this tenant.'
              : 'No documents registered.'}
          </p>
          {canUpload ? (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" aria-hidden />
              Register document
            </Button>
          ) : null}
        </div>
        <TenantUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          values={values}
          onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
          saving={saving}
          onSubmit={submit}
        />
      </>
    )
  }

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
      <TenantUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        values={values}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        saving={saving}
        onSubmit={submit}
      />
    </div>
  )
}

function TenantUploadDialog({
  open,
  onOpenChange,
  values,
  onChange,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  values: UploadValues
  onChange: (patch: Partial<UploadValues>) => void
  saving: boolean
  onSubmit: () => void | Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register document</DialogTitle>
          <DialogDescription>Bytes stay in private storage — this records the object key.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-doc-kind">Kind</Label>
            <Select value={values.kind} onValueChange={(v) => onChange({ kind: v })}>
              <SelectTrigger id="t-doc-kind" className="h-11 w-full">
                <SelectValue placeholder="Kind" />
              </SelectTrigger>
              <SelectContent>
                {TENANT_DOC_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-doc-name">File name</Label>
            <Input id="t-doc-name" value={values.fileName} onChange={(e) => onChange({ fileName: e.target.value })} placeholder="national-id.pdf" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-doc-key">Storage key</Label>
            <Input id="t-doc-key" value={values.storageKey} onChange={(e) => onChange({ storageKey: e.target.value })} placeholder="tenants/<id>/national-id.pdf" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} loading={saving} disabled={saving}>
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
