/**
 * In-app notifications (bell) — org-user facing alerts written by jobs and
 * domain events (payment claims, lease expiries, cron summaries). Email is a
 * separate channel (apps/web/lib/email); nothing here sends mail.
 *
 * Reads are always scoped to the caller's own rows within their org. Jobs
 * write through `notifyOrgUsers` with a permission-key recipient filter so
 * only staff who could see the underlying entity get pinged.
 */
import { db } from '@/lib/auth';
import { RouteError } from '@/lib/api-route';
import type { ScopeActor } from './property-scope';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export type NotificationList = {
  unread: number;
  rows: NotificationRow[];
};

const LIST_CAP = 30;

function shape(n: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRow {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function listNotifications(actor: ScopeActor): Promise<NotificationList> {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { organizationId: actor.organizationId, userId: actor.userId },
      orderBy: { createdAt: 'desc' },
      take: LIST_CAP,
    }),
    db.notification.count({
      where: { organizationId: actor.organizationId, userId: actor.userId, readAt: null },
    }),
  ]);
  return { unread, rows: rows.map(shape) };
}

export async function markNotificationRead(actor: ScopeActor, id: string): Promise<void> {
  const result = await db.notification.updateMany({
    where: { id, organizationId: actor.organizationId, userId: actor.userId },
    data: { readAt: new Date() },
  });
  if (result.count === 0) throw new RouteError(404, 'Notification not found');
}

export async function markAllNotificationsRead(actor: ScopeActor): Promise<number> {
  const result = await db.notification.updateMany({
    where: { organizationId: actor.organizationId, userId: actor.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export interface NotifyInput {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Active org members holding `permissionKey` (role → permission match).
 * Empty array when no one qualifies — callers just no-op.
 */
async function recipientsWith(orgId: string, permissionKey: string): Promise<string[]> {
  const members = await db.organizationMember.findMany({
    where: {
      organizationId: orgId,
      status: 'ACTIVE',
      roles: { some: { role: { permissions: { some: { permission: { key: permissionKey } } } } } },
    },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/** Fan a notification out to explicit user ids (dedupes, org-scoped). */
export async function notifyUsers(
  orgId: string,
  userIds: string[],
  input: NotifyInput,
): Promise<number> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;
  const rows = await db.notification.createMany({
    data: unique.map((userId) => ({
      organizationId: orgId,
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    })),
  });
  return rows.count;
}

/** Fan out to every active member with `permissionKey`. */
export async function notifyOrgUsers(
  orgId: string,
  permissionKey: string,
  input: NotifyInput,
): Promise<number> {
  return notifyUsers(orgId, await recipientsWith(orgId, permissionKey), input);
}

/**
 * Deduped variant for recurring jobs — returns 0 when a notification of
 * `type` with the same `dedupeKey` already exists for any recipient (jobs
 * pass a lease/period key so re-runs stay quiet).
 */
export async function notifyOrgUsersOnce(
  orgId: string,
  permissionKey: string,
  dedupeKey: string,
  input: NotifyInput,
): Promise<number> {
  const existing = await db.notification.findFirst({
    where: { organizationId: orgId, type: input.type, metadata: { path: ['dedupeKey'], equals: dedupeKey } },
    select: { id: true },
  });
  if (existing) return 0;
  return notifyOrgUsers(orgId, permissionKey, {
    ...input,
    metadata: { ...(input.metadata ?? {}), dedupeKey },
  });
}
