import { renderEmail } from '@workspace/email'
import type { EmailMessage } from '@workspace/email'

export interface VerifyEmailInput {
  to: string
  /** Absolute URL carrying the single-use token. */
  verifyUrl: string
  expiresInHours: number
  recipientName?: string
  /** 6-digit code — shown as a code block so the address can be proven by typing it. */
  code?: string
}

export function verifyEmailTemplate(input: VerifyEmailInput): EmailMessage {
  const intro = input.recipientName
    ? `Hi ${input.recipientName}, your SisoHome account is almost ready — confirm this address to finish signing up.`
    : 'Your SisoHome account is almost ready — confirm this address to finish signing up.'

  const { html, text } = renderEmail({
    heading: 'Confirm your email address',
    intro,
    code: input.code,
    codeHint: input.code
      ? 'Enter this code on the verification page — no link click needed.'
      : undefined,
    paragraphs: [
      input.code
        ? 'Verify either way: type the code above at the verification page, or click the button below.'
        : 'Click the button below to verify. You can then finish setting up your account.',
    ],
    cta: { label: 'Verify email address', url: input.verifyUrl },
    note: `This link expires in ${input.expiresInHours} hours and can be used once.`,
    outro: [
      'If you did not create a SisoHome account, you can safely ignore this email — nothing is registered until you verify.',
    ],
  })

  return {
    to: input.to,
    subject: 'Confirm your email address for SisoHome',
    html,
    text,
  }
}
