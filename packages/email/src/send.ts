import { resolveEmailConfig } from './config'
import { EmailSendError } from './errors'
import type { EmailConfig, EmailMessage, SendResult } from './types'
import { sendViaOutbox } from './transports/outbox'
import { sendViaResend } from './transports/resend'
import { sendViaSmtp } from './transports/smtp'

/** Validate the payload before any transport is selected. */
function assertSendable(message: EmailMessage): void {
  const recipients = Array.isArray(message.to) ? message.to : [message.to]
  if (recipients.length === 0 || recipients.some((r) => !r || !r.includes('@'))) {
    throw new EmailSendError('sendEmail() needs at least one valid recipient address.')
  }
  if (!message.subject?.trim()) {
    throw new EmailSendError('sendEmail() needs a subject.')
  }
  if (!message.html?.trim()) {
    throw new EmailSendError('sendEmail() needs an html body.')
  }
}

/**
 * The package's single entry point: validate, resolve the transport from the
 * environment, send, and return where it went.
 *
 * Call sites never branch on provider — switching EMAIL_TRANSPORT is enough.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  assertSendable(message)
  const config: EmailConfig = resolveEmailConfig()

  switch (config.transport) {
    case 'outbox':
      return sendViaOutbox(message, config)
    case 'resend':
      return sendViaResend(message, config)
    case 'smtp':
      return sendViaSmtp(message, config)
    default:
      throw new EmailSendError(`No transport for "${config.transport}".`)
  }
}
