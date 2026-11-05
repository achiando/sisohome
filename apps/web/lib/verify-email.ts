import { createHash, randomBytes } from 'node:crypto'

import { db } from '@/lib/auth'
import { appUrl } from '@/lib/base-url'

/**
 * Signup verification links: 24-hour, single-use, stored only as a SHA-256
 * hash so a database leak never yields a live link. Sign-in stays closed for
 * the account until one of these is redeemed (or an admin created the
 * account with credentials delivered by email).
 */

export const EMAIL_VERIFICATION_TTL_HOURS = 24

/** 6-digit verification code for email confirmation (stored in EmailVerificationToken.code) */
export const EMAIL_CODE_TTL_HOURS = 24

export function generateVerificationToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex')
}

/** Hash a 6-digit code for database storage */
export function hashCode(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex')
}

/** Generate a 6-digit verification code */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/** Look up a verification record by token or code. */
export async function findVerificationRecord(tokenOrCode: string) {
  // Try as token first
  const tokenHash = hashVerificationToken(tokenOrCode)
  const tokenRecord = await db.emailVerificationToken.findUnique({
    where: { tokenHash },
  })
  if (tokenRecord && !tokenRecord.usedAt && tokenRecord.expiresAt.getTime() > Date.now()) {
    return { type: 'token', record: tokenRecord }
  }
  // Try as code (stored in EmailVerificationToken.code). `code` is not a
  // unique column, so findFirst is required — findUnique would throw.
  const codeRecord = await db.emailVerificationToken.findFirst({
    where: { code: tokenOrCode },
    orderBy: { createdAt: 'desc' },
  })
  if (codeRecord && !codeRecord.usedAt && codeRecord.expiresAt.getTime() > Date.now()) {
    return { type: 'code', record: codeRecord }
  }
  return null
}

/** Mark a verification record (token or code) as consumed. */
export async function consumeVerificationRecord(tokenOrCode: string): Promise<boolean> {
  const record = await findVerificationRecord(tokenOrCode)
  if (!record) return false
  if (record.type === 'token') {
    return await db.emailVerificationToken.updateMany({
      where: { id: record.record.id, usedAt: null },
      data: { usedAt: new Date() },
    }).then(r => r.count === 1)
  } else {
    return await db.emailVerificationToken.updateMany({
      where: { code: record.record.code, usedAt: null },
      data: { usedAt: new Date() },
    }).then(r => r.count === 1)
  }
}

/**
 * Issue a fresh link for the user, invalidating any earlier outstanding one
 * so only the most recent email opens the account. Also generates a code.
 * Returns the plaintext token (for the emailed link) and the 6-digit code
 * (for manual entry) — the caller must use these exact values, since only
 * their hashes are stored.
 */
export async function issueVerificationToken(
  userId: string
): Promise<{ token: string; code: string }> {
  const token = generateVerificationToken()
  const code = generateVerificationCode()
  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId } }),
    db.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashVerificationToken(token),
        code,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 3_600_000),
      },
    }),
  ])
  return { token, code }
}

/** Look up a link that is still good (unused and unexpired), or null. */
export async function findValidVerificationToken(token: string) {
  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash: hashVerificationToken(token) },
  })
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return null
  }
  return record
}

/** Verification URL for token-based links */
export function verificationUrl(token: string): string {
  return `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`
}

/** Verification URL for code-based confirmation */
export function codeVerificationUrl(code: string): string {
  return `${appUrl()}/verify-email-by-code?code=${encodeURIComponent(code)}`
}
