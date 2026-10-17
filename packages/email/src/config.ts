import path from 'node:path'
import { EmailConfigError } from './errors'
import type { EmailConfig, EmailTransportName } from './types'

const TRANSPORTS: readonly EmailTransportName[] = ['outbox', 'resend', 'smtp']

const DEFAULT_FROM = 'SisoHome <no-reply@sisohome.app>'

/**
 * Read email configuration from the environment on every send so tests and
 * dev servers can switch transport without a rebuild.
 *
 *   EMAIL_TRANSPORT = outbox | resend | smtp   (default: outbox)
 *   EMAIL_FROM       = "SisoHome <no-reply@sisohome.app>"
 *   EMAIL_OUTBOX_DIR = .email-outbox           (relative to the process cwd)
 *   RESEND_API_KEY   = ...                     (resend)
 *   SMTP_URL         = smtp://user:pass@host   (smtp)
 */
export function resolveEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const raw = env.EMAIL_TRANSPORT ?? 'outbox'
  if (!TRANSPORTS.includes(raw as EmailTransportName)) {
    throw new EmailConfigError(
      `Unknown EMAIL_TRANSPORT "${raw}". Use one of: ${TRANSPORTS.join(', ')}.`
    )
  }
  const transport = raw as EmailTransportName

  // Writing files instead of sending mail would silently lose every message
  // in production — refuse to run rather than pretend mail went out.
  if (transport === 'outbox' && env.NODE_ENV === 'production') {
    throw new EmailConfigError(
      'EMAIL_TRANSPORT=outbox in production would silently drop mail. Set resend or smtp (and its credentials).'
    )
  }
  if (transport === 'resend' && !env.RESEND_API_KEY) {
    throw new EmailConfigError('EMAIL_TRANSPORT=resend requires RESEND_API_KEY.')
  }
  if (transport === 'smtp' && !env.SMTP_URL) {
    throw new EmailConfigError('EMAIL_TRANSPORT=smtp requires SMTP_URL.')
  }

  return {
    transport,
    from: env.EMAIL_FROM ?? DEFAULT_FROM,
    outboxDir: path.resolve(process.cwd(), env.EMAIL_OUTBOX_DIR ?? '.email-outbox'),
    resendApiKey: env.RESEND_API_KEY,
    smtpUrl: env.SMTP_URL,
  }
}
