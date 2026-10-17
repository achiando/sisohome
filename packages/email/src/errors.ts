import type { EmailTransportName } from './types'

/** Configuration is missing/unusable — the app must fix its environment. */
export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailConfigError'
  }
}

/** The send itself failed (provider error, network, invalid recipient). */
export class EmailSendError extends Error {
  transport?: EmailTransportName

  constructor(message: string, transport?: EmailTransportName, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'EmailSendError'
    this.transport = transport
  }
}
