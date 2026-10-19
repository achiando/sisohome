import { renderEmail } from '@workspace/email'
import type { EmailMessage } from '@workspace/email'

export interface LoginAlertInput {
  to: string
  recipientName?: string
  /** e.g. "Chrome on macOS (Desktop)" */
  device: string
  /** e.g. "Lisbon, Portugal" / "Local machine" / "Unknown location" */
  location: string
  /** Raw IP the sign-in came from. */
  ip: string
  /** "17 Oct 2026, 18:05 UTC" */
  time: string
  /** Where to go if it wasn't you — account settings. */
  settingsUrl: string
}

export function loginAlertEmail(input: LoginAlertInput): EmailMessage {
  const intro = input.recipientName
    ? `Hi ${input.recipientName}, your SisoHome account was just used to sign in.`
    : 'Your SisoHome account was just used to sign in.'

  const { html, text } = renderEmail({
    heading: 'New sign-in to your account',
    intro,
    details: [
      { label: 'Device', value: input.device },
      { label: 'Location', value: input.location },
      { label: 'IP address', value: input.ip, mono: true },
      { label: 'Time', value: input.time },
    ],
    note: 'If this was not you, change your password right away — someone else may have your sign-in details.',
    cta: { label: 'Open account settings', url: input.settingsUrl },
    outro: ['Automatic security notice — you receive one of these for every sign-in.'],
  })

  return {
    to: input.to,
    subject: `New sign-in from ${input.device}`,
    html,
    text,
  }
}
