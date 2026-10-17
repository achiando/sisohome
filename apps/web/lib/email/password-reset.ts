import { renderEmail } from '@workspace/email'
import type { EmailMessage } from '@workspace/email'

export interface PasswordResetEmailInput {
  to: string
  /** Absolute URL carrying the single-use token, e.g. https://app/reset-password?token=... */
  resetUrl: string
  expiresInMinutes: number
  recipientName?: string
}

export function passwordResetEmail(input: PasswordResetEmailInput): EmailMessage {
  const intro = input.recipientName
    ? `Hi ${input.recipientName}, we received a request to reset the password for your SisoHome account.`
    : 'We received a request to reset the password for your SisoHome account.'

  const { html, text } = renderEmail({
    heading: 'Reset your password',
    intro,
    paragraphs: ['Choose a new password with the button below. The link can only be used once.'],
    cta: { label: 'Choose a new password', url: input.resetUrl },
    outro: [
      `This link expires in ${input.expiresInMinutes} minutes.`,
      'If you did not request this, you can safely ignore this email — your password stays as it is.',
    ],
  })

  return {
    to: input.to,
    subject: 'Reset your SisoHome password',
    html,
    text,
  }
}
