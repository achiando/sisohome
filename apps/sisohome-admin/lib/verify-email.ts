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

export function generateVerificationToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex')
}

/**
 * Issue a fresh link for the user, invalidating any earlier outstanding one
 * so only the most recent email opens the account.
 */
export async function issueVerificationToken(userId: string): Promise<string> {
  const token = generateVerificationToken()
  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId } }),
    db.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashVerificationToken(token),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 3_600_000),
      },
    }),
  ])
  return token
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

/** Mark the link consumed. Returns false when someone already used it. */
export async function consumeVerificationToken(tokenId: string): Promise<boolean> {
  const result = await db.emailVerificationToken.updateMany({
    where: { id: tokenId, usedAt: null },
    data: { usedAt: new Date() },
  })
  return result.count === 1
}

export function verificationUrl(token: string): string {
  return `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`
}
