'use client'

/**
 * Overview / Dashboard — first screen inside the app shell (renders at `/`).
 * Skeleton welcome view for Phase 1; domain cards land in later phases.
 */

import { useAuth } from '@workspace/auth-ui'
import { Badge } from '@workspace/ui/components/badge'

export default function OverviewPage() {
  const { user } = useAuth()

  return (
    <div>
      {/* Page header — title lives in the mobile app bar (shell); gutters come
          from the AppShell content wrapper */}

      <div className="mb-6">
        <h1 className="hidden text-2xl font-semibold tracking-tight text-foreground md:block md:text-[24px]">
          Overview
        </h1>
        <p className="text-sm text-muted-foreground md:mt-1">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Here&apos;s your workspace.
        </p>
      </div>

      {/* Access summary card — reflects the active org session only */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Your access</h2>
          <Badge variant="neutral" shape="pill" dot>
            Active org
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Roles
            </p>
            <div className="flex flex-wrap gap-1.5">
              {user?.roles?.length ? (
                user.roles.map((role) => (
                  <Badge key={role} shape="pill" variant="outline" className="capitalize">
                    {role.replace(/_/g, ' ')}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No roles</span>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Permissions ({user?.permissions?.length ?? 0})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {user?.permissions?.slice(0, 12).map((perm) => (
                <Badge key={perm} shape="pill" variant="default" className="font-mono text-[11px]">
                  {perm}
                </Badge>
              ))}
              {(user?.permissions?.length ?? 0) > 12 && (
                <Badge shape="pill" variant="default">
                  +{(user?.permissions?.length ?? 0) - 12} more
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
