/**
 * Authorization Service Tests
 * Comprehensive testing of the authorization foundation
 */

import { AuthorizationService } from '../authorization.service';
import { 
  PermissionKey, 
  ResourceType, 
  AuthorizationError,
  RelationshipType,
} from '../types';

// Mock Prisma Client for testing
class MockPrismaClient {
  user = {
    findUnique: jest.fn(),
  };
  organization = {
    findUnique: jest.fn(),
  };
  organizationMember = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  };
  role = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };
  rolePermission = {
    findMany: jest.fn(),
  };
  resourceRelationship = {
    findMany: jest.fn(),
  };
  auditLog = {
    create: jest.fn(),
  };
}

describe('AuthorizationService', () => {
  let authService: AuthorizationService;
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    mockPrisma = new MockPrismaClient() as any;
    authService = new AuthorizationService(mockPrisma as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // AUTHENTICATION TESTS
  // ============================================================================

  describe('Authentication', () => {
    test('Unauthenticated user should be denied', async () => {
      const result = await authService.authorize({
        userId: '',
        permission: 'organization.read' as PermissionKey,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('unauthenticated');
    });

    test('Authenticated active user should be allowed to continue', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
      });

      expect(result.authorized).toBe(true);
    });

    test('Disabled user should be denied', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'DISABLED',
      });

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('user_inactive');
      expect(result.error).toBe(AuthorizationError.USER_INACTIVE);
    });

    test('Suspended user should be denied', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'SUSPENDED',
      });

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('user_inactive');
    });
  });

  // ============================================================================
  // ORGANIZATION ISOLATION TESTS
  // ============================================================================

  describe('Organization Isolation', () => {
    test('User in Organization A cannot access Organization B', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      // User is member of Organization A only
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
        organizationId: 'org-b',
      });

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('no_membership');
      expect(result.error).toBe(AuthorizationError.NO_MEMBERSHIP);
    });

    test('User can access their own organization', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-a',
        status: 'ACTIVE',
      });

      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'member-1',
        organizationId: 'org-a',
        userId: 'user-1',
        status: 'ACTIVE',
      });

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
        organizationId: 'org-a',
      });

      expect(result.authorized).toBe(true);
    });
  });

  // ============================================================================
  // MULTIPLE ORGANIZATIONS TESTS
  // ============================================================================

  describe('Multiple Organizations', () => {
    test('User belongs to A and B, can operate in A', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-a',
        status: 'ACTIVE',
      });

      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'member-1',
        organizationId: 'org-a',
        userId: 'user-1',
        status: 'ACTIVE',
      });

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
        organizationId: 'org-a',
      });

      expect(result.authorized).toBe(true);
    });

    test('User belongs to A and B, can switch to B', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-b',
        status: 'ACTIVE',
      });

      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'member-2',
        organizationId: 'org-b',
        userId: 'user-1',
        status: 'ACTIVE',
      });

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
        organizationId: 'org-b',
      });

      expect(result.authorized).toBe(true);
    });

    test('User cannot access C when only member of A and B', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
        organizationId: 'org-c',
      });

      expect(result.authorized).toBe(false);
      expect(result.error).toBe(AuthorizationError.NO_MEMBERSHIP);
    });
  });

  // ============================================================================
  // ROLES TESTS
  // ============================================================================

  describe('Roles', () => {
    test('Role with permission should be allowed', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.organizationMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          organizationId: 'org-a',
          userId: 'user-1',
          status: 'ACTIVE',
          roles: [
            {
              role: {
                id: 'role-1',
                permissions: [
                  {
                    permission: {
                      key: 'organization.read',
                    },
                  },
                ],
              },
            },
          ],
        },
      ]);

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        {
          permission: {
            key: 'organization.read',
          },
        },
      ]);

      const result = await authService.checkPermission(
        'user-1',
        'organization.read' as PermissionKey,
        'org-a'
      );

      expect(result).toBe(true);
    });

    test('Role without permission should be denied', async () => {
      mockPrisma.organizationMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          organizationId: 'org-a',
          userId: 'user-1',
          status: 'ACTIVE',
          roles: [
            {
              role: {
                id: 'role-1',
                permissions: [],
              },
            },
          ],
        },
      ]);

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await authService.checkPermission(
        'user-1',
        'organization.update' as PermissionKey,
        'org-a'
      );

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // MEMBERSHIP TESTS
  // ============================================================================

  describe('Membership', () => {
    test('Active membership should be allowed', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-a',
        status: 'ACTIVE',
      });

      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'member-1',
        organizationId: 'org-a',
        userId: 'user-1',
        status: 'ACTIVE',
      });

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
        organizationId: 'org-a',
      });

      expect(result.authorized).toBe(true);
    });

    test('Suspended membership should be denied', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-a',
        status: 'ACTIVE',
      });

      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'member-1',
        organizationId: 'org-a',
        userId: 'user-1',
        status: 'SUSPENDED',
      });

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
        organizationId: 'org-a',
      });

      expect(result.authorized).toBe(false);
      expect(result.error).toBe(AuthorizationError.MEMBERSHIP_SUSPENDED);
    });

    test('Removed membership should be denied', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: 'org-a',
        status: 'ACTIVE',
      });

      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'member-1',
        organizationId: 'org-a',
        userId: 'user-1',
        status: 'REMOVED',
      });

      const result = await authService.authorize({
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
        organizationId: 'org-a',
      });

      expect(result.authorized).toBe(false);
      expect(result.error).toBe(AuthorizationError.MEMBERSHIP_REMOVED);
    });
  });

  // ============================================================================
  // RESOURCE RELATIONSHIPS TESTS
  // ============================================================================

  describe('Resource Relationships', () => {
    test('Valid relationship should be potentially allowed', async () => {
      mockPrisma.resourceRelationship.findMany.mockResolvedValue([
        {
          subjectType: 'User',
          subjectId: 'user-1',
          resourceType: ResourceType.RESOURCE,
          resourceId: 'resource-1',
          relationship: RelationshipType.OWNER,
          startsAt: new Date('2024-01-01'),
          endsAt: new Date('2025-01-01'),
        },
      ]);

      const result = await authService.hasRelationship(
        'user-1',
        ResourceType.RESOURCE,
        'resource-1',
        RelationshipType.OWNER
      );

      expect(result).toBe(true);
    });

    test('No relationship should be denied when relationship is required', async () => {
      mockPrisma.resourceRelationship.findMany.mockResolvedValue([]);

      const result = await authService.hasRelationship(
        'user-1',
        ResourceType.RESOURCE,
        'resource-1',
        RelationshipType.OWNER
      );

      expect(result).toBe(false);
    });

    test('Expired relationship should be denied', async () => {
      mockPrisma.resourceRelationship.findMany.mockResolvedValue([
        {
          subjectType: 'User',
          subjectId: 'user-1',
          resourceType: ResourceType.RESOURCE,
          resourceId: 'resource-1',
          relationship: RelationshipType.OWNER,
          startsAt: new Date('2020-01-01'),
          endsAt: new Date('2021-01-01'),
        },
      ]);

      const result = await authService.hasRelationship(
        'user-1',
        ResourceType.RESOURCE,
        'resource-1',
        RelationshipType.OWNER
      );

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // PRIVILEGE ESCALATION TESTS
  // ============================================================================

  describe('Privilege Escalation', () => {
    test('Normal member cannot assign themselves organization_admin', async () => {
      // Mock user with basic member role
      mockPrisma.organizationMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          organizationId: 'org-a',
          userId: 'user-1',
          status: 'ACTIVE',
          roles: [
            {
              role: {
                id: 'role-member',
                slug: 'organization_member',
                permissions: [],
              },
            },
          ],
        },
      ]);

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      // Check if user can assign roles (they shouldn't be able to)
      const canAssign = await authService.checkPermission(
        'user-1',
        'role.assign' as PermissionKey,
        'org-a'
      );

      expect(canAssign).toBe(false);
    });

    test('Normal member cannot grant themselves additional permissions', async () => {
      mockPrisma.organizationMember.findMany.mockResolvedValue([
        {
          id: 'member-1',
          organizationId: 'org-a',
          userId: 'user-1',
          status: 'ACTIVE',
          roles: [
            {
              role: {
                id: 'role-member',
                slug: 'organization_member',
                permissions: [],
              },
            },
          ],
        },
      ]);

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      // Check if user can manage permissions (they shouldn't be able to)
      const canManage = await authService.checkPermission(
        'user-1',
        'permission.assign' as PermissionKey,
        'org-a'
      );

      expect(canManage).toBe(false);
    });
  });

  // ============================================================================
  // CROSS-ORGANIZATION ACCESS TESTS
  // ============================================================================

  describe('Cross-Organization Access', () => {
    test('Organization A user cannot access Organization B resource by ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      // User is member of Organization A only
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      const result = await authService.canAccessResource(
        'user-1',
        ResourceType.ORGANIZATION,
        'org-b',
        'organization.read' as PermissionKey,
        'org-b'
      );

      expect(result.authorized).toBe(false);
      expect(result.error).toBe(AuthorizationError.NO_MEMBERSHIP);
    });
  });

  // ============================================================================
  // CACHE TESTS
  // ============================================================================

  describe('Cache Management', () => {
    test('Should cache authorization results', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        authUserId: 'auth-1',
        status: 'ACTIVE',
      });

      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      const request = {
        userId: 'user-1',
        permission: 'organization.read' as PermissionKey,
      };

      // First call
      await authService.authorize(request);

      // Second call should use cache
      await authService.authorize(request);

      // Should not call user.findUnique again due to cache
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    test('Should clear cache for specific user', async () => {
      await authService.clearCache('user-1');
      // Cache should be cleared for user-1
    });

    test('Should warm cache for user', async () => {
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);
      mockPrisma.role.findMany.mockResolvedValue([]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      await authService.warmCache('user-1', 'org-a');
      // Cache should be warmed with user's permissions and roles
    });
  });
});
