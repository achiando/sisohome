/* ── /properties/[propertyId] — property details register ────────────────────────
 * Server gate = GET /api/properties/[propertyId] (property.show);
 * UI gate: property.list (nav hides for unauthorized).
 * Design: reuses the exact same table/component pattern as /units and /people/tenants
 *        — ResponsiveDataListing, buildUnitColumns, PageHeader, ScopeDenied.
 *        No new table components — using existing shared patterns.
 *─────────────────────────────────────────────────────────────────────────────*/

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Building2, Loader } from 'lucide-react'

import { ResponsiveDataListing } from '@workspace/ui/components/shared'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '@workspace/ui/components/card'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { buildUnitColumns } from '@/app/(dashboard)/_components/domain/listing'
import { useCallback } from 'react'

export default function PropertyDetailsPage() {
  const { propertyId } = useParams()
  const [property, setProperty] = useState<{ id: string; name: string; code: string | null; category: string; status: string; unitsTotal: number } | null>(null)
  const [units, setUnits] = useState<{ id: string; unitRef: string; label: string | null; occupancy: string; property?: { name: string; code: string | null } }[]>([])
  const { hasUiPermission } = useUiPermission()

  if (!hasUiPermission('property.list')) return <ScopeDenied />

  useEffect(() => {
    async function load() {
      // 1. Load property detail
      const propRes = await fetch(`/api/properties/${propertyId}`, {
        credentials: 'include',
      })
      if (!propRes.ok) throw new Error('Property not found')
      setProperty(await propRes.json())

      // 2. Load units for this property
      const unitsRes = await fetch(`/api/units?propertyId=${propertyId}`, {
        credentials: 'include',
      })
      if (!unitsRes.ok) throw new Error('Failed to load units')
      setUnits((await unitsRes.json()).units ?? [])
    }
  }, [propertyId])

  if (!property) return <p>Property not found.</p>

  // Calculated metrics
  const occupiedUnits = units.filter((u) => u.occupancy === 'OCCUPIED')
  const occupancyRate = property?.unitsTotal
    ? Math.round((occupiedUnits.length / property.unitsTotal) * 100)
    : undefined

  // Tenant summary
  const tenantCount = units.reduce((acc, u) => acc + (u.occupant?.tenantId ? 1 : 0), 0)

  // Unit action — typed callback
  const viewUnit = useCallback(
    () => {
      // In full impl: router.push(`/units/${item.id}`)
    },
    [],
  )

  const { columns } = buildUnitColumns({
    showProperty: true,
    showTenant: false,
    showRent: false,
    showBills: false,
    showBalance: false,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={property?.name || 'Property Details'}
        description={`
          ${occupiedUnits.length} of ${property?.unitsTotal ?? units.length} units occupied
${occupancyRate !== undefined ? ` (${occupancyRate}% occupancy)` : ""}
${tenantCount > 0 ? ` · ${tenantCount} tenants` : ""}
        `}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary Card */}
        <Card variant="elevated" className="p-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {occupiedUnits.length} occupied ·
              {property?.unitsTotal - occupiedUnits.length} vacant
            </p>
            {occupancyRate !== undefined && (
              <p className="text-sm text-muted-foreground">
                {occupancyRate}% occupancy rate
              </p>
            )}
            {tenantCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {tenantCount} tenants
              </p>
            )}
          </CardContent>
        </Card>

        {/* Units Table */}
        <Card variant="elevated" className="p-4">
          <CardHeader>
            <CardTitle>Units ({units.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveDataListing
              title="Units"
              description="Filter by status or search below"
              items={units}
              columns={columns}
              cardMapper={({ unit }) => ({
                id: unit.id,
                title: unit.unitRef,
                subtitle: [unit.property?.name, unit.label].filter(Boolean).join(' · ') || undefined,
                fallbackIcon: () => <Building2 className="size-4" />,
                statusBadge: () => <Badge variant={unit.occupancy === 'OCCUPIED' ? 'default' : 'neutral'} size="sm">{unit.occupancy}</Badge>,
              })}
              rowKey={(u) => u.id}
              searchQuery=""
              searchPlaceholder="Search units..."
              filterChips
              emptyState={{
                icon: Building2,
                title: 'No units yet',
                description: 'Add units to this property to get started.'
              }}
              count={units.length}
              loading={false}
            />
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">Add Unit</Button>
          </CardFooter>
        </Card>
      </div>

      {/* Maintenance & Waste */}
      <Card variant="elevated" className="p-4">
        <CardHeader>
          <CardTitle>Maintenance & Waste</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {units.filter((u) => u.occupancy === 'MAINTENANCE').length} maintenance jobs
          </p>
          <p className="text-sm text-muted-foreground">
            {units.filter((u) => u.occupancy === 'BLOCKED').length} blocked
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm">Schedule Waste Collection</Button>
        </CardFooter>
      </Card>
    </div>
  )
}