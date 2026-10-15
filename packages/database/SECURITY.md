# Multi-Tenant Security Architecture

## Overview

This document describes the complete security architecture for the reusable multi-tenant authentication, authorization, and tenancy system. The architecture is domain-agnostic and can be used across any business vertical (CRM, property management, restaurant operations, etc.).

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│              (Business Logic & Routes)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Route Guards & Middleware                      │
│         (PermissionGuard, requirePermission)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Security Services Layer                         │
│  AuthenticationService | TenantService | AuthorizationService │
│                      | PolicyEngine                         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Cache Layer                                │
│              (AuthorizationCache)                            │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Data Access Layer                           │
│              (Prisma ORM + PostgreSQL)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Database Layer                             │
│              (Tables + Constraints)                          │
└─────────────────────────────────────────────────────────────┘
```

## Core Security Principles

### 1. Authentication Separation

Authentication answers: **Who is this user?**

- Separated from authorization logic
- Provider-independent via `AuthenticationProvider` interface
- No password/crypto logic in business code
- Supports Supabase, Clerk, Auth0, etc. via adapters

### 2. Explicit Tenancy

Tenancy answers: **Which organization/tenant is this request operating within?**

- Active organization must be explicit
- No silent tenant inference
- `TenantService` enforces tenant context
- User can belong to multiple organizations

### 3. Authorization

Authorization answers: **What is this authenticated user allowed to do within this tenant?**

- RBAC (Role-Based Access Control)
- Resource-level authorization via `PolicyEngine`
- Explicit permission scopes (GLOBAL, ORGANIZATION, RESOURCE, OWNED, ASSIGNED)
- Default deny, explicit allow

### 4. Tenant Isolation

**Critical Security Invariant**: A user authenticated into Tenant A must never be able to access, modify, delete, enumerate, aggregate, export, or infer protected data belonging to Tenant B.

- Organization-level isolation
- Resource ownership validation
- Cross-organization access explicitly denied
- Database-level scoping (RLS ready)

## Service Architecture

### AuthenticationService

**Purpose**: Provider-independent authentication abstraction

**Responsibilities**:
- Validate sessions/tokens via configured provider
- Resolve application user from external auth identity
- Validate user status (ACTIVE, SUSPENDED, DISABLED)
- Session lifecycle operations (revoke, refresh)

**Usage**:
```typescript
import { AuthenticationService, SupabaseAuthProvider } from '@workspace/database';

const provider = new SupabaseAuthProvider(supabaseClient);
const authService = new AuthenticationService(prisma, provider);

const identity = await authService.verifySession(sessionToken);
```

### TenantService

**Purpose**: Explicit tenant context management

**Responsibilities**:
- Require tenant context (throws if missing)
- Validate organization exists and is active
- Validate user has active membership
- Retrieve user's accessible organizations
- Switch organization context

**Usage**:
```typescript
import { TenantService } from '@workspace/database';

const tenantService = new TenantService(prisma);

// Require tenant context
tenantService.requireTenant(organizationId);

// Validate membership
await tenantService.validateMembership(userId, organizationId);

// Get user's organizations
const orgIds = await tenantService.getUserOrganizations(userId);
```

### AuthorizationService

**Purpose**: Core authorization engine

**Responsibilities**:
- Check permissions via roles
- Evaluate permission scopes
- Resource relationship validation
- Authorization decision with detailed reasoning
- Audit logging

**Usage**:
```typescript
import { AuthorizationService } from '@workspace/database';

const authService = new AuthorizationService(prisma);

const result = await authService.authorize({
  userId: 'user-123',
  permission: 'customers.read',
  organizationId: 'org-456',
  resourceType: 'Customer',
  resourceId: 'customer-789',
});
```

### PolicyEngine

**Purpose**: Resource-specific authorization policies

**Responsibilities**:
- Register domain-specific policies
- Evaluate resource-level authorization
- Support custom authorization logic per resource type

**Usage**:
```typescript
import { PolicyEngine } from '@workspace/database';

const policyEngine = new PolicyEngine();

// Register a policy
policyEngine.registerPolicy({
  resourceType: 'Customer',
  can: async (action, context, resource) => {
    if (action === 'update') {
      return resource.ownerId === context.userId;
    }
    return false;
  },
});

// Check authorization
const allowed = await policyEngine.can(
  'Customer',
  'update',
  authContext,
  customer
);
```

### AuthorizationCache

**Purpose**: Abstract cache layer for authorization data

**Implementations**:
- `MemoryAuthorizationCache`: In-memory cache (default)
- Redis cache (future implementation)

**Usage**:
```typescript
import { MemoryAuthorizationCache } from '@workspace/database';

const cache = new MemoryAuthorizationCache({
  enabled: true,
  ttl: 300, // 5 minutes
  maxSize: 1000,
});

await cache.set('user_permissions:user-123:org-456', permissions, 300);
const cached = await cache.get('user_permissions:user-123:org-456');
```

## Route-Level Protection

### PermissionGuard

Easy-to-use builder for protecting routes:

```typescript
import { createPermissionGuard } from '@workspace/database';

const guard = createPermissionGuard(authService, tenantService)
  .withContext(authContext)
  .requirePermission('customers.read')
  .requireOrganization();

await guard.check(); // Throws if not authorized
```

### Convenience Functions

```typescript
import { hasPermission, requirePermission, requireTenantMembership } from '@workspace/database';

// Check permission
const canRead = await hasPermission(authService, context, 'customers.read');

// Require permission (throws)
await requirePermission(authService, context, 'customers.update');

// Require tenant membership (throws)
await requireTenantMembership(tenantService, context);
```

## Database Schema

### Permission Scope

Permissions now have explicit scope in the database:

```prisma
model Permission {
  id          String   @id @default(uuid())
  key         String   @unique
  name        String
  description String?
  scope       String   @default("ORGANIZATION") // GLOBAL, ORGANIZATION, RESOURCE, OWNED, ASSIGNED
  createdAt   DateTime @default(now())
}
```

**Scopes**:
- `GLOBAL`: Platform-wide permissions (e.g., platform.admin)
- `ORGANIZATION`: Within organization context (e.g., organization.read)
- `RESOURCE`: Through resource relationships (e.g., customers.update)
- `OWNED`: Resources owned by user
- `ASSIGNED`: Resources assigned to user

### Critical Security Fix

**Fixed**: System roles are no longer automatically granted to all users.

**Before**: Every user received all global system roles automatically.
**After**: System roles must be explicitly assigned to users.

## Security Guarantees

### 1. Default Deny

All access denied unless explicitly authorized.

### 2. Tenant Isolation

Organization A cannot access Organization B data.

### 3. No Privilege Escalation

Users cannot grant themselves elevated permissions.

### 4. Audit Trail

All authorization attempts logged automatically.

### 5. Explicit Context

Tenant context must be explicit, never inferred.

### 6. Cache Safety

Authorization correctness never depends on cache availability.

## Error Handling

### Authentication Errors

- `UnauthenticatedError`: Authentication required
- `InvalidSessionError`: Session invalid or expired
- `AuthenticationProviderError`: Provider-specific error

### Tenancy Errors

- `TenantRequiredError`: Organization context required
- `TenantNotFoundError`: Organization not found
- `MembershipRequiredError`: User not a member
- `MembershipInactiveError`: Membership not active

### Authorization Errors

- `PermissionDeniedException`: Permission not granted
- `AuthorizationException`: Generic authorization error

## HTTP Semantics

- `401`: Unauthenticated
- `403`: Authenticated but forbidden
- `404`: Resource not found (don't leak tenant ownership)

## Usage Example: Protected Route

```typescript
import { 
  createPermissionGuard,
  requirePermission,
  requireTenantMembership
} from '@workspace/database';

export async function GET(request: Request) {
  // 1. Extract auth context from request
  const authContext = await getAuthContext(request);
  
  // 2. Require tenant membership
  await requireTenantMembership(tenantService, authContext);
  
  // 3. Require permission
  await requirePermission(authService, authContext, 'customers.read');
  
  // 4. Proceed with business logic
  const customers = await customerService.list(authContext.organizationId);
  
  return Response.json({ customers });
}
```

## Permission Persistence Strategy

### Session-Based Caching

Permissions and auth context are persisted across requests using `SessionAuthorizationCache` to avoid repeated database queries:

**How it works**:
1. First request: Load permissions from database, cache in session
2. Subsequent requests: Load from session cache (no DB query)
3. Session expires after TTL (default 5 minutes)
4. Cache invalidated on permission/role changes

**Cache Layers**:
- **Session Cache**: Persists auth context + permissions + roles (per user/org)
- **Authorization Cache**: Persists authorization decisions (per request)
- **Memory Cache**: Fallback for general caching

### Server-Side Usage

**API Routes**:
```typescript
import { createAuthApiRoutes, protectRoute } from '@workspace/database';

const authRoutes = createAuthApiRoutes({
  authService,
  tenantService,
});

// GET /api/auth/session - Returns cached permissions
export async function GET(request: NextRequest) {
  return authRoutes.getSession(request);
}

// Protected route with permission check
export async function GET(request: NextRequest) {
  const authContext = await protectRoute({
    authService,
    tenantService,
    requiredPermissions: ['customers.read'],
  })(request);

  // Proceed with business logic
}
```

**Server Components**:
```typescript
import { getServerAuthContext, getServerPermissions } from '@workspace/database';

export default async function DashboardPage() {
  const auth = getServerAuthContext();
  const permissions = getServerPermissions();

  if (!permissions.includes('customers.read')) {
    return <div>Access denied</div>;
  }

  return <Dashboard />;
}
```

### Client-Side Usage

**API Integration**:
```typescript
// Fetch from API route (uses session cache on server)
const response = await fetch('/api/auth/session', {
  credentials: 'include',
});
const { permissions, roles } = await response.json();
```

**Middleware Injection**:
```typescript
// middleware.ts
import { createAuthMiddleware } from '@workspace/database';

export const authMiddleware = createAuthMiddleware({
  authService,
  sessionCache,
});

export default authMiddleware;
```

Middleware injects auth context into headers:
- `x-user-id`: User ID
- `x-auth-user-id`: Auth provider user ID
- `x-organization-id`: Active organization ID
- `x-permissions`: Cached permissions (JSON)
- `x-roles`: Cached roles (JSON)

### Cache Invalidation

Cache is invalidated when:
- Role assigned/removed
- Permission changed
- Membership suspended/removed
- Organization suspended
- User disabled
- Role permissions changed
- Organization switched

**Manual Invalidation**:
```typescript
// Invalidate user's all sessions
await sessionCache.invalidateUser(userId);

// Invalidate specific organization session
await sessionCache.invalidateOrganization(userId, organizationId);
```

High-risk permissions should have:
- Immediate invalidation
- Very short TTL
- Or no cache

## Testing Requirements

### Critical Tests

1. **Cross-tenant data leakage**: User A cannot access User B's data
2. **IDOR prevention**: UUIDs are not authorization
3. **System role isolation**: System roles not auto-granted
4. **Membership enforcement**: Suspended users denied access
5. **Permission scope**: Explicit scope, not inferred from strings

### Test Example

```typescript
test('user cannot access another tenant data', async () => {
  const userA = await createUser();
  const orgA = await createOrganization();
  const orgB = await createOrganization();
  
  await addMember(userA.id, orgA.id);
  
  const result = await authService.authorize({
    userId: userA.id,
    permission: 'customers.read',
    organizationId: orgB.id, // Wrong org
  });
  
  expect(result.authorized).toBe(false);
});
```

## Migration Notes

### Database Changes

1. Added `scope` field to `Permission` table
2. Default value: "ORGANIZATION"
3. Existing permissions need scope migration

### Code Changes

1. Removed automatic system role assignment
2. Changed permission scope from string inference to database lookup
3. Added new security services (Authentication, Tenant, Policy, Cache)

## Best Practices

### For Application Developers

1. **Always use the security layer** - Don't implement custom authorization
2. **Explicit tenant context** - Never infer from arbitrary resources
3. **Use permission guards** - Simplify route protection
4. **Log sensitive actions** - Use audit logging
5. **Test cross-tenant access** - Verify isolation

### For Security Engineers

1. **Review permission assignments** - Principle of least privilege
2. **Monitor authorization failures** - Alert on suspicious patterns
3. **Regular security audits** - Review role/permission changes
4. **Keep dependencies updated** - Security patches
5. **Use HTTPS** - Encrypt all authorization requests

## Future Enhancements

1. **Redis Cache**: Distributed caching for production
2. **Row-Level Security**: PostgreSQL RLS policies
3. **ABAC Support**: Attribute-based access control
4. **Rate Limiting**: Per-tenant rate limiting
5. **MFA Integration**: Multi-factor authentication

## Support

For questions or issues:
1. Review this documentation
2. Check test files for examples
3. Review AUTH_ARCHITECTURE.md for detailed architecture
