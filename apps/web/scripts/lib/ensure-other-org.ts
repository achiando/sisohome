/**
 * Persistent cross-org fixture for smokes: returns ANY organization other than
 * `mainOrgId`, creating a stable one on first use.
 *
 * Several smokes gate stranger/tenancy checks behind a second org
 * (`const stranger = otherOrg ? ... : null`), so on a freshly seeded single-org
 * database those cases silently do not run and totals fall short of the
 * recorded STATUS baselines. Using this helper makes the second org a
 * deterministic, durable part of the smoke setup instead of an accident of
 * whichever earlier run happened to leave one behind.
 */
import { prisma } from '@/lib/auth';

export async function ensureOtherOrg(mainOrgId: string) {
  const existing = await prisma.organization.findFirst({
    where: { id: { not: mainOrgId }, status: 'ACTIVE' },
  });
  if (existing) return existing;
  return prisma.organization.create({
    data: {
      name: 'SMOKE Cross-Org Fixture',
      slug: `smoke-cross-org-${Date.now()}`,
      kind: 'LANDLORD',
      status: 'ACTIVE',
    },
  });
}
