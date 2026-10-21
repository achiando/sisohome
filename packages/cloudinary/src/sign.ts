import { createHash } from 'node:crypto'

/**
 * Signed-upload parameters for Cloudinary's direct REST upload endpoint.
 * Signature = sha1 of `folder=<folder>&timestamp=<ts><apiSecret>` — the
 * parameters must be listed alphabetically and match the form fields exactly.
 */
export function signUpload(params: { folder: string; timestamp: number }, apiSecret: string) {
  const toSign = `folder=${params.folder}&timestamp=${params.timestamp}${apiSecret}`
  return {
    timestamp: params.timestamp,
    signature: createHash('sha1').update(toSign).digest('hex'),
  }
}

/** Folders are path-like, lowercase, no traversal — reject anything else. */
export function sanitizeFolder(folder: string): string | null {
  const trimmed = folder.trim().replace(/^\/+|\/+$/g, '')
  if (trimmed === '') return null
  if (!/^[a-z0-9][a-z0-9/_-]{0,120}$/.test(trimmed)) return null
  if (trimmed.includes('..')) return null
  return trimmed
}
