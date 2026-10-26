import { renderEmail } from '@workspace/email'
import type { EmailMessage } from '@workspace/email'

export interface PortalInviteInput {
  to: string
  /** Absolute URL carrying the one-shot invite token. */
  acceptUrl: string
  tenantName: string
  organizationName?: string
  expiresInDays: number
}

export function portalInviteEmail(input: PortalInviteInput): EmailMessage {
  const from = input.organizationName
    ? `${input.organizationName} has invited you`
    : 'You have been invited'

  const { html, text } = renderEmail({
    heading: 'Your tenant portal is ready',
    intro: `${from} to the SisoHome tenant portal for ${input.tenantName}.`,
    paragraphs: [
      'Open the portal to set your password and see your lease, statements, documents and maintenance requests in one place.',
    ],
    cta: { label: 'Open the portal invitation', url: input.acceptUrl },
    note: `This link can be used once and expires in ${input.expiresInDays} days.`,
    outro: [
      'If you were not expecting this invitation, you can safely ignore this email — nothing is set up until you open the link.',
    ],
  })

  return {
    to: input.to,
    subject: 'Your SisoHome tenant portal invitation',
    html,
    text,
  }
}
