import { EmailSendError } from '../errors'
import type { EmailConfig, EmailMessage, SendResult } from '../types'

/**
 * Any SMTP server (Postmark, Mailgun, Gmail app passwords, corporate relay).
 * `SMTP_URL` is passed straight to nodemailer, e.g.
 * `smtp://user:pass@smtp.example.com:587`.
 *
 * nodemailer is imported lazily so apps that only use the outbox or Resend
 * never pay for it at module load.
 */
export async function sendViaSmtp(message: EmailMessage, config: EmailConfig): Promise<SendResult> {
  const recipients = Array.isArray(message.to) ? message.to : [message.to]

  let nodemailer: typeof import('nodemailer')
  try {
    nodemailer = await import('nodemailer')
  } catch (error) {
    throw new EmailSendError('nodemailer is not installed — run pnpm install', 'smtp', {
      cause: error,
    })
  }

  try {
    const transport = nodemailer.createTransport(config.smtpUrl)
    const info = await transport.sendMail({
      from: config.from,
      to: recipients,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      headers: message.headers,
    })
    return {
      id: info.messageId ?? `smtp-${Date.now()}`,
      transport: 'smtp',
      to: recipients,
      subject: message.subject,
    }
  } catch (error) {
    throw new EmailSendError(
      error instanceof Error ? error.message : 'SMTP send failed',
      'smtp',
      { cause: error }
    )
  }
}
