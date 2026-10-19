/**
 * Two-factor authentication helpers (TOTP / RFC 6238).
 *
 * Compatible with Google Authenticator, Authy, 1Password, Microsoft
 * Authenticator — anything that speaks `otpauth://` TOTP.
 *
 * Secrets are AES-256-GCM encrypted at rest with TWO_FACTOR_ENCRYPTION_KEY so
 * a database leak never exposes a usable authenticator secret. Decryption
 * fails closed: if the key is missing or wrong, 2FA verification fails rather
 * than falling back to plaintext.
 */

import crypto from 'node:crypto'
import { generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'

const ISSUER = 'SisoHome'
const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12
const ENC_PREFIX = 'v1'
const RECOVERY_CODE_COUNT = 10
/** ±1 time step (30s) so a slightly skewed phone clock still works. */
const TOKEN_TOLERANCE_SECONDS = 30
/** Ambiguous glyphs removed so codes are readable when typed from paper. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

function encryptionKey(): Buffer {
  const raw = process.env.TWO_FACTOR_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'TWO_FACTOR_ENCRYPTION_KEY is not set — refusing to store or read a TOTP secret without it.'
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY must be 32 bytes, base64-encoded.')
  }
  return key
}

/** AES-256-GCM → `v1.<iv>.<tag>.<ciphertext>` (all base64). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [ENC_PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.')
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  const [version, ivB64, tagB64, ctB64] = parts;
  if (parts.length !== 4 || version !== ENC_PREFIX || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Unrecognised two-factor secret format.');
  }
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}

/** Base32 secret the authenticator app stores (what the QR encodes). */
export function generateTotpSecret(): string {
  return generateSecret()
}

/** `otpauth://totp/...` URI — what Google Authenticator scans. */
export function buildOtpauthUri(accountEmail: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: accountEmail, secret })
}

export async function renderQrDataUri(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
}

/**
 * Validate a 6-digit code against the decrypted secret.
 * Returns false (never throws) on bad input so callers can send one generic
 * "invalid code" error and avoid oracle-style leaks.
 */
export async function verifyTotpToken(token: string, encryptedSecret: string): Promise<boolean> {
  const candidate = token.replace(/\D/g, '')
  if (candidate.length !== 6) return false
  try {
    const secret = decryptSecret(encryptedSecret)
    const result = await verify({ secret, token: candidate, epochTolerance: TOKEN_TOLERANCE_SECONDS })
    return result.valid
  } catch {
    return false
  }
}

/** `XXXXXX-XXXXXX` — 12 chars of ~5 bits = 60 bits of entropy per code. */
function randomRecoveryCode(): string {
  const bytes = crypto.randomBytes(12)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += CODE_ALPHABET.charAt((bytes[i] ?? 0) % CODE_ALPHABET.length)
    if (i === 5) out += '-'
  }
  return out
}

/** Human-facing code list, shown exactly once at enrolment. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => randomRecoveryCode())
}

/** SHA-256 of a normalised code — codes are high-entropy, so no KDF needed. */
export function hashRecoveryCode(code: string): string {
  const normalised = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return crypto.createHash('sha256').update(normalised).digest('hex')
}

// ─── Pending-2FA cookie (password OK, second factor not yet proven) ──────────

const PENDING_COOKIE = 'siso_2fa_pending'
const PENDING_TTL_MS = 10 * 60 * 1000

interface PendingPayload {
  userId: string
  exp: number
}

function sign(value: string): string {
  return crypto.createHmac('sha256', encryptionKey()).update(value).digest('base64url')
}

/** Issue a short-lived, httpOnly token proving the password step passed. */
export function encodePendingTwoFactor(userId: string): string {
  const payload: PendingPayload = { userId, exp: Date.now() + PENDING_TTL_MS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

/** Verify + parse the pending token. Returns null when absent/expired/tampered. */
export function decodePendingTwoFactor(value: string | undefined): PendingPayload | null {
  if (!value) return null
  const [body, signature] = value.split('.')
  if (!body || !signature) return null
  const expected = sign(body)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PendingPayload
    if (typeof payload.userId !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export { PENDING_COOKIE, PENDING_TTL_MS }
