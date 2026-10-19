'use client'

/**
 * Client-side UI permission filter.
 *
 * SECURITY: This is a UX convenience ONLY. The server (protectRoute +
 * requireAuth on every API route) is the real authorization gate. Hiding a
 * nav item does not grant access; showing it does not bypass the server.
 * Per multi-tenant-auth: pair every client check with a server check.
 */

import { useAuth } from '@workspace/auth-ui'

export function useUiPermission() {
  const { user } = useAuth()
  const permissions = user?.permissions ?? []

  /** True when the active-org session holds the permission. */
  const hasUiPermission = (permission?: string): boolean => {
    if (!permission) return true
    if (!permissions.length) return false
    return permissions.includes(permission)
  }

  return { hasUiPermission, permissions }
}
