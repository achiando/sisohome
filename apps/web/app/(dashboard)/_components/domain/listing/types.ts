/**
 * Shared register row shapes for the portfolio listing kit (properties +
 * units). `coverPhoto` is the cover PropertyDocument's Cloudinary secure URL
 * (uploaded media is registered as document rows — cells render it directly).
 * `occupancy` on units is the LEASE-DERIVED effective status from the
 * service, never the stale cache. `balance` is derived server-side and only
 * present when the caller holds `charge.list`.
 */

import type { AgreementStatus, Property, Unit, UnitStatus } from '@workspace/database'

export type PropertyListRow = Property & {
  _count: { units: number; buildings: number; documents: number }
  coverPhoto: string | null
  occupancy: { occupied: number; total: number; rate: number }
  /** Derived outstanding balance — present with `charge.list`. */
  balance?: { amount: string; currency: string } | null
  /** Property-level owners, highest share first (register Owner column). */
  owners?: { name: string; sharePercent: number | null }[]
  /** Most relevant management agreement — ACTIVE preferred (register column). */
  agreement?: {
    id: string
    status: AgreementStatus
    startsAt: Date | string | null
    endsAt: Date | string | null
  } | null
}

export type UnitListOccupant = {
  tenantId: string
  displayName: string
  email?: string | null
  phone?: string | null
  relationship: string
  leaseId: string
  leaseEndsAt: Date | null
  monthlyRent: string
  jointCount: number
}

export type UnitListRow = Unit & {
  building: { id: string; code: string; name?: string | null } | null
  occupancy: UnitStatus
  occupant: UnitListOccupant | null
  /** Present on the global units register (`/units`). */
  property?: {
    id: string
    name: string
    code: string | null
    addressLine1: string | null
    locality: string | null
    currency: string | null
  }
  coverPhoto?: string | null
  /** Active non-rent recurring bills attached to the unit (charge.list). */
  bills?: { id: string; name: string; chargeType: string; amount: string; currency: string; frequency: string }[]
}
