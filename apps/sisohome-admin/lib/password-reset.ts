import { createHash, randomBytes } from 'node:crypto'

import { db } from '@/lib/auth'
import { appUrl } from '@/lib/base-url'

/**
 * Password reset links: 30-minute, single-use, stored only as a SHA-256 hash
 * so a database leak never yields a live link.
 */

export const PASSWORD_RESET_TTL_MINUTES = 30

/** Re-exported so existing call sites keep one import. */
export { appUrl }

export function generateResetToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex')
}

/**
 * Issue a fresh token for the user, invalidating any earlier outstanding
 * link so only the most recent email works.
 */
export async function issueResetToken(userId: string): Promise<string> {
  const token = generateResetToken()
  await db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId } }),
    db.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
      },
    }),
  ])
  return token
}

/** Look up a link that is still good (unused and unexpired), or null. */
export async function findValidResetToken(token: string) {
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  })
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return null
  }
  return record
}
