'use client'

/**
 * /portfolio/owners/agreements/[agreementId]/edit — dates/scope edits plus
 * the workflow actions (Approve = portfolio side only, DRAFT only; End =
 * either side from ACTIVE/SUSPENDED). The API returns 403/409 for races;
 * the UI only offers the legal next steps.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, StopCircle } from 'lucide-react'
import type { AgreementStatus } from '@workspace/database'

import { Button } from '@workspace/ui/components/button'
import { PageLoader } from '@workspace/ui/components/loader'
import { toast } from '@workspace/ui/components/toast'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { AgreementStatusBadge } from '../../../../_components/agreement-status'
import {
  AgreementForm,
  scopeToText,
  toAgreementPayload,
  type AgreementFormValues,
} from '../../../../_components/agreement-form'

type AgreementDetail = {
  id: string
  status: AgreementStatus
  startsAt: string
  endsAt: string | null
  scope?: unknown
  actorIsPortfolioSide: boolean
  propertyId: string
  property: { id: string; name: string; code?: string | null } | null
  managementOrganization: { id: string; name: string } | null
  ownerParty: { id: string; name: string } | null
}

export default function EditAgreementPage() {
  const router = useRouter()
  const params = useParams<{ agreementId: string }>()
  const agreementId = params.agreementId
  const { hasUiPermission } = useUiPermission()

  const [agreement, setAgreement] = useState<AgreementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch(`/api/agreements/${agreementId}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'Agreement not found')
        return data.agreement as AgreementDetail
      })
      .then((a) => {
        if (!cancelled) setAgreement(a)
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Agreement not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agreementId])

  useEffect(() => load(), [load])

  const runWorkflow = async (action: 'approve' | 'end') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/agreements/${agreementId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? `Failed to ${action} agreement`)
        return
      }
      toast.success(action === 'approve' ? 'Agreement approved — manager access is live' : 'Agreement ended')
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (!hasUiPermission('agreement.read')) {
    return (
      <ScopeDenied
        title="Cannot view agreements"
        message="You need the agreement.read permission. Ask an owner or admin of your organization."
        backHref="/portfolio/owners/agreements"
        backLabel="Back to agreements"
      />
    )
  }

  if (loading) return <PageLoader title="Loading agreement…" />
  if (!agreement) {
    return (
      <ScopeDenied
        message="This agreement doesn't exist for your organization."
        backHref="/portfolio/owners/agreements"
        backLabel="Back to agreements"
      />
    )
  }

  const isClosed = agreement.status === 'ENDED' || agreement.status === 'TERMINATED'
  const canApprove =
    agreement.status === 'DRAFT' && agreement.actorIsPortfolioSide && hasUiPermission('agreement.approve')
  const canEnd =
    (agreement.status === 'ACTIVE' || agreement.status === 'SUSPENDED') && hasUiPermission('agreement.update')
  const canEditDates = !isClosed && (agreement.status === 'DRAFT' || agreement.actorIsPortfolioSide)

  const seed: AgreementFormValues = {
    startsAt: agreement.startsAt,
    endsAt: agreement.endsAt ?? '',
    scope: scopeToText(agreement.scope),
  }

  const handleSubmit = async (values: AgreementFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/agreements/${agreementId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toAgreementPayload(values, true)),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save agreement')
        setSaving(false)
        return
      }
      toast.success('Agreement updated')
      load()
    } catch {
      toast.error('Network error — agreement not saved')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="text" size="sm" onClick={() => router.push('/portfolio/owners/agreements')}>
          ← Agreements
        </Button>
      </div>

      <PageHeader
        title={agreement.property?.name ?? 'Agreement'}
        description={[
          `Manager: ${agreement.managementOrganization?.name ?? '—'}`,
          `Owner party: ${agreement.ownerParty?.name ?? '—'}`,
        ].join(' · ')}
        actions={
          <>
            <AgreementStatusBadge status={agreement.status} />
            {canApprove ? (
              <Button variant="primary" leftIcon={CheckCircle2} disabled={busy} onClick={() => runWorkflow('approve')}>
                Approve
              </Button>
            ) : null}
            {canEnd ? (
              <Button variant="outline" leftIcon={StopCircle} disabled={busy} onClick={() => runWorkflow('end')}>
                End agreement
              </Button>
            ) : null}
          </>
        }
      />

      {agreement.status === 'DRAFT' ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          This is a proposal. The property organization must approve it before the manager&apos;s access
          opens.
        </p>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        {canEditDates ? (
          <AgreementForm
            mode="edit"
            propertyOptions={[]}
            managerOptions={[]}
            partyOptions={[]}
            initialValues={seed}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/portfolio/owners/agreements')}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Closed agreements are read-only — reopen or recreate a contract to make changes.
          </p>
        )}
      </div>
    </div>
  )
}
