'use client'

/**
 * /finances — the money hub (Slice 8; nav link existed, page did not).
 * UX gate: charge.list; every tab self-fetches its data behind the API
 * permission checks (charge, payment and adjustment keys).
 *
 * Tabs: Dues (default, tenant arrears + KPIs) · Charges (register + manual
 * create + invoice/adjust actions) · Payments (record + issue receipts) ·
 * Receipts (printable views) · Adjustments (submit/approve queue).
 */

import { PageHeader } from '@/app/(dashboard)/_components/domain/page-header'
import { ScopeDenied } from '@/app/(dashboard)/_components/domain/scope-denied'
import { DetailTabs } from '@/app/(dashboard)/_components/domain/detail-tabs'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { AdjustmentsTab } from './_components/adjustments-tab'
import { ChargesTab } from './_components/charges-tab'
import { DuesTab } from './_components/dues-tab'
import { PaymentsTab } from './_components/payments-tab'
import { ReceiptsTab } from './_components/receipts-tab'

export default function FinancesPage() {
  const { hasUiPermission } = useUiPermission()

  if (!hasUiPermission('charge.list')) {
    return (
      <ScopeDenied message="You need the charge.list permission to view finances. Ask an owner or admin of your organization." />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finances"
        description="Tenant dues, charges, payments, receipts and adjustments."
      />
      <DetailTabs
        defaultTab="dues"
        tabs={[
          { id: 'dues', label: 'Dues', content: <DuesTab /> },
          { id: 'charges', label: 'Charges', content: <ChargesTab /> },
          { id: 'payments', label: 'Payments', content: <PaymentsTab /> },
          { id: 'receipts', label: 'Receipts', content: <ReceiptsTab /> },
          { id: 'adjustments', label: 'Adjustments', content: <AdjustmentsTab /> },
        ]}
      />
    </div>
  )
}
