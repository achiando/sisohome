/**
 * Stateless intake-link tokens (people plan §5).
 *
 * A staff member issues a short link (`/i/<token>`) that lets an anonymous
 * applicant open a pre-scoped self-onboarding form. No DB row backs the
 * link: the capability travels INSIDE the token, signed with
 * INTAKE_TOKEN_SECRET (HMAC-SHA256), so a leaked DB dump never mints links
 * and a tampered token never passes verification.
 *
 * Payload (base64url JSON):
 *   v  format version (1)
 *   p  propertyId the link is scoped to
 *   u  unitId the link is pre-bound to (optional)
 *   o  ORGANIZATION that ISSUED the link — the capturing org (audits +
 *      applicant reuse lookups anchor here, mirroring the party rule:
 *      `organizationId` = the org that captured the party)
 *   by userId of the issuing staff member (audit attribution; may be gone
 *      by submit time → attributed best-effort)
 *   x  expiry, epoch SECONDS
 *   n  random nonce so two links for the same property never collide
 *
 * Verification fails CLOSED: missing key, bad shape, bad signature or
 * wrong version all read as `invalid` (→ 404); a valid signature past `x`
 * reads as `expired` (→ 410). Signature compare is timing-safe.
 */

import crypto from 'node:crypto';

const VERSION = 1;

export interface IntakeTokenPayload {
  v: number;
  p: string;
  u?: string;
  o: string;
  by?: string;
  x: number;
  n: string;
}

export type IntakeTokenFailure = 'invalid' | 'expired';

export type IntakeTokenResult =
  | { ok: true; payload: IntakeTokenPayload }
  | { ok: false; reason: IntakeTokenFailure };

function signingKey(): Buffer {
  const raw = process.env.INTAKE_TOKEN_SECRET;
  if (!raw) {
    throw new Error(
      'INTAKE_TOKEN_SECRET is not set — refusing to sign or verify an intake link without it.',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('INTAKE_TOKEN_SECRET must be 32 bytes, base64-encoded.');
  }
  return key;
}

function sign(body: string): string {
  return crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
}

/**
 * Sign a payload into `v1.<payload>.<signature>`.
 * `expiresAt` is a Date; stored as epoch seconds inside the token.
 */
export function signIntakeToken(payload: IntakeTokenPayload): string {
  const body = Buffer.from(JSON.stringify({ ...payload, v: VERSION })).toString('base64url');
  return `v1.${body}.${sign(body)}`;
}

/** Build + sign a fresh token with the given scope and TTL. */
export function issueIntakeToken(input: {
  propertyId: string;
  unitId?: string;
  organizationId: string;
  issuedByUserId?: string;
  ttlSeconds: number;
}): string {
  return signIntakeToken({
    v: VERSION,
    p: input.propertyId,
    ...(input.unitId ? { u: input.unitId } : {}),
    o: input.organizationId,
    ...(input.issuedByUserId ? { by: input.issuedByUserId } : {}),
    x: Math.floor(Date.now() / 1000) + input.ttlSeconds,
    n: crypto.randomBytes(8).toString('base64url'),
  });
}

/**
 * Verify + parse. Never throws for untrusted input (a missing/short key is
 * still fail-closed via the catch → `invalid`).
 */
export function verifyIntakeToken(token: string | undefined | null): IntakeTokenResult {
  if (!token) return { ok: false, reason: 'invalid' };
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, reason: 'invalid' };
    const [, body, signature] = parts as [string, string, string];
    if (!body || !signature) return { ok: false, reason: 'invalid' };

    const expected = sign(body);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: 'invalid' };
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as IntakeTokenPayload;
    if (
      payload?.v !== VERSION ||
      typeof payload.p !== 'string' ||
      typeof payload.o !== 'string' ||
      typeof payload.x !== 'number'
    ) {
      return { ok: false, reason: 'invalid' };
    }
    if (payload.x * 1000 < Date.now()) return { ok: false, reason: 'expired' };
    return { ok: true, payload };
  } catch {
    // Bad base64, bad JSON, missing key — all untrusted input.
    return { ok: false, reason: 'invalid' };
  }
}
