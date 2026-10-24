'use client'

/**
 * ApproveAgreementDialog — DRAFT → ACTIVE with the type-name e-sign
 * (People plan Slice 6): template select (category fixed by the managing
 * org's kind — PM orgs get manager templates, maintenance orgs get
 * maintainer templates) → server-rendered preview → type full name →
 * approve. The API keeps a legacy no-body approve path; this dialog is
 * the product surface and always signs.
 *
 * Parent should mount it per agreement (`key={agreementId}`) so reopening
 * another row starts with fresh state.
 */

import { useEffect, useState } from 'react'
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
import { Loader } from '@workspace/ui/components/loader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { toast } from '@workspace/ui/components/toast'
import type { AgreementPreviewResponse } from '@/lib/domain/agreement-constants'

export interface ApproveAgreementDialogProps {
  agreementId: string
  /** Managing org kind — decides the label only; the server picks the list. */
  managementOrgKind?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApproved: () => void
}

export function ApproveAgreementDialog({
  agreementId,
  managementOrgKind,
  open,
  onOpenChange,
  onApproved,
}: ApproveAgreementDialogProps) {
  const [preview, setPreview] = useState<AgreementPreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [template, setTemplate] = useState<string | null>(null)
  const [typedName, setTypedName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !agreementId) return
    let cancelled = false
    const qs = template ? `?template=${encodeURIComponent(template)}` : ''
    fetch(`/api/agreements/${agreementId}/agreement-preview${qs}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Failed to load agreement preview')
        if (!cancelled) {
          setPreview(data as AgreementPreviewResponse)
          setPreviewError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : 'Failed to load agreement preview')
      })
    return () => {
      cancelled = true
    }
  }, [open, agreementId, template])

  const activePreview = preview && (!template || preview.templateId === template) ? preview : null
  const previewBusy = open && !previewError && !activePreview

  const submit = async () => {
    if (!activePreview || !typedName.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/agreements/${agreementId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: activePreview.templateId, typedName: typedName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to approve agreement')
      toast.success('Agreement signed & approved — access is live')
      onApproved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve agreement')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sign &amp; approve agreement</DialogTitle>
          <DialogDescription>
            Review the agreement, type your full name to sign, then approve — the signature, timestamp
            and document fingerprint are recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              {managementOrgKind === 'MAINTENANCE_COMPANY'
                ? 'Maintenance contract template'
                : 'Management agreement template'}
            </Label>
            <Select
              value={template || preview?.templateId || ''}
              onValueChange={setTemplate}
              disabled={!preview?.templates.length}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                {(preview?.templates ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Preview</Label>
            {previewError ? (
              <p className="text-sm text-destructive">{previewError}</p>
            ) : activePreview ? (
              <div
                className="max-h-72 overflow-auto rounded-xl border border-border bg-background p-4"
                dangerouslySetInnerHTML={{ __html: activePreview.html }}
              />
            ) : previewBusy ? (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
                <Loader size="sm" />
              </div>
            ) : null}
          </div>

          <Input
            label="Type your full name to sign"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={activePreview?.signerLabel ?? 'Full name'}
            description={
              activePreview
                ? `Must match your account name: ${activePreview.signerLabel}`
                : 'The signature records your name, timestamp and document fingerprint.'
            }
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={busy || !activePreview || !typedName.trim()}
            onClick={submit}
          >
            Sign &amp; approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
