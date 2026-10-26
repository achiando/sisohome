import { renderEmail } from '@workspace/email'
import type { EmailMessage } from '@workspace/email'

export interface BillingNoticeChargeLine {
  title: string
  dueDate: string
  balance: string
  overdue: boolean
}

export interface BillingNoticeBillLine {
  name: string
  amount: string
  frequency: string
}

export interface BillingNoticeUnit {
  unitRef: string
  propertyName: string
  currency: string
  open: string
  overdue: string
  overdueDays: number
  charges: BillingNoticeChargeLine[]
  bills: BillingNoticeBillLine[]
}

export interface BillingNoticeInput {
  to: string
  tenantName: string
  organizationName?: string
  /** Absolute portal statement URL. */
  statementUrl: string
  /** Notice issue date, YYYY-MM-DD. */
  issuedAt: string
  units: BillingNoticeUnit[]
  /** Aggregated only when every unit bills in one currency. */
  totals: { currency: string; open: string; overdue: string } | null
}

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
}

function amt(currency: string, value: string): string {
  const n = Number(value)
  return `${currency} ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function billingNoticeEmail(input: BillingNoticeInput): EmailMessage {
  const paragraphs: string[] = []
  for (const u of input.units) {
    const head = `${u.propertyName} · Unit ${u.unitRef}`
    const summary = Number(u.overdue) > 0.009
      ? `Open balance ${amt(u.currency, u.open)} — ${amt(u.currency, u.overdue)} overdue${u.overdueDays > 0 ? ` (${u.overdueDays} days past due)` : ''}`
      : Number(u.open) > 0.009
        ? `Open balance ${amt(u.currency, u.open)}`
        : 'Nothing outstanding'
    paragraphs.push(head, summary)
    for (const c of u.charges) {
      paragraphs.push(`• ${c.title} — due ${c.dueDate} — ${amt(u.currency, c.balance)}${c.overdue ? ' (overdue)' : ''}`)
    }
    for (const b of u.bills) {
      paragraphs.push(`• Scheduled bill: ${b.name} — ${amt(u.currency, b.amount)} ${FREQUENCY_LABEL[b.frequency] ?? b.frequency}`)
    }
  }

  const subject = input.totals
    ? `Billing notice — ${amt(input.totals.currency, input.totals.open)} open across ${input.units.length} unit${input.units.length === 1 ? '' : 's'}`
    : `Billing notice — ${input.units.length} unit${input.units.length === 1 ? '' : 's'}`

  const { html, text } = renderEmail({
    heading: 'Billing notice',
    intro: input.organizationName
      ? `${input.organizationName} has issued you a billing notice on ${input.issuedAt}.`
      : `A billing notice was issued to you on ${input.issuedAt}.`,
    paragraphs,
    ...(input.totals
      ? {
          details: [
            { label: 'Total open', value: amt(input.totals.currency, input.totals.open) },
            ...(Number(input.totals.overdue) > 0.009
              ? [{ label: 'Total overdue', value: amt(input.totals.currency, input.totals.overdue) }]
              : []),
          ],
        }
      : {}),
    cta: { label: 'View your statement', url: input.statementUrl },
    note: 'Amounts are current as at the issue date above and already include payments and approved adjustments.',
    outro: [
      'If you do not have a portal account yet, ask your landlord or manager for an invite — the portal shows your live statement any time.',
    ],
  })

  return {
    to: input.to,
    subject,
    html,
    text,
  }
}
