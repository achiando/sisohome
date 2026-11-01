'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { toast } from '@workspace/ui/components/toast'

type PreviewMatched = {
  tenantId: string
  tenantName: string
  leaseId: string | null
  unitId: string | null
  unitRef: string | null
  propertyId: string
  openRent: string
  openUtilities: string
} | null

type PreviewRow = {
  index: number
  raw: string
  amount: number | null
  currency: string
  reference?: string | null
  externalId?: string | null
  senderPhone?: string | null
  paidAt?: string | null
  status: 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED' | 'DUPLICATE'
  accountType: 'RENT' | 'UTILITIES'
  confidence: number
  preChecked: boolean
  matched: PreviewMatched
}

type Summary = {
  total: number
  matched: number
  ambiguous: number
  unmatched: number
  duplicate: number
  preChecked: number
}

type Preview = { source: string; rows: PreviewRow[]; summary: Summary }

type Decision = { index: number; checked: boolean; tenantId?: string; accountType?: string }

type CommitResult = {
  batchId: string
  applied: number
  failed: number
  duplicates: number
  skipped: number
  errors: { index: number; message: string }[]
}

type TenantOption = { id: string; displayName: string }

const STATUS_VARIANT: Record<PreviewRow['status'], 'success' | 'warning' | 'neutral' | 'info'> = {
  MATCHED: 'success',
  AMBIGUOUS: 'warning',
  UNMATCHED: 'neutral',
  DUPLICATE: 'info',
}

const STATUS_LABEL: Record<PreviewRow['status'], string> = {
  MATCHED: 'Matched',
  AMBIGUOUS: 'Needs review',
  UNMATCHED: 'Unmatched',
  DUPLICATE: 'Duplicate',
}

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

interface ImportMpesaDialogProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export function ImportMpesaDialog({ open, onClose, onImported }: ImportMpesaDialogProps) {
  const [step, setStep] = React.useState<'paste' | 'preview'>('paste')
  const [rawText, setRawText] = React.useState('')
  const [previewing, setPreviewing] = React.useState(false)
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [checked, setChecked] = React.useState<Record<number, boolean>>({})
  const [overrides, setOverrides] = React.useState<Record<number, string>>({})
  const [tenants, setTenants] = React.useState<TenantOption[]>([])
  const [tenantsLoaded, setTenantsLoaded] = React.useState(false)
  const [committing, setCommitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ index: number; message: string }[]>([])

  const handleClose = React.useCallback(() => {
    setStep('paste')
    setRawText('')
    setPreview(null)
    setChecked({})
    setOverrides({})
    setErrors([])
    setTenants([])
    setTenantsLoaded(false)
    onClose()
  }, [onClose])

  React.useEffect(() => {
    if (!open || tenantsLoaded) return
    let cancelled = false
    const loadTenants = async () => {
      try {
        const res = await fetch('/api/tenants', { credentials: 'include' })
        if (!res.ok) return
        const data = (await res.json()) as { tenants?: TenantOption[] }
        if (!cancelled && Array.isArray(data.tenants)) {
          setTenants(data.tenants)
          setTenantsLoaded(true)
        }
      } catch {
        // The select falls back to the preview's own match suggestion.
      }
    }
    loadTenants()
    return () => {
      cancelled = true
    }
  }, [open, tenantsLoaded])

  async function runPreview() {
    const text = rawText.trim()
    if (!text) {
      toast.warning('Paste one or more M-Pesa confirmation messages first.')
      return
    }
    setPreviewing(true)
    try {
      const res = await fetch('/api/payments/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ source: 'mpesa-sms', rawText: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Preview failed')
        return
      }
      const p = data as Preview
      if (!p.rows?.length) {
        toast.error('No payment messages found — check the paste.')
        return
      }
      const initial: Record<number, boolean> = {}
      for (const row of p.rows) initial[row.index] = row.preChecked
      setPreview(p)
      setChecked(initial)
      setOverrides({})
      setErrors([])
      setStep('preview')
    } catch {
      toast.error('Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const checkedCount = preview ? preview.rows.filter((r) => checked[r.index] && r.status !== 'DUPLICATE').length : 0

  async function runCommit() {
    if (!preview || checkedCount === 0) return
    const decisions: Decision[] = preview.rows
      .filter((r) => r.status !== 'DUPLICATE' && checked[r.index])
      .map((r) => {
        const d: Decision = { index: r.index, checked: true }
        const tenantId = overrides[r.index] ?? r.matched?.tenantId
        if (tenantId) d.tenantId = tenantId
        d.accountType = r.accountType
        return d
      })
    setCommitting(true)
    try {
      const res = await fetch('/api/payments/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ source: preview.source, rawText, decisions }),
      })
      const data = (await res.json()) as CommitResult & { error?: string }
      if (!res.ok) {
        toast.error(data?.error ?? 'Import failed')
        return
      }
      const parts = [
        `${data.applied} applied`,
        data.duplicates > 0 ? `${data.duplicates} duplicate` : null,
        data.failed > 0 ? `${data.failed} failed` : null,
        data.skipped > 0 ? `${data.skipped} skipped` : null,
      ].filter(Boolean)
      if (data.applied > 0) {
        toast.success('Imported payments', { description: parts.join(' · ') })
        onImported()
        handleClose()
      } else if (data.errors.length > 0) {
        setErrors(data.errors)
        toast.error('No payments applied', { description: data.errors[0]?.message })
      } else {
        toast.warning('Nothing applied', { description: parts.join(' · ') || 'All rows were duplicates or unchecked' })
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import M-Pesa messages</DialogTitle>
          <DialogDescription>
            Paste Safaricom confirmation SMS messages. Nothing is written until you review the preview and apply it.
          </DialogDescription>
        </DialogHeader>

        {step === 'paste' ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="mpesa-paste">Confirmation messages</Label>
              <Textarea
                id="mpesa-paste"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder={'SJ12GH78LK Confirmed. Ksh30,000.00 paid to ACME for account UNIT-B4 on 31/10/26 at 10:30 AM. …'}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                One message per line (or several on one line) — receipt codes, amounts, account references and dates are extracted automatically.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={previewing}>Cancel</Button>
              <Button onClick={runPreview} loading={previewing}>Preview</Button>
            </div>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" dot>{preview.summary.matched} matched</Badge>
              <Badge variant="warning" dot>{preview.summary.ambiguous} needs review</Badge>
              <Badge variant="neutral">{preview.summary.unmatched} unmatched</Badge>
              {preview.summary.duplicate > 0 && <Badge variant="info">{preview.summary.duplicate} duplicate</Badge>}
              <span className="text-xs text-muted-foreground">{preview.summary.total} messages parsed</span>
            </div>

            <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2 text-left">✓</th>
                    <th className="px-3 py-2 text-left">Received</th>
                    <th className="px-3 py-2 text-left">Code / reference</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Tenant</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => {
                    const isDuplicate = row.status === 'DUPLICATE'
                    const currentTenant = overrides[row.index] ?? row.matched?.tenantId ?? ''
                    return (
                      <tr key={row.index} className={isDuplicate ? 'opacity-60' : undefined}>
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={checked[row.index] ?? false}
                            disabled={isDuplicate}
                            onCheckedChange={(v) => setChecked((c) => ({ ...c, [row.index]: v === true }))}
                            aria-label="Apply this payment"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                          {shortDate(row.paidAt)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs">{row.externalId ?? row.reference ?? '—'}</div>
                          {row.reference && row.externalId && row.reference !== row.externalId && (
                            <div className="text-xs text-muted-foreground">acct {row.reference}</div>
                          )}
                          {row.senderPhone && <div className="text-xs text-muted-foreground">{row.senderPhone}</div>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                          {row.amount != null ? money(row.amount, row.currency) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {tenantsLoaded ? (
                            <Select
                              value={currentTenant || undefined}
                              onValueChange={(v) => setOverrides((o) => ({ ...o, [row.index]: v }))}
                            >
                              <SelectTrigger className="h-9 w-[180px]" aria-label="Matched tenant">
                                <SelectValue placeholder="Select tenant…" />
                              </SelectTrigger>
                              <SelectContent>
                                {row.matched?.tenantId && (
                                  <SelectItem value={row.matched.tenantId}>
                                    {row.matched.tenantName} (suggested)
                                  </SelectItem>
                                )}
                                {tenants
                                  .filter((t) => t.id !== row.matched?.tenantId)
                                  .map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.displayName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : row.matched ? (
                            <span className="text-sm">{row.matched.tenantName}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No match</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={STATUS_VARIANT[row.status]}>
                            {STATUS_LABEL[row.status]}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {errors.slice(0, 5).map((e) => (
                  <div key={e.index}>Row {e.index + 1}: {e.message}</div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" onClick={() => setStep('paste')} disabled={committing}>Back</Button>
              <Button onClick={runCommit} loading={committing} disabled={checkedCount === 0}>
                Apply {checkedCount} payment{checkedCount === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
