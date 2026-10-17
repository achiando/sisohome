'use client'

import { Button } from '@workspace/ui/components/button'
import { useAuth } from '@workspace/auth-ui'

/**
 * Brand chrome for the workspace-setup flows: logo lockup, signed-in email,
 * sign out. Route-local custom UI (no @workspace/ui equivalent exists for
 * brand chrome) — kept in _components per repo convention.
 */
export function BrandBar() {
  const { user, logout } = useAuth()

  return (
    <header className="flex items-center justify-between px-4 py-4 md:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-base font-bold leading-none">S</span>
        </span>
        <span className="text-[15px] font-semibold tracking-tight">SisoHome</span>
      </div>
      {user && (
        <div className="flex items-center gap-3">
          {user.email && (
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
          )}
          <Button variant="text" size="sm" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      )}
    </header>
  )
}
