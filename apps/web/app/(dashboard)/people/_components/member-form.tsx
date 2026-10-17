'use client'

/**
 * The single member form used for BOTH create and edit, built on the
 * design-system form (UniversalForm + FormField sections).
 *
 * - Create mode: name + work email + role picker → returns a one-time temp password.
 * - Edit mode: name + role picker, with the email shown LOCKED (disabled).
 *
 * The email is the immutable login identity — it is shared across every
 * organization the user belongs to, so it can never be edited here. Name and
 * role are editable.
 *
 * There is intentionally no separate "Add member" form; the same component
 * drives both flows. Submit handling (API calls) is done by the parent via
 * onSubmit, so this stays a pure presentational form.
 */

import { useState } from 'react'
import { UniversalForm } from '@workspace/ui/components/form'
import type { FormSection } from '@workspace/ui/types/components'
import { MemberDialog } from './member-dialog'
import { type Member, type Role } from './types'

export interface MemberFormSubmit {
  name: string
  email: string
  roleId: string
}

function validate(
  values: Record<string, unknown>,
  isEdit: boolean
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!String(values.name ?? '').trim()) {
    errors.name = 'Full name is required'
  }

  if (!isEdit) {
    const email = String(values.email ?? '').trim()
    if (!email) {
      errors.email = 'Work email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address'
    }
  }

  if (!String(values.roleId ?? '')) {
    errors.roleId = 'Select a role'
  }

  return errors
}

export function MemberForm({
  open,
  mode,
  member,
  roles,
  orgDomain,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  mode: 'create' | 'edit'
  /** Existing member when mode === 'edit'. */
  member?: Member | null
  roles: Role[]
  orgDomain: string | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: MemberFormSubmit) => void
}) {
  /** Seeded once on mount — the parent remounts this component (via `key`)
   * when switching between create/edit or members, so values are always
   * correct without a sync effect. */
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    name: member?.name ?? '',
    email: member?.email ?? '',
    roleId: member?.roles[0]?.id ?? '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = mode === 'edit'

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear the field's error as soon as the user edits it.
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handleSubmit = (submitValues: Record<string, unknown>) => {
    const validation = validate(submitValues, isEdit)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }
    setErrors({})
    onSubmit({
      name: String(submitValues.name).trim(),
      email: String(submitValues.email ?? member?.email ?? '').trim(),
      roleId: String(submitValues.roleId),
    })
  }

  const sections: FormSection[] = [
    {
      id: 'details',
      title: 'Details',
      columns: 4,
      fields: [
        {
          name: 'name',
          label: 'Full name',
          type: 'text',
          colSpan: 'full',
          required: true,
          placeholder: 'Jane Doe',
        },
        isEdit
          ? {
              name: 'email',
              label: 'Work email',
              type: 'email',
              colSpan: 'full',
              disabled: true,
              helperText:
                'The email is the sign-in identity and cannot be changed.',
            }
          : {
              name: 'email',
              label: 'Work email',
              type: 'email',
              colSpan: 'full',
              required: true,
              placeholder: orgDomain ? `jane${orgDomain}` : 'jane@company.com',
              helperText: orgDomain
                ? `Use your work email (${orgDomain}) so they can sign in.`
                : 'They will sign in with this email.',
            },
        {
          name: 'roleId',
          label: 'Role',
          type: 'select',
          colSpan: 'full',
          required: true,
          placeholder: 'Select a role',
          options: roles.map((r) => ({
            label: r.singleOrg ? `${r.name} — one org` : r.name,
            value: r.id,
          })),
          helperText: isEdit
            ? 'Changing the role applies immediately. Roles marked “one org” are staff roles: this person can belong to a single organization only.'
            : 'Roles marked “one org” are staff roles: that person can belong to a single organization only. More roles can be added later from the member list.',
        },
      ],
    },
  ]

  return (
    <MemberDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit member' : 'Add member'}
      description={
        isEdit
          ? 'Update this member’s name and role.'
          : 'Invite someone to your organization with a temporary password.'
      }
    >
      <UniversalForm
        title={isEdit ? 'Edit member' : 'Add member'}
        mode={mode}
        isLoading={saving}
        values={values}
        errors={errors}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
        primaryLabel={isEdit ? 'Save changes' : 'Create member'}
        sections={sections}
        formClassName="w-full"
      />
    </MemberDialog>
  )
}
