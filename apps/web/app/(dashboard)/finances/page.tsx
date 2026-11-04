'use client'

/* ── /finances — the money hub with property scoping (Slice 8) ──────────────────
 * UX gate: charge.list; property filter scopes all tabs to a specific property.
 * Server gate: charge.list on every tab fetch.
 * Design: reuses property-filter component + passes propertyId to each tab.
 *─────────────────────────────────────────────────────────────────────────────*/

import { useEffect, useState } from 'react'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { DetailTabs } from '@/app/(dashboard)/_components/domain/detail-tabs'
import { PropertyFilter } from './_components/property-filter'
import { DuesTab } from './_components/dues-tab'
import { ChargesTab } from './_components/charges-tab'
import { PaymentsTab } from './_components/payments-tab'
import { ReceiptsTab } from './_components/receipts-tab'
import { AdjustmentsTab } from './_components/adjustments-tab'

export default function FinancesPage() {
  const { hasUiPermission } = useUiPermission()

  if (!hasUiPermission('charge.list')) {
    return (
      <ScopeDenied message="You need the charge.list permission to view finances. Ask an owner or admin of your organization." />
    )
  }

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <PropertyFilter
        propertyId={selectedPropertyId}
        onPropertyChange={setSelectedPropertyId}
      />
      <DetailTabs
        defaultTab="dues"
        tabs={[
          { id: 'dues', label: 'Dues', content: <DuesTab propertyId={selectedPropertyId} /> },
          { id: 'charges', label: 'Charges', content: <ChargesTab propertyId={selectedPropertyId} /> },
          { id: 'payments', label: 'Payments', content: <PaymentsTab propertyId={selectedPropertyId} /> },
          { id: 'receipts', label: 'Receipts', content: <ReceiptsTab /> },
          { id: 'adjustments', label: 'Adjustments', content: <AdjustmentsTab /> },
        ]}
      />
    </div>
  )
}