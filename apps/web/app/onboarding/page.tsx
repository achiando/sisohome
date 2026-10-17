'use client'

/**
 * Onboarding — post-signup / post-login workspace selection.
 *
 * Two paths (design.json patterns.onboarding — full-height single-column
 * card, identical at 375px, one primary CTA per card):
 * 1. If the user already has memberships → list them to JOIN an existing
 *    workspace (multi-org invariant: the user always picks; login never
 *    auto-guesses when there is more than one).
 * 2. Otherwise (or "Create another") → hand off to the shared independent
 *    create page (/create-organization), which also serves the dashboard.
 *
 * A `?next=` deep link (set by /login) is preserved through join and through
 * the create hand-off so users land where they originally intended.
 *
 * Custom pieces live in _components/ (brand bar, workspace list); everything
 * else is @workspace/ui (Card, Text, Button, Separator, Skeleton, toast).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { Text } from '@workspace/ui/components/text'
import { toast } from '@workspace/ui/components/toast'
import { useAuth } from '@workspace/auth-ui'
import { readNextParam } from '@/lib/deep-link'
import { BrandBar } from './_components/brand-bar'
import { WorkspaceList, type WorkspaceMembership } from './_components/workspace-list'

/** Preserve the login deep link when handing off to the create page. */
function createPath(): string {
  const next = readNextParam()
  return next ? `/create-organization?next=${encodeURIComponent(next)}` : '/create-organization'
}

/** Post-join destination: the login deep link, else the Overview (`/`). */
function landingPath(): string {
  return readNextParam() ?? '/'
}

export default function OnboardingPage() {
  const router = useRouter()
  const { refreshSession, needsPasswordChange } = useAuth()

  // Temporary password → forced change first (server 403s this page's APIs
  // anyway; this keeps the UX in the right order).
  useEffect(() => {
    if (needsPasswordChange) {
      const next = readNextParam()
      router.replace(next ? `/change-password?next=${encodeURIComponent(next)}` : '/change-password')
    }
  }, [needsPasswordChange, router])

  // null = loading; [] = no memberships yet.
  const [memberships, setMemberships] = useState<WorkspaceMembership[] | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/onboarding', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load organizations')
        const data = await res.json()
        if (!cancelled) setMemberships(data.success ? (data.memberships ?? []) : [])
      })
      .catch(() => {
        if (!cancelled) {
          // Degrade to the create path — the user can still set up a workspace.
          setMemberships([])
          toast.error('Could not load your organizations — you can still create a new one.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleJoin = async (organizationId: string) => {
    setJoiningId(organizationId)
    try {
      const res = await fetch('/api/auth/switch-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organizationId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to switch')
      await refreshSession()
      router.push(landingPath())
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to switch')
    } finally {
      setJoiningId(null)
    }
  }

  const hasMemberships = (memberships?.length ?? 0) > 0

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <BrandBar />

      {/* Full-height single-column card */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
        <Card variant="elevated" size="lg">
          {memberships === null ? (
            /* Loading — skeleton inside the card */
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : (
            <>
              {/* Join an existing workspace */}
              {hasMemberships && (
                <WorkspaceList memberships={memberships!} joiningId={joiningId} onJoin={handleJoin} />
              )}

              {hasMemberships && <Separator className="my-5" />}

              {/* Hand off to the shared create page */}
              <section>
                {hasMemberships ? (
                  <Text variant="title" as="h2">
                    Create another
                  </Text>
                ) : (
                  <Text variant="headline" as="h1">
                    Set up your workspace
                  </Text>
                )}
                <Text variant="bodyMuted" className="mt-1">
                  {hasMemberships
                    ? 'Spin up a new organization — you’ll pick its kind on the next step.'
                    : 'Create your organization to get started — you’ll pick its kind on the next step.'}
                </Text>
                <Button
                  onClick={() => router.push(createPath())}
                  rightIcon={ArrowRight}
                  className="mt-4 w-full"
                >
                  Create workspace
                </Button>
              </section>
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
