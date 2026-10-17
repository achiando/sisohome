import { EmailSendError } from '../errors'
import type { EmailConfig, EmailMessage, SendResult } from '../types'

/**
 * Resend over its HTTP API — no SDK, so the dependency stays optional and the
 * call site is one fetch. Requires RESEND_API_KEY.
 */
export async function sendViaResend(
  message: EmailMessage,
  config: EmailConfig
): Promise<SendResult> {
  const recipients = Array.isArray(message.to) ? message.to : [message.to]

  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: recipients,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        headers: message.headers,
      }),
    })
  } catch (error) {
    throw new EmailSendError('Could not reach Resend', 'resend', { cause: error })
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new EmailSendError(`Resend responded ${response.status}: ${detail}`, 'resend')
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string }
  return {
    id: data.id ?? `resend-${Date.now()}`,
    transport: 'resend',
    to: recipients,
    subject: message.subject,
  }
}
