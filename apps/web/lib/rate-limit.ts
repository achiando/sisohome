/**
 * In-memory fixed-window rate limiting for auth endpoints.
 *
 * No external dependency — buckets live in this process (same durability
 * model as the permission caches). Limits are deliberately generous enough
 * for legitimate users and smoke tests, while capping what an attacker can
 * do per IP / per account:
 *
 *  - login:   30/min per IP, 10/5min per email (lockout)
 *  - 2FA:     30/min per IP, 6/10min per pending user (6-digit codes)
 *  - mails:   10/10min per IP on reset/resend/signup (inbox flooding)
 */

import { NextRequest, NextResponse } from 'next/server';

import { clientIp } from '@/lib/login-alert';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitCheck {
  /** e.g. `login:acct:someone@example.com` — must include the dimension. */
  key: string;
  limit: number;
  windowMs: number;
}

/** Count one attempt against a bucket. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
    // Pathological churn: never let the map trap memory.
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  return {
    ok: bucket.count <= limit,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/**
 * Consume quota for every check; returns a 429 response when any bucket is
 * exhausted, else null. Call before doing the expensive/sensitive work.
 */
export function checkRateLimits(checks: RateLimitCheck[]): NextResponse | null {
  let retryAfter = 0;
  let limited = false;

  for (const check of checks) {
    const result = rateLimit(check.key, check.limit, check.windowMs);
    if (!result.ok) {
      limited = true;
      retryAfter = Math.max(retryAfter, result.retryAfter);
    }
  }

  if (!limited) return null;
  return NextResponse.json(
    { success: false, error: 'Too many requests. Please wait a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

/** Stable key for a client IP (empty header collapses to a shared bucket). */
export function ipKey(request: NextRequest, prefix: string): string {
  return `${prefix}:ip:${clientIp(request) || 'unknown'}`;
}
