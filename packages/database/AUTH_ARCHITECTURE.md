# Multi-Tenant Authorization Foundation Architecture

## Overview

This document describes the enterprise-scale, domain-agnostic authorization foundation for multi-tenant SaaS applications. The foundation provides reusable identity, organization, role, permission, relationship, and authorization architecture that can be applied across different business domains (healthcare, education, finance, retail, etc.).

## Core Principles

1. **Domain Agnostic**: The foundation contains no business-specific logic
2. **Multi-Tenant**: Supports multiple organizations with proper isolation
3. **Role-Based Access Control (RBAC)**: Flexible role and permission system
4. **Resource-Aware**: Generic resource relationship system
5. **Scope-Based**: Permissions can apply globally, per-organization, or through relationships
6. **Audit-Ready**: Comprehensive audit logging
7. **Security-First**: Default deny, explicit allow, tenant isolation

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│              (Business Logic & Routes)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Authorization Service                        │
│              (Authorization Middleware)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Data Access Layer                           │
│              (Prisma ORM + PostgreSQL)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Database Layer                             │
│              (Tables + RLS + Constraints)                    │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Models

#### 1. Users & Authentication

**Users Table**
- Generic user model independent of business domain
- Links to authentication provider (e.g., Supabase Auth)
- Supports multiple organization memberships

```typescript
User {
  id: UUID
  authUserId: UUID          // Links to auth provider
  displayName: String?
  phone: String?
  status: ACTIVE | SUSPENDED | DISABLED
  profile: UserProfile?
  organizationMembers: OrganizationMember[]
  auditLogs: AuditLog[]
}
```

**User Profiles Table**
- Optional generic profile information
- Business-agnostic fields (avatar, bio, timezone, locale)

#### 2. Organizations

**Organizations Table**
- Supports multiple business types (Individual, Corporation, Partnership, Non-profit, etc.)
- Hierarchical structure (parent-child relationships)
- Multi-location support
- Contact and address information

```typescript
Organization {
  id: UUID
  name: String
  slug: String              // Unique identifier
  type: INDIVIDUAL | CORPORATION | PARTNERSHIP | ...
  status: ACTIVE | SUSPENDED | ARCHIVED
  legalName: String?
  taxId: String?
  parentId: UUID?           // For hierarchy
  parent: Organization?
  subsidiaries: Organization[]
  locations: OrganizationLocation[]
  members: OrganizationMember[]
  roles: Role[]
  resourceRelationships: ResourceRelationship[]
  auditLogs: AuditLog[]
}
```

**Organization Locations Table**
- Supports multiple physical/virtual locations
- Location types (Headquarters, Branch, Warehouse, Office, etc.)
- Geographic coordinates
- Contact information per location

#### 3. Organization Memberships

**Organization Members Table**
- Join table between users and organizations
- Users can belong to multiple organizations
- Membership status lifecycle

```typescript
OrganizationMember {
  id: UUID
  organizationId: UUID
  userId: UUID
  status: ACTIVE | INVITED | SUSPENDED | REMOVED
  organization: Organization
  user: User
  roles: OrganizationMemberRole[]
}
```

**Membership Status Flow**
```
INVITED → ACTIVE → SUSPENDED → REMOVED
          ↓         ↓
          └─────────┘
```

#### 4. Roles

**Roles Table**
- Two categories: System roles (global) and Organization roles
- System roles defined by platform, reusable across organizations
- Organization roles customizable per organization

```typescript
Role {
  id: UUID
  organizationId: UUID?     // NULL = system role
  name: String
  slug: String              // Unique per organization
  description: String?
  isSystem: Boolean
  organization: Organization?
  memberRoles: OrganizationMemberRole[]
  permissions: RolePermission[]
}
```

**System Roles** (organizationId = NULL)
- Platform Administrator
- Organization Owner
- Organization Administrator
- Organization Manager
- Organization Member
- Organization Viewer

**Organization Roles** (organizationId = specific org)
- Custom roles created by organizations
- Example: Manager, Staff, Accountant, Operator

#### 5. Role Assignments

**Organization Member Roles Table**
- Many-to-many relationship between members and roles
- Users can have different roles in different organizations

```typescript
OrganizationMemberRole {
  id: UUID
  organizationMemberId: UUID
  roleId: UUID
  organizationMember: OrganizationMember
  role: Role
}
```

#### 6. Permissions

**Permissions Table**
- Globally unique permission keys
- Namespace/action convention: `resource.action`
- Platform-wide permission catalog

```typescript
Permission {
  id: UUID
  key: String                // e.g., "organization.read"
  name: String
  description: String?
  roles: RolePermission[]
}
```

**Permission Examples**
```
organization.create
organization.read
organization.update
organization.delete
user.create
user.read
user.update
user.delete
membership.invite
membership.remove
role.create
role.assign
permission.assign
resource.create
resource.read
resource.update
resource.delete
```

#### 7. Role Permissions

**Role Permissions Table**
- Many-to-many relationship between roles and permissions
- Enables permission inheritance through roles

```typescript
RolePermission {
  id: UUID
  roleId: UUID
  permissionId: UUID
  role: Role
  permission: Permission
}
```

#### 8. Resource Relationships

**Resource Relationships Table**
- Generic relationship system between subjects and resources
- Polymorphic - works with any resource type
- Temporal support (startsAt, endsAt)
- Organization context for multi-tenant resources

```typescript
ResourceRelationship {
  id: UUID
  subjectType: String        // e.g., "User", "Organization"
  subjectId: UUID
  relationship: String      // e.g., "owner", "member", "manager"
  resourceType: String      // e.g., "Resource", "Project", "Document"
  resourceId: UUID
  organizationId: UUID?
  metadata: Json?
  startsAt: DateTime?
  endsAt: DateTime?
  organization: Organization?
}
```

**Relationship Examples**
```
User → OWNER → Resource
User → MEMBER → Project
Organization → MANAGER → Document
User → ASSIGNEE → Task
User → REVIEWER → Proposal
```

#### 9. Audit Logs

**Audit Logs Table**
- Comprehensive audit trail
- Records all authorization attempts
- Includes context (IP, user agent, metadata)

```typescript
AuditLog {
  id: UUID
  actorUserId: UUID?
  organizationId: UUID?
  action: String             // e.g., "authorization.granted", "user.created"
  resourceType: String?
  resourceId: UUID?
  metadata: Json?
  ipAddress: String?
  userAgent: String?
  actorUser: User?
  organization: Organization?
}
```

## Authorization Flow

### Decision Process

```
1. Authentication Check
   ↓ Is user authenticated?
   
2. User Validation
   ↓ Does user exist and is active?
   
3. Organization Validation (if context provided)
   ↓ Does organization exist and is active?
   ↓ Does user have active membership?
   
4. Permission Check
   ↓ What roles does user have?
   ↓ What permissions do those roles provide?
   ↓ Does user have requested permission?
   
5. Scope Evaluation
   ↓ What scope applies to the permission?
   ↓ GLOBAL | ORGANIZATION | RELATED | OWNED | ASSIGNED
   
6. Resource Relationship Check (if resource access)
   ↓ Does user have required relationship with resource?
   ↓ Is relationship currently valid (not expired)?
   
7. Authorization Decision
   ↓ ALLOW or DENY with detailed reason
```

### Example Authorization Request

```typescript
const request: AuthorizationRequest = {
  userId: 'user-123',
  permission: 'resource.update',
  resourceType: ResourceType.RESOURCE,
  resourceId: 'resource-456',
  organizationId: 'org-789',
  context: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    timestamp: new Date(),
  }
};

const result = await authorizationService.authorize(request);
```

### Authorization Result

```typescript
{
  authorized: true,
  reason: 'authorized',
  scope: 'RELATED',
  roles: ['organization_manager', 'project_manager'],
  permissions: ['resource.read', 'resource.update', 'resource.create']
}
```

## Permission Scopes

### Global Scope
- Platform-wide permissions
- Applies across all organizations
- Example: Platform administration

### Organization Scope
- Permissions within an organization context
- Does not grant access to other organizations
- Example: Organization management

### Related Scope
- Access through resource relationships
- Requires valid relationship with resource
- Example: Update projects you're assigned to

### Owned Scope
- Access to resources user owns
- Based on OWNER relationship
- Example: Manage your own documents

### Assigned Scope
- Access to resources assigned to user
- Based on ASSIGNEE relationship
- Example: Complete assigned tasks

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│  1. Frontend Validation                                      │
│     - UI disabled states                                     │
│     - Route guards                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  2. API Middleware                                          │
│     - Authentication check                                  │
│     - Authorization middleware                              │
│     - Request validation                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  3. Application Logic                                       │
│     - Authorization service calls                           │
│     - Business logic checks                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  4. Database RLS                                            │
│     - Row Level Security policies                           │
│     - Tenant isolation                                      │
│     - Helper functions                                      │
└─────────────────────────────────────────────────────────────┘
```

### Tenant Isolation

**Organization-Level Isolation**
- Users can only access their organization's data
- RLS policies filter by organization membership
- Cross-organization access explicitly denied

**Resource-Level Isolation**
- Resource relationships control access
- No implicit access based on user ID alone
- Relationships must be explicitly granted

### Security Guarantees

1. **Default Deny**: All access denied unless explicitly authorized
2. **Tenant Isolation**: Organization A cannot access Organization B data
3. **No Privilege Escalation**: Users cannot grant themselves elevated permissions
4. **Audit Trail**: All authorization attempts logged
5. **Temporal Relationships**: Relationships can expire
6. **Revocation**: Access can be revoked immediately

## Usage Examples

### Basic Authorization Check

```typescript
import { AuthorizationService, PermissionKey } from '@workspace/database';

const authService = new AuthorizationService(prisma);

// Check if user can read organization
const canRead = await authService.checkPermission(
  'user-123',
  'organization.read' as PermissionKey,
  'org-456'
);
```

### Resource Authorization

```typescript
// Check if user can update specific resource
const result = await authService.canAccessResource(
  'user-123',
  ResourceType.RESOURCE,
  'resource-789',
  'resource.update' as PermissionKey,
  'org-456'
);

if (result.authorized) {
  // Allow access
} else {
  // Deny with reason
  console.log('Access denied:', result.reason);
}
```

### Using Authorization Helper

```typescript
import { AuthorizationHelper } from '@workspace/database';

const helper = new AuthorizationHelper(authService);

// Assert user can perform action
await helper.assertCan(
  'user-123',
  'resource.delete' as PermissionKey,
  ResourceType.RESOURCE,
  'resource-789',
  'org-456'
); // Throws if not authorized

// Check if user has any of these permissions
const hasAny = await helper.hasAnyPermission(
  'user-123',
  ['resource.read', 'resource.update'] as PermissionKey[],
  'org-456'
);

// Get user's roles
const roles = await helper.getRoles('user-123', 'org-456');
```

### Middleware Usage

```typescript
import { createAuthorizationMiddleware } from '@workspace/database';

const authMiddleware = createAuthorizationMiddleware(authService);

// Express middleware
app.get('/organizations/:organizationId', 
  authMiddleware.authorize({
    permission: 'organization.read' as PermissionKey,
    organizationParam: 'organizationId',
  }),
  (req, res) => {
    // User is authorized
    res.json({ data: req.organization });
  }
);

// Next.js API route wrapper
export const GET = authMiddleware.withAuthorization(
  async (req) => {
    return Response.json({ data: req.resource });
  },
  {
    permission: 'resource.read' as PermissionKey,
    resourceType: ResourceType.RESOURCE,
    resourceParam: 'resourceId',
  }
);
```

### Organization Switching

```typescript
// Switch organization context
const success = await helper.switchOrganization('user-123', 'new-org-456');

if (success) {
  // User can now operate in new organization
  const permissions = await helper.getPermissions('user-123', 'new-org-456');
} else {
  // User doesn't have access to new organization
}
```

## Relationship Management

### Creating Resource Relationships

```typescript
// User becomes owner of a resource
await prisma.resourceRelationship.create({
  data: {
    subjectType: 'User',
    subjectId: 'user-123',
    relationship: 'owner',
    resourceType: 'Resource',
    resourceId: 'resource-789',
    organizationId: 'org-456',
  },
});

// User gets assigned to a project
await prisma.resourceRelationship.create({
  data: {
    subjectType: 'User',
    subjectId: 'user-123',
    relationship: 'assignee',
    resourceType: 'Project',
    resourceId: 'project-456',
    organizationId: 'org-456',
    startsAt: new Date(),
    endsAt: new Date('2024-12-31'),
  },
});
```

### Checking Relationships

```typescript
// Check if user is owner of resource
const isOwner = await authService.hasRelationship(
  'user-123',
  ResourceType.RESOURCE,
  'resource-789',
  RelationshipType.OWNER,
  'org-456'
);
```

## Caching Strategy

### Cache Configuration

```typescript
const authService = new AuthorizationService(prisma, {
  enabled: true,
  ttl: 300,              // 5 minutes
  maxSize: 1000,         // Maximum cache entries
  strategy: 'memory',    // Can be 'redis' for distributed systems
});
```

### Cache Management

```typescript
// Clear cache for specific user
await authService.clearCache('user-123');

// Clear cache for user in specific organization
await authService.clearCache('user-123', 'org-456');

// Warm cache for user
await authService.warmCache('user-123', 'org-456');
```

## Audit Logging

### Automatic Logging

All authorization attempts are automatically logged:

```typescript
{
  actorUserId: 'user-123',
  organizationId: 'org-456',
  action: 'authorization.denied',
  resourceType: 'Resource',
  resourceId: 'resource-789',
  metadata: {
    permission: 'resource.update',
    reason: 'insufficient_permissions',
    error: 'INSUFFICIENT_PERMISSIONS'
  },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  createdAt: '2024-01-15T10:30:00Z'
}
```

### Manual Audit Logging

```typescript
await prisma.auditLog.create({
  data: {
    actorUserId: 'user-123',
    organizationId: 'org-456',
    action: 'user.created',
    resourceType: 'User',
    resourceId: 'user-456',
    metadata: {
      displayName: 'New User',
      email: 'new@example.com',
    },
  },
});
```

## Organization Context

### Active Organization Pattern

Users can belong to multiple organizations. The application maintains an "active organization" context:

```typescript
// Set active organization in session
session.activeOrganizationId = 'org-456';

// Authorization checks automatically use active organization
const result = await authService.authorize({
  userId: 'user-123',
  permission: 'resource.read' as PermissionKey,
  organizationId: session.activeOrganizationId,
});
```

### Organization Validation

Every authorization check validates:
1. User has active membership in the organization
2. Membership is not suspended or removed
3. Organization is active and not suspended

## Testing

### Test Coverage

The foundation includes comprehensive tests for:

- Authentication scenarios
- Organization isolation
- Multiple organizations
- Role-based permissions
- Membership lifecycle
- Resource relationships
- Privilege escalation prevention
- Cross-organization access
- Cache management

### Running Tests

```typescript
// Run all authorization tests
npm test -- authorization.test.ts

// Run specific test suite
npm test -- authentication
```

## Seed Data

### Foundation Seed

Generic foundation seed data includes:

- System permissions (40+ permissions)
- System roles (6 standard roles)
- Role-permission assignments
- Example organization (development only)
- Example user (development only)

### Running Seed

```typescript
import { seedFoundation } from '@workspace/database/seed';

await seedFoundation();
```

## Integration with Future Domain Modules

### Adding Domain-Specific Resources

Future modules can add their own resource types without modifying the foundation:

```typescript
// Example: Real estate module adds property resources
await prisma.resourceRelationship.create({
  data: {
    subjectType: 'User',
    subjectId: 'user-123',
    relationship: 'property_manager',
    resourceType: 'Property',  // Custom resource type
    resourceId: 'property-789',
    organizationId: 'org-456',
  },
});
```

### Adding Domain-Specific Permissions

```typescript
// Example: Healthcare module adds patient permissions
await prisma.permission.create({
  data: {
    key: 'patient.read',
    name: 'View Patient Records',
    description: 'Access patient medical records',
  },
});
```

### Creating Domain-Specific Roles

```typescript
// Example: Education module creates teacher role
const teacherRole = await prisma.role.create({
  data: {
    organizationId: 'org-456',
    name: 'Teacher',
    slug: 'teacher',
    description: 'Teacher with classroom management permissions',
    isSystem: false,
  },
});
```

## Performance Considerations

### Database Indexes

All frequently queried fields are indexed:
- User IDs and status
- Organization IDs, slugs, and status
- Membership user and organization IDs
- Role organization ID and slug
- Permission keys
- Resource relationship subject and resource IDs

### Query Optimization

- Use specific field selections
- Implement proper pagination
- Leverage database-level filtering
- Cache frequently accessed authorization data

### Caching Strategy

- In-memory cache for small deployments
- Redis for distributed systems
- Cache invalidation on permission changes
- Warm cache for known users

## Security Best Practices

### Implementation Guidelines

1. **Never trust client-side authorization** - Always validate server-side
2. **Use the authorization service** - Don't implement custom authorization logic
3. **Log all authorization decisions** - Maintain audit trail
4. **Implement proper error handling** - Don't leak security information
5. **Regularly review permissions** - Ensure principle of least privilege
6. **Monitor for suspicious activity** - Alert on authorization failures
7. **Keep dependencies updated** - Security patches
8. **Use HTTPS** - Encrypt all authorization requests

### Common Pitfalls to Avoid

1. **Don't hardcode role checks** - Use permission-based authorization
2. **Don't skip authorization for "internal" APIs** - All endpoints need protection
3. **Don't rely solely on frontend validation** - Backend must enforce
4. **Don't use organization IDs from client without validation** - Always verify membership
5. **Don't grant broad permissions** - Use specific, scoped permissions
6. **Don't ignore audit logs** - Regular security review
7. **Don't disable RLS in production** - Database-level security is essential

## Migration Strategy

### From Legacy Systems

1. **Phase 1**: Deploy foundation alongside existing system
2. **Phase 2**: Migrate users and organizations
3. **Phase 3**: Implement authorization service in new features
4. **Phase 4**: Gradually migrate existing features
5. **Phase 5**: Remove legacy authorization logic

### Rollback Plan

- Keep database migrations reversible
- Maintain dual authorization during transition
- Extensive testing before cutover
- Monitoring for authorization failures

## Monitoring and Alerting

### Key Metrics

- Authorization success/failure rates
- Cache hit/miss ratios
- Response times for authorization checks
- Failed login attempts
- Privilege escalation attempts
- Cross-organization access attempts

### Alert Conditions

- High authorization failure rate
- Cache performance degradation
- Database connection issues
- Unusual permission grant patterns
- Multiple failed organization access attempts

## Conclusion

This authorization foundation provides a robust, enterprise-scale, domain-agnostic system for multi-tenant SaaS applications. It can be reused across different business domains without modification, while providing the flexibility to extend with domain-specific resources and permissions.

The foundation ensures security through defense-in-depth, proper tenant isolation, comprehensive audit logging, and a clear authorization decision process. Future domain modules can integrate seamlessly without modifying the core foundation architecture.

## Example Usage Scenario

### Generic Resource Management Example

```
Organization A (TechCorp)
    │
    └── User 1 (Alice)
           │
           ├── Role: Organization Manager
           │     │
           │     └── Permissions: 
           │           - resource.create
           │           - resource.update
           │           - resource.read
           │           - resource.list
           │
           └── Relationship: MANAGER
                 │
                 └── Resource 123 (Project Alpha)
                       │
                       └── Scope: RELATED

Authorization Request:
  User: Alice
  Permission: resource.update
  Resource: Project Alpha
  Organization: TechCorp

Authorization Decision:
  1. Alice is authenticated ✓
  2. Alice's user status is ACTIVE ✓
  3. TechCorp organization is ACTIVE ✓
  4. Alice has active membership in TechCorp ✓
  5. Alice has Organization Manager role ✓
  6. Organization Manager has resource.update permission ✓
  7. Permission scope is RELATED ✓
  8. Alice has MANAGER relationship with Project Alpha ✓
  9. Relationship is currently valid ✓
  
  Result: ALLOWED ✓
```

This example demonstrates the complete authorization flow using generic resources, showing how the foundation can be applied to any business domain without requiring real-estate or other domain-specific logic.
