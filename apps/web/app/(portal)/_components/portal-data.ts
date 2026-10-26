'use client'

/**
 * Shared client state for the portal shell (plan-slice-7 §3): the session
 * context resolved by `GET /api/portal/session` (tenants picker, profile)
 * plus a tiny fetch hook every portal page uses. Client gates here are UX
 * only — every /api/portal/* route re-authorizes server-side (relationship
 * = your tenant row, verified per request).
 */

import { createContext, useContext, useEffect, useState } from 'react'

export interface PortalTenantOption {
  id: string
  displayName: string
  orgName: string
}

export interface PortalSessionState {
  tenants: PortalTenantOption[]
  profile: {
    email: string | null
    name: string | null
    mustChangePassword: boolean
  }
  /** Signed cookie's active tenancy (auto-bound when the user has one). */
  contextTenantId: string
}

export const PortalSessionContext = createContext<PortalSessionState | null>(null)

export function usePortalSession(): PortalSessionState | null {
  return useContext(PortalSessionContext)
}

export interface PortalApiState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/**
 * GET a portal endpoint. `version` acts as a manual refresh key (bump it
 * after a write to refetch). setState only happens inside the promise
 * callbacks (lint: no sync setState in effects).
 */
export function usePortalApi<T>(path: string, version = 0): PortalApiState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    fetch(path, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setState({ data: null, error: body.error ?? 'Request failed', loading: false })
          return
        }
        setState({ data: body as T, error: null, loading: false })
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, error: 'Could not reach the server.', loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [path, version])

  return state
}

/** Sign out of the portal (and the org app if dual-role) → login screen. */
export async function portalSignOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
  window.location.assign('/login')
}

// ── JSON shapes returned by /api/portal/* (Decimals → strings, Dates → ISO) ──

export interface PortalLeaseUnit {
  id: string
  unitRef: string | null
  label: string
  monthlyRent: string
  currency: string
}

export interface PortalLease {
  id: string
  leaseRef: string
  status: string
  tenureType: string
  startsAt: string
  endsAt: string
  signedAt: string | null
  currency: string
  billingFrequency: string
  paymentDueDay: number | null
  depositMonths: string | null
  noticeDays: number | null
  autoRenew: boolean
  myRelationship: string
  property: { id: string; name: string; locality: string | null; addressLine1: string | null }
  manager: { organizationId: string; name: string }
  units: PortalLeaseUnit[]
  parties: { tenantId: string; displayName: string; relationship: string; isSelf: boolean }[]
}

export interface PortalCharge {
  id: string
  chargeType: string
  title: string
  amount: string
  paid: string
  outstanding: string
  currency: string
  dueDate: string
  unitLabel: string | null
}

export interface PortalPayment {
  id: string
  amount: string
  currency: string
  method: string
  reference: string | null
  receivedAt: string
}

export interface PortalStatement {
  charges: PortalCharge[]
  payments: PortalPayment[]
  totals: { charges: string; paid: string; payments: string; balance: string }
}

export interface PortalDocument {
  id: string
  kind: string
  entityType: string
  entityId: string
  fileName: string
  mimeType: string | null
  sizeBytes: number | null
  caption: string | null
  storageKey: string
  version: number
  createdAt: string
  downloadUrl: string | null
}

export interface PortalTicketNote {
  id: string
  body: string
  author: 'tenant' | 'staff'
  createdAt: string
}

export interface PortalTicket {
  id: string
  title: string
  description: string | null
  category: string
  priority: string
  status: string
  reportedAt: string
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  property: { id: string; name: string }
  unit: { id: string; unitRef: string | null; label: string } | null
  notes: PortalTicketNote[]
}

export interface PortalPaymentInstructions {
  accounts: {
    id: string
    name: string
    accountType: string
    reference: string | null
    currency: string
  }[]
  properties: { name: string; locality: string | null }[]
  note: string
}
