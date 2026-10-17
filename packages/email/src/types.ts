export type EmailTransportName = 'outbox' | 'resend' | 'smtp'

/** What the caller hands to sendEmail() — transport details are config, not payload. */
export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  /** Plain-text alternative. Strongly recommended: many clients block HTML. */
  text?: string
  replyTo?: string
  headers?: Record<string, string>
}

export interface EmailConfig {
  transport: EmailTransportName
  from: string
  /** Absolute directory the outbox transport writes .eml files into (dev). */
  outboxDir: string
  resendApiKey?: string
  smtpUrl?: string
}

export interface SendResult {
  /** Provider message id, or the generated id for the outbox. */
  id: string
  transport: EmailTransportName
  to: string[]
  subject: string
  /** Absolute path of the written .eml — only present for the outbox transport. */
  outboxPath?: string
}

export interface RenderedEmail {
  html: string
  text: string
}
