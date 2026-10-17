import { createHash, randomInt } from 'node:crypto'

import { sendEmail } from '@workspace/email'

import { db } from '@/lib/auth'
import { twoFactorCodeEmail } from '@/lib/email/two-factor-code'

/**
 * Emailed one-time codes (2FA enrolment and sign-in).
 *
 * Codes are 6 digits, stored SHA-256 hashed, single-use (`usedAt`) and expire
 * after 10 minutes. Issuing a new code always invalidates the previous one for
 * that purpose, so only the latest email works.
 */

export const EMAIL_OTP_TTL_MINUTES = 10

export type EmailOtpPurpose = 'TWO_FACTOR_ENROL' | 'TWO_FACTOR_LOGIN'

export function generateEmailCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function hashEmailCode(code: string): string {
  return createHash('sha256').update(code.replace(/\D/g, '')).digest('hex')
}

/** Create a fresh code and email it. Throws if the email cannot be sent. */
export async function issueEmailOtp(userId: string, purpose: EmailOtpPurpose): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!user) {
    throw new Error('User not found')
  }

  const code = generateEmailCode()
  await db.$transaction([
    db.emailOtpCode.deleteMany({ where: { userId, purpose } }),
    db.emailOtpCode.create({
      data: {
        userId,
        purpose,
        codeHash: hashEmailCode(code),
        expiresAt: new Date(Date.now() + EMAIL_OTP_TTL_MINUTES * 60_000),
      },
    }),
  ])

  await sendEmail(
    twoFactorCodeEmail({
      to: user.email,
      code,
      expiresInMinutes: EMAIL_OTP_TTL_MINUTES,
      purpose: purpose === 'TWO_FACTOR_LOGIN' ? 'sign-in' : 'setup',
    }),
  )
}

/** Consume a code exactly once; rejects unknown, expired and reused codes. */
export async function redeemEmailOtp(
  userId: string,
  purpose: EmailOtpPurpose,
  code: string,
): Promise<boolean> {
  const match = await db.emailOtpCode.findFirst({
    where: {
      userId,
      purpose,
      codeHash: hashEmailCode(code),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (!match) return false

  const claimed = await db.emailOtpCode.updateMany({
    where: { id: match.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  return claimed.count === 1
}
