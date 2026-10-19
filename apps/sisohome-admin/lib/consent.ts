/**
 * Versioned user consent (Terms of Service, Privacy Policy).
 *
 * One row per (user, document, version) with the acceptance timestamp,
 * IP and user agent — the compliance record of WHAT the user agreed to
 * and WHEN. Bump a version constant when the document text changes to
 * require a fresh opt-in; old rows stay as history.
 */

import type { NextRequest } from 'next/server';
import { ConsentType } from '@workspace/database';

import { prisma } from '@/lib/auth';
import { clientIp } from '@/lib/login-alert';
import { CONSENT_VERSIONS } from '@/lib/consent-versions';

export { CONSENT_VERSIONS };

/** Every document a user must accept before using the product. */
export const REQUIRED_CONSENTS: ConsentType[] = [
  ConsentType.TERMS_OF_SERVICE,
  ConsentType.PRIVACY_POLICY,
];

interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Capture the request facts stored alongside the acceptance. */
export function consentMetadata(request: NextRequest): RequestMeta {
  return {
    ipAddress: clientIp(request),
    userAgent: request.headers.get('user-agent'),
  };
}

/**
 * Record acceptance of every required document at its current version.
 * Idempotent: re-submitting (double click, retry) is a no-op.
 */
export async function recordConsents(
  userId: string,
  meta: RequestMeta,
): Promise<void> {
  await prisma.userConsent.createMany({
    data: REQUIRED_CONSENTS.map((type) => ({
      userId,
      type,
      policyVersion: CONSENT_VERSIONS[type],
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })),
    skipDuplicates: true,
  });
}

/**
 * True when the user is missing any required consent at the current
 * version (never accepted, or a policy was updated since).
 */
export async function needsConsents(userId: string): Promise<boolean> {
  const rows = await prisma.userConsent.findMany({
    where: {
      userId,
      type: { in: REQUIRED_CONSENTS },
    },
    select: { type: true, policyVersion: true },
  });
  const held = new Set(rows.map((r) => `${r.type}:${r.policyVersion}`));
  return REQUIRED_CONSENTS.some(
    (type) => !held.has(`${type}:${CONSENT_VERSIONS[type]}`),
  );
}
