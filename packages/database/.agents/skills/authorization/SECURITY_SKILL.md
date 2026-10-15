# Multi-Tenant Authorization Security Skill

**MANDATORY** for all development involving routes, pages, components, or API endpoints in applications using the `@workspace/database` package.

## When to Use This Skill

**ALWAYS invoke this skill when**:
- Creating or modifying any API route (Next.js API routes, Express routes)
- Creating or modifying any page (Next.js pages, app router pages)
- Creating or modifying any component that displays protected data
- Creating or modifying any server action or mutation
- Adding new features that require access control
- Modifying existing authorization logic

## Core Security Principles

### 1. Default Deny
All access is denied by default. Explicit permission is required for any action.

### 2. Explicit Tenancy
Tenant context (organization) must always be explicit. Never infer from arbitrary data.

### 3. Server-Side Authorization
Authorization MUST happen on the server. Client-side checks are UX only, never security.

### 4. Permission Persistence
Use session caching to avoid repeated database queries for permission checks.

## Authorization Patterns

### API Routes (Next.js App Router)

**Pattern 1: Using protectRoute helper**
```typescript
import { protectRoute } from '@workspace/database';
import { authService, tenantService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Protect route with permission check
  const authContext = await protectRoute({
    authService,
    tenantService,
    requiredPermissions: ['customers.read'],
    requireOrganization: true,
  })(request);

  // Proceed with business logic
  const customers = await customerService.list(authContext.organizationId);
  return Response.json({ customers });
}
```

**Pattern 2: Using PermissionGuard**
```typescript
import { createPermissionGuard } from '@workspace/database';
import { authService, tenantService } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  
  const guard = createPermissionGuard(authService, tenantService)
    .withContext(authContext)
    .requirePermission('customers.create')
    .requireOrganization();
  
  await guard.assert(); // Throws if not authorized
  
  // Proceed with business logic
}
```

### Server Components

**Pattern: Using server helpers**
```typescript
import { getServerAuthContext, getServerPermissions } from '@workspace/database';

export default async function DashboardPage() {
  const auth = getServerAuthContext();
  const permissions = getServerPermissions();
  
  // Check permission before rendering
  if (!permissions.includes('customers.read')) {
    return <div>Access denied</div>;
  }
  
  return <DashboardContent />;
}
```

### Server Actions

**Pattern: Permission check in action**
```typescript
'use server';

import { authService, tenantService } from '@/lib/auth';
import { PermissionDeniedException } from '@workspace/database';

export async function createCustomer(data: CustomerData) {
  const authContext = await getAuthContext();
  
  const hasPermission = await authService.checkPermission(
    authContext.userId,
    'customers.create',
    authContext.organizationId
  );
  
  if (!hasPermission) {
    throw new PermissionDeniedException('customers.create');
  }
  
  // Proceed with business logic
}
```

### Middleware Integration

**Pattern: Auth middleware**
```typescript
// middleware.ts
import { createAuthMiddleware } from '@workspace/database';
import { authService, sessionCache } from '@/lib/auth';

export default createAuthMiddleware({
  authService,
  sessionCache,
  protectedPaths: ['/dashboard', '/settings', '/admin'],
  publicPaths: ['/login', '/register', '/api/auth/login'],
});
```

## Permission Keys

Permission keys follow the pattern: `resource.action`

**Common patterns**:
- `customers.read` - View customers
- `customers.create` - Create customers
- `customers.update` - Update customers
- `customers.delete` - Delete customers
- `organization.read` - View organization details
- `organization.update` - Update organization settings
- `users.manage` - Manage users
- `roles.manage` - Manage roles and permissions

**When adding new features**:
1. Define permission keys in seed data
2. Assign to appropriate roles
3. Use in route guards
4. Document in feature spec

## Tenant Context

**Always require tenant context for organization-scoped operations**:
```typescript
// Require organization context
await protectRoute({
  authService,
  tenantService,
  requireOrganization: true,
})(request);

// Access organization ID
const organizationId = authContext.organizationId;
```

**Never infer organization from**:
- URL parameters (unless validated)
- Request body
- User's default organization
- Arbitrary resources

## Client-Side UX

**Client-side checks are for UX only, never security**:

```typescript
'use client';

import { useAuth } from '@/hooks/use-auth';

export function CustomerList() {
  const { hasPermission } = useAuth();
  
  // This is UX only - server must also check
  if (!hasPermission('customers.create')) {
    return null; // Hide button
  }
  
  return <CreateCustomerButton />;
}
```

**Always pair with server-side authorization**:
```typescript
// Server component or API route must also check
const hasPermission = await authService.checkPermission(
  userId,
  'customers.create',
  organizationId
);
```

## Common Mistakes to Avoid

### ❌ WRONG: Client-only authorization
```typescript
export async function POST(request: Request) {
  const { userId } = await request.json();
  // No server-side permission check!
  await createCustomer(data);
}
```

### ✅ RIGHT: Server-side authorization
```typescript
export async function POST(request: Request) {
  const authContext = await getAuthContext(request);
  await protectRoute({
    authService,
    tenantService,
    requiredPermissions: ['customers.create'],
  })(request);
  await createCustomer(data, authContext.organizationId);
}
```

### ❌ WRONG: Inferred tenant context
```typescript
export async function GET(request: Request) {
  const { customerId } = request.params;
  const customer = await getCustomer(customerId);
  const organizationId = customer.organizationId; // Inferred!
  // ...
}
```

### ✅ RIGHT: Explicit tenant context
```typescript
export async function GET(request: Request) {
  const authContext = await getAuthContext(request);
  if (!authContext.organizationId) {
    throw new TenantRequiredError();
  }
  const customers = await getCustomers(authContext.organizationId);
}
```

### ❌ WRONG: No permission check
```typescript
export async function DELETE(request: Request) {
  const { customerId } = request.params;
  await deleteCustomer(customerId); // No check!
}
```

### ✅ RIGHT: Permission check
```typescript
export async function DELETE(request: Request) {
  const authContext = await getAuthContext(request);
  await protectRoute({
    authService,
    tenantService,
    requiredPermissions: ['customers.delete'],
  })(request);
  await deleteCustomer(customerId, authContext.organizationId);
}
```

## Testing Authorization

**Always test authorization boundaries**:

```typescript
test('user without permission cannot access resource', async () => {
  const user = await createUser();
  const org = await createOrganization();
  await addMember(user.id, org.id, ['viewer']); // No create permission
  
  const response = await fetch('/api/customers', {
    method: 'POST',
    headers: { 'x-user-id': user.id, 'x-organization-id': org.id },
  });
  
  expect(response.status).toBe(403);
});

test('user cannot access another organization', async () => {
  const user = await createUser();
  const orgA = await createOrganization();
  const orgB = await createOrganization();
  await addMember(user.id, orgA.id, ['admin']);
  
  const response = await fetch(`/api/customers/${orgB.id}`, {
    headers: { 'x-user-id': user.id, 'x-organization-id': orgA.id },
  });
  
  expect(response.status).toBe(404); // Don't leak existence
});
```

## Security Checklist

Before committing any code that involves data access:

- [ ] Server-side authorization check present
- [ ] Permission key defined in seed data
- [ ] Tenant context explicit (if organization-scoped)
- [ ] Client-side checks paired with server checks
- [ ] Cross-tenant access prevented
- [ ] Authorization tests written
- [ ] Error handling doesn't leak sensitive info
- [ ] Audit logging for sensitive operations

## Integration Steps

When integrating `@workspace/database` into a new app:

1. **Install package**: `pnpm add @workspace/database`
2. **Configure services**: Create `lib/auth.ts` with service instances
3. **Add middleware**: Configure auth middleware in `middleware.ts`
4. **Create API routes**: Add `/api/auth/session`, `/api/auth/switch-organization`
5. **Protect routes**: Use `protectRoute` or `PermissionGuard`
6. **Add auth context**: Use `getServerAuthContext` in server components
7. **Test authorization**: Write tests for all protected endpoints

## Emergency Procedures

**If authorization bypass is discovered**:
1. Immediately revoke affected sessions
2. Invalidate cache: `await sessionCache.invalidateUser(userId)`
3. Review audit logs for unauthorized access
4. Patch the vulnerability
5. Add regression tests
6. Notify security team

## Support

For authorization questions:
1. Review this skill documentation
2. Check `SECURITY.md` in `@workspace/database`
3. Review `AUTH_ARCHITECTURE.md` for detailed architecture
4. Check existing protected routes for patterns
