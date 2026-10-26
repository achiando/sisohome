import { renderEmail } from '@workspace/email'
import type { EmailMessage } from '@workspace/email'

export interface PaymentClaimResultInput {
  to: string
  tenantName?: string
  organizationName?: string
  status: 'CONFIRMED' | 'REJECTED'
  /** e.g. "KES 25,000.00" — pre-formatted by the caller. */
  amount: string
  /** "12 Oct 2026" — the paidAt date the tenant reported. */
  paidAt: string
  /** M-Pesa code etc., when the tenant supplied one. */
  reference?: string | null
  /** PM's rejection reason, if any. */
  note?: string | null
  statementUrl: string
}

const STATUS_VERB: Record<'CONFIRMED' | 'REJECTED', string> = {
  CONFIRMED: 'confirmed',
  REJECTED: 'needs attention',
}

export function paymentClaimResultEmail(input: PaymentClaimResultInput): EmailMessage {
  const intro = input.tenantName
    ? `Hi ${input.tenantName}, the payment you submitted was ${STATUS_VERB[input.status]}.`
    : `The payment you submitted was ${STATUS_VERB[input.status]}.`

  const details: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Amount', value: input.amount },
    { label: 'Date paid', value: input.paidAt },
  ]
  if (input.reference) details.push({ label: 'Reference', value: input.reference, mono: true })

  const { html, text } = renderEmail({
    heading:
      input.status === 'CONFIRMED' ? 'Your payment was recorded' : 'Your payment needs attention',
    intro,
    details,
    ...(input.status === 'REJECTED'
      ? {
          note: input.note
            ? `Reason from ${input.organizationName ?? 'your landlord'}: ${input.note}`
            : 'Please contact your landlord or property manager for details.',
          paragraphs: [
            'No money has been recorded against your rent — please reply or call your property manager to sort this out.',
          ],
        }
      : {
          note: 'The payment has been applied to your oldest open charges. Your statement is updated.',
        }),
    cta: { label: 'View your statement', url: input.statementUrl },
    outro: [`${input.organizationName ?? 'Your landlord'} via SisoHome`],
  })

  return {
    to: input.to,
    subject:
      input.status === 'CONFIRMED'
        ? `Payment received — ${input.amount}`
        : `Payment query — ${input.amount}`,
    html,
    text,
  }
}
