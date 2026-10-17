import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { EmailSendError } from '../errors'
import type { EmailConfig, EmailMessage, SendResult } from '../types'

/** RFC 5322-ish message built locally so the file opens in any mail client. */
function buildEml(message: EmailMessage, config: EmailConfig): string {
  const recipients = Array.isArray(message.to) ? message.to : [message.to]
  const boundary = `sisohome-${randomBytes(8).toString('hex')}`
  const headers = [
    `From: ${config.from}`,
    `To: ${recipients.join(', ')}`,
    `Subject: ${message.subject}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
    ...Object.entries(message.headers ?? {}).map(([k, v]) => `${k}: ${v}`),
  ]

  const text = message.text ?? ''
  return [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.html,
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

/**
 * Development transport: writes the message to `.eml` instead of sending it.
 * This is what makes the flow end-to-end testable with no credentials — open
 * the file, click the link, read the code.
 */
export async function sendViaOutbox(
  message: EmailMessage,
  config: EmailConfig
): Promise<SendResult> {
  const recipients = Array.isArray(message.to) ? message.to : [message.to]
  const id = `${Date.now()}-${randomBytes(6).toString('hex')}`

  try {
    await mkdir(config.outboxDir, { recursive: true })
    const file = path.join(config.outboxDir, `${id}.eml`)
    await writeFile(file, buildEml(message, config), 'utf8')
    console.info(`📧 [outbox] to=${recipients.join(', ')} subject="${message.subject}" → ${file}`)
    return { id, transport: 'outbox', to: recipients, subject: message.subject, outboxPath: file }
  } catch (error) {
    throw new EmailSendError('Could not write the outbox message', 'outbox', { cause: error })
  }
}
