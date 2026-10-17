'use client'

/**
 * Settings → General — active organization details.
 *
 * Read-only by default with an explicit Edit action that swaps in the
 * design-system UniversalForm. The workspace type is fixed at creation, so it
 * is always displayed read-only.
 *
 * Read requires organization.read; saving requires organization.update (both
 * UX-gated here — the API enforces for real, scoped to the session's active
 * organization).
 */

import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'

import { toast } from '@workspace/ui/components/toast'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { UniversalForm } from '@workspace/ui/components/form'
import { FieldItem } from '@workspace/ui/components'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import type { FormSection } from '@workspace/ui/types/components'
import { useUiPermission } from '@/components/shell/use-ui-permission'

interface OrgInfo {
  id: string
  name: string
  kind: string
  createdAt: string
}

function kindLabel(kind: string): string {
  const words = kind.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function GeneralForm() {
  const { hasUiPermission } = useUiPermission()
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, unknown>>({ name: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/organization', { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data.success && data.organization) {
          setOrg(data.organization)
          setValues({ name: data.organization.name })
        } else {
          setLoadError(data.error || 'Failed to load organization')
        }
      } catch {
        if (!cancelled) setLoadError('Failed to load organization')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const canEdit = hasUiPermission('organization.update')

  const startEdit = () => {
    setValues({ name: org?.name ?? '' })
    setErrors({})
    setEditing(true)
  }

  const cancelEdit = () => {
    setValues({ name: org?.name ?? '' })
    setErrors({})
    setEditing(false)
  }

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handleSubmit = (submitValues: Record<string, unknown>) => {
    const trimmed = String(submitValues.name ?? '').trim()
    if (!trimmed) {
      setErrors({ name: 'Organization name is required' })
      return
    }
    if (!org || trimmed === org.name) {
      setErrors({})
      setEditing(false)
      return
    }
    setErrors({})

    void (async () => {
      setSaving(true)
      try {
        const res = await fetch('/api/organization', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: trimmed }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to update organization')
        }
        setOrg((prev) => (prev ? { ...prev, name: data.organization.name } : prev))
        setValues({ name: data.organization.name })
        toast.success('Organization updated')
        setEditing(false)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update organization'
        setErrors({ name: message })
        toast.error(message)
      } finally {
        setSaving(false)
      }
    })()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-32 rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  if (loadError || !org) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {loadError || 'Organization not found'}
        </CardContent>
      </Card>
    )
  }

  const sections: FormSection[] = [
    {
      id: 'organization',
      title: 'Organization',
      description: 'Your workspace name. It appears in the sidebar, invites and exports.',
      columns: 4,
      fields: [
        {
          name: 'name',
          label: 'Organization name',
          type: 'text',
          colSpan: 'full',
          required: true,
          placeholder: 'e.g. Acme Properties',
          disabled: saving,
        },
      ],
    },
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Your workspace name and the kind it was created as.
          </CardDescription>
        </div>
        {canEdit && !editing && (
          <CardAction>
            <Button variant="outline" leftIcon={Pencil} onClick={startEdit}>
              Edit
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        {editing ? (
          <UniversalForm
            title="Organization"
            mode="edit"
            values={values}
            errors={errors}
            onChange={handleChange}
            sections={sections}
            onSubmit={handleSubmit}
            onCancel={cancelEdit}
            primaryLabel="Save changes"
            isLoading={saving}
            formClassName="max-w-2xl"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" shape="pill">
                {kindLabel(org.kind)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Workspace type is fixed at creation.
              </span>
            </div>
          </UniversalForm>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <FieldItem label="Name" value={org.name} />
              <FieldItem
                label="Type"
                value={<Badge variant="info" shape="pill">{kindLabel(org.kind)}</Badge>}
                metadata="Seeds this workspace's default roles. Fixed at creation."
              />
              <FieldItem
                label="Created"
                value={new Date(org.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              />
            </dl>

            {!canEdit && (
              <p className="mt-5 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                You don&apos;t have the{' '}
                <span className="font-mono text-foreground">organization.update</span>{' '}
                permission, so this workspace&apos;s details can&apos;t be changed from your
                account.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
