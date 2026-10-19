import { renderEmail } from '@workspace/email'
import type { EmailMessage } from '@workspace/email'

export interface TwoFactorCodeEmailInput {
  to: string
  /** 6-digit code, shown big and monospaced. */
  code: string
  expiresInMinutes: number
  /** What the code is for — 'sign-in' (second factor) or 'setup' (enrolment). */
  purpose: 'sign-in' | 'setup'
}

export function twoFactorCodeEmail(input: TwoFactorCodeEmailInput): EmailMessage {
  const intro =
    input.purpose === 'setup'
      ? 'Use this code to finish turning on two-factor authentication for your SisoHome account.'
      : 'Use this code to finish signing in to your SisoHome account.'

  const { html, text } = renderEmail({
    heading: input.purpose === 'setup' ? 'Your setup code' : 'Your sign-in code',
    intro,
    code: input.code,
    codeHint: 'It expires shortly — request a new one if you run out of time.',
    outro: [
      `This code expires in ${input.expiresInMinutes} minutes and can be used once.`,
      'If this was not you, change your password — someone else may have it.',
    ],
  })

  return {
    to: input.to,
    subject: input.purpose === 'setup' ? 'Your SisoHome setup code' : 'Your SisoHome sign-in code',
    html,
    text,
  }
}
