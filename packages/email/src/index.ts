export { sendEmail } from './send'
export { resolveEmailConfig } from './config'
export { EmailConfigError, EmailSendError } from './errors'
export { renderEmail, escapeHtml, type RenderEmailOptions } from './render'
export { maskEmail } from './mask'
export type {
  EmailConfig,
  EmailMessage,
  EmailTransportName,
  RenderedEmail,
  SendResult,
} from './types'
