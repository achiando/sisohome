/**
 * Domain audit helper — thin wrapper over `AuditService`.
 *
 * Every state-changing service call in apps/web appends one audit row:
 *
 *   await auditLog(actor, 'PROPERTY', 'property.create', property.id,
 *     { name: input.name });
 *
 * Failures never fail the request (AuditService.log swallows + logs), so a
 * broken audit sink can't roll back business data — but the call itself is
 * mandatory for compliance (SECURITY.md §audit).
 */

import { AuditService, type AuditLogData } from '@workspace/database';
import { db } from '@/lib/auth';

const auditService = new AuditService(db);

export async function auditLog(
  actor: { userId: string; organizationId: string },
  resourceType: AuditLogData['resourceType'] | string,
  action: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
  /**
   * Row home-org override. Property-family writes log under the property's
   * PORTFOLIO org so the owner's activity feed sees every action (including
   * edits made by a managing org), while managed orgs read back only their
   * own org's rows (plan-slice-1 §3.1 activity rule).
   */
  organizationId?: string,
): Promise<void> {
  await auditService.log({
    actorUserId: actor.userId,
    organizationId: organizationId ?? actor.organizationId,
    resourceType,
    resourceId,
    action,
    metadata,
  });
}
