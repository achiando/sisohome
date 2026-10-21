'use client'

/**
 * /dev/demo — owner-gated test page that seeds or wipes a kind-aware demo
 * portfolio for the ACTIVE organization (pure data — never touches
 * permissions/roles). See lib/domain/demo-seed.ts for exactly what gets
 * created and how rows are marked for wipe.
 */

import { useCallback, useEffect, useState } from 'react'
import { Database, Eraser, Leaf } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { toast } from '@workspace/ui/components/toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'

import { useUiPermission } from '@/components/shell/use-ui-permission'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'

interface DemoState {
  present: boolean
  kind?: string | null
  properties?: number
  units?: number
  tenants?: number
  leases?: number
}

interface SeedSummary {
  kind: string
  properties: number
  buildings: number
  units: number
  tenants: number
  leases: number
  applications: number
  documents: number
  agreements: number
  ownerships: number
  staffAssignments: number
  ownerParties: number
}

const KIND_BLURBS: Record<string, string> = {
  LANDLORD: 'Owned portfolio with a self-linked owner party — the standard landlord workspace.',
  PROPERTY_MANAGEMENT:
    'Third-party owner parties, ownership splits, and ACTIVE management agreements on every property.',
  MAINTENANCE_COMPANY:
    'Properties under management agreement plus a caretaker staff assignment on the first property.',
  MARKETING_AGENT: 'A compact owned portfolio with the full leasing stack (listings arrive in slice 5).',
}

export default function DemoSeedPage() {
  const { hasUiPermission } = useUiPermission()
  const [state, setState] = useState<DemoState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'seed' | 'wipe' | null>(null)
  const [wipeOpen, setWipeOpen] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    fetch('/api/demo', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load demo state')
        return res.json()
      })
      .then((data: DemoState) => {
        if (!cancelled) setState(data)
      })
      .catch(() => {
        if (!cancelled) setState({ present: false })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  const run = useCallback(
    async (action: 'seed' | 'wipe') => {
      setBusy(action)
      try {
        const res = await fetch('/api/demo', {
          method: action === 'seed' ? 'POST' : 'DELETE',
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Request failed')
        if (action === 'seed') {
          const s = data.seeded as SeedSummary
          toast.success('Demo data seeded', {
            description: `${s.properties} properties · ${s.units} units · ${s.tenants} tenants · ${s.leases} leases`,
          })
        } else {
          toast.success('Demo data removed')
        }
        load()
      } catch (err) {
        toast.error(action === 'seed' ? 'Seed failed' : 'Wipe failed', {
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setBusy(null)
        setWipeOpen(false)
      }
    },
    [load],
  )

  if (!hasUiPermission('organization.manage')) {
    return (
      <ScopeDenied message="Demo data is an owner-only test tool. Ask an owner of your organization to run it." />
    )
  }

  const kind = state?.kind ?? 'LANDLORD'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo data"
        description="Seed or wipe a realistic sample portfolio for this workspace. Owner-only test tool."
      />

      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Leaf className="size-4" aria-hidden />
            What gets seeded
          </CardTitle>
          <CardDescription>
            Shaped by your organization kind ({KIND_BLURBS[kind] ?? KIND_BLURBS.LANDLORD})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>3 properties (Kilimani apartments, Lavington villa, Ngong Road plaza) with real photo galleries and a tour video</li>
            <li>Buildings and 13 units — vacant, occupied, and under-maintenance mixes</li>
            <li>5 tenants (prospect, applicant, active), 2 applications, 4 leases (active / scheduled / draft)</li>
            <li>Title deeds, signed agreements, and tenant ID documents</li>
            <li>Kind extras: third-party owners + management agreements (PM), caretaker assignment (MM)</li>
          </ul>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {loading ? 'Checking current state…' : state?.present ? 'Demo data is present' : 'No demo data in this workspace'}
              </p>
              {!loading && state?.present ? (
                <p className="text-xs text-muted-foreground">
                  {state.properties} properties · {state.units} units · {state.tenants} tenants · {state.leases} leases
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Seeding first removes any previous demo rows, then rebuilds. Only marked demo rows are ever touched.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="primary"
                leftIcon={Database}
                loading={busy === 'seed'}
                disabled={busy !== null}
                onClick={() => void run('seed')}
              >
                {state?.present ? 'Re-seed demo data' : 'Seed demo data'}
              </Button>
              <Button
                variant="destructive"
                leftIcon={Eraser}
                loading={busy === 'wipe'}
                disabled={busy !== null || !state?.present}
                onClick={() => setWipeOpen(true)}
              >
                Wipe demo data
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral" shape="pill">Portfolio</Badge>
            <Badge variant="neutral" shape="pill">Units</Badge>
            <Badge variant="neutral" shape="pill">Owners &amp; agreements</Badge>
            <Badge variant="neutral" shape="pill">Tenants</Badge>
            <Badge variant="neutral" shape="pill">Applications</Badge>
            <Badge variant="neutral" shape="pill">Leases</Badge>
            <Badge variant="neutral" shape="pill">Media</Badge>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wipe demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every demo-marked property, unit, tenant, lease, application, and document in this
              workspace. Your own (non-demo) data is never touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy !== null}
              onClick={(e) => {
                e.preventDefault()
                void run('wipe')
              }}
            >
              Wipe demo data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
