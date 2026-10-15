import { PrismaClient } from '../prisma';

export interface AuditLogData {
  actorUserId?: string;
  organizationId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: data.actorUserId,
          organizationId: data.organizationId || null,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          metadata: data.metadata,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      console.error('Audit log failed:', error);
    }
  }
}
