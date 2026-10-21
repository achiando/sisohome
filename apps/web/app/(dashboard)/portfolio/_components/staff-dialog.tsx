'use client'

/**
 * StaffDialog — assign an org member to a property (plan-slice-1 §2.3,
 * scope arm 3 from startsAt). Revoke happens from the row menu (flip
 * isActive=false — history kept).
 *
 * State lives in an inner component inside DialogContent: Radix unmounts
 * content on close, so each open re-seeds fresh values.
 */

import { useMemo, useState } from 'react'
import { toast } from '@workspace/ui/components/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection, SelectOption } from '@workspace/ui/types/components'

interface Values extends Record<string, unknown> {
  userId: string
  title: string
  startsAt: string
  endsAt: string
}

function isoDay(v?: Date | string | null): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function seed(): Values {
  return { userId: '', title: '', startsAt: isoDay(new Date()), endsAt: '' }
}

const baseSections: FormSection[] = [
  {
    id: 'assignment',
    title: 'Assignment',
    columns: 4,
    fields: [
      { name: 'userId', label: 'Member', type: 'select', required: true, colSpan: 2, options: [], helperText: 'Members of your organization' },
      { name: 'title', label: 'Role on property', type: 'text', colSpan: 2, placeholder: 'Site caretaker' },
      { name: 'startsAt', label: 'Starts', type: 'date', required: true, colSpan: 2 },
      { name: 'endsAt', label: 'Ends (optional)', type: 'date', colSpan: 2, helperText: 'Leave blank until revoked' },
    ],
  },
]

export function StaffDialog({
  open,
  memberOptions,
  propertyId,
  onClose,
  onSaved,
}: {
  open: boolean
  memberOptions: SelectOption[]
  propertyId: string
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign staff</DialogTitle>
          <DialogDescription>
            Grant an organization member access to this property from the start date. Duplicate active
            assignments are rejected (409).
          </DialogDescription>
        </DialogHeader>
        <StaffInner memberOptions={memberOptions} propertyId={propertyId} onClose={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}

function StaffInner({
  memberOptions,
  propertyId,
  onClose,
  onSaved,
}: {
  memberOptions: SelectOption[]
  propertyId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Values>(seed)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const sections = useMemo(() => {
    const opts: SelectOption[] =
      memberOptions.length > 0 ? memberOptions : [{ value: '', label: 'No members found' }]
    return baseSections.map((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.name === 'userId' && f.type === 'select' ? { ...f, options: opts } : f)),
    }))
  }, [memberOptions])

  const handleSubmit = async (v: Record<string, unknown>) => {
    const errs: Record<string, string> = {}
    if (!String(v.userId ?? '').trim()) errs.userId = 'Select a member'
    if (v.endsAt && v.startsAt && new Date(String(v.endsAt)) <= new Date(String(v.startsAt))) {
      errs.endsAt = 'End date must be after the start date'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/staff`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: v.userId,
          title: String(v.title ?? '').trim() || null,
          startsAt: v.startsAt,
          endsAt: v.endsAt ? v.endsAt : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to assign staff')
        setSaving(false)
        return
      }
      toast.success('Staff assigned')
      onSaved()
      onClose()
    } catch {
      toast.error('Network error — assignment not saved')
      setSaving(false)
    }
  }

  return (
    <UniversalForm
      title="Assign staff"
      mode="create"
      variant="standard"
      sections={sections}
      values={values}
      errors={errors}
      onChange={(name, value) => {
        setErrors((prev) => {
          if (!prev[name]) return prev
          const next = { ...prev }
          delete next[name]
          return next
        })
        setValues((prev) => ({ ...prev, [name]: value }))
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      isLoading={saving}
      primaryLabel="Assign"
      bare
      formClassName="w-full"
    />
  )
}
