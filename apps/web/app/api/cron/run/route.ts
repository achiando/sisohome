import { timingSafeEqual } from 'node:crypto';

import { runScheduledJob } from '@/lib/domain/scheduler';

/**
 * POST /api/cron/run — GitHub Actions entry point for the scheduled jobs
 * (charge generation, lease-expiry alerts). No session exists here: the
 * route is public-allowlisted in proxy.ts and gated by `CRON_SECRET` sent
 * as a Bearer token (timing-safe compare). Accepts an optional JSON body:
 * `{ job?: 'all' | 'generate-charges' | 'lease-expiry', organizationId?,
 *    propertyId?, month? }` — filters exist for manual re-runs and tests.
 */
function unauthorized(): Response {
  return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

function bearerMatches(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { success: false, error: 'CRON_SECRET is not configured' },
      { status: 503 },
    );
  }
  if (!bearerMatches(request, secret)) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

  try {
    const result = await runScheduledJob(str(body.job) ?? 'all', {
      organizationId: str(body.organizationId),
      propertyId: str(body.propertyId),
      month: str(body.month),
    });
    return Response.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Job failed';
    return Response.json({ success: false, error: message }, { status: 400 });
  }
}
