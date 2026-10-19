import { renderEmail } from '@workspace/email'
import type { EmailMessage } from '@workspace/email'

export interface MemberAddedInput {
  to: string
  /** Name of the person being added. */
  recipientName: string
  /** Who added them, when known. */
  inviterName?: string
  organizationName: string
  tempPassword: string
  signInUrl: string
}

export function memberAddedEmail(input: MemberAddedInput): EmailMessage {
  const by = input.inviterName ? `${input.inviterName} added` : 'An administrator added'
  const intro = `${by} you to ${input.organizationName} on SisoHome. Here is your temporary password:`

  const { html, text } = renderEmail({
    heading: `You've been added to ${input.organizationName}`,
    intro,
    code: input.tempPassword,
    codeHint: 'Enter it the first time you sign in.',
    paragraphs: [
      `Sign in as ${input.to} with this temporary password — SisoHome will ask you to choose a new one right away.`,
    ],
    cta: { label: 'Sign in to SisoHome', url: input.signInUrl },
    note: 'Treat this email as private until you have changed the password.',
    outro: [
      'If you were not expecting this invitation, contact your workspace administrator — and do not sign in.',
    ],
  })

  return {
    to: input.to,
    subject: `You've been added to ${input.organizationName}`,
    html,
    text,
  }
}
