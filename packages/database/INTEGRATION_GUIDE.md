# @workspace/database Integration Guide

This guide explains how to integrate the multi-tenant authorization system into your Next.js application.

## Prerequisites

- Next.js 15+ application
- PostgreSQL database
- Prisma configured
- Authentication provider (Supabase, Clerk, Auth0, etc.)

## Installation

```bash
pnpm add @workspace/database
```

## Step 1: Configure Database

### 1.1 Run Database Setup

```bash
# Push schema to database
pnpm --filter @workspace/database db:push

# Generate Prisma client
pnpm --filter @workspace/database db:generate

# Seed initial data
pnpm --filter @workspace/database db:seed
```

### 1.2 Configure Environment Variables

Add to your `.env` file:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

## Step 2: Create Auth Configuration

Create `lib/auth.ts` in your app:

```typescript
import { 
  AuthorizationService, 
  TenantService, 
  AuthenticationService,
  SessionAuthorizationCache 
} from '@workspace/database';
import { prisma } from '@workspace/database';
import { SupabaseAuthProvider } from './auth-providers/supabase';

// Initialize services
const sessionCache = new SessionAuthorizationCache({
  enabled: true,
  ttl: 300, // 5 minutes
});

const authProvider = new SupabaseAuthProvider(supabaseClient);

export const authService = new AuthenticationService(prisma, authProvider);
export const tenantService = new TenantService(prisma);
export const authorizationService = new AuthorizationService(
  prisma,
  { enabled: true, ttl: 300 },
  sessionCache
);
export { sessionCache };
```

## Step 3: Create Authentication Provider Adapter

Create `lib/auth-providers/supabase.ts`:

```typescript
import { AuthenticationProvider, AuthenticatedIdentity } from '@workspace/database';
import { createClient } from '@supabase/supabase-js';

export class SupabaseAuthProvider implements AuthenticationProvider {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  async verifySession(token: string): Promise<AuthenticatedIdentity> {
    const { data: { user }, error } = await this.supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new Error('Invalid session');
    }

    // Map Supabase user to application user
    const appUser = await prisma.user.findUnique({
      where: { authUserId: user.id },
    });

    if (!appUser) {
      throw new Error('User not found');
    }

    return {
      userId: appUser.id,
      authUserId: user.id,
      email: user.email,
      metadata: user.user_metadata,
    };
  }

  async getIdentity(authUserId: string): Promise<AuthenticatedIdentity> {
    const user = await prisma.user.findUnique({
      where: { authUserId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      userId: user.id,
      authUserId: user.authUserId,
      email: user.email,
    };
  }
}
```

## Step 4: Configure Middleware

Create or update `middleware.ts`:

```typescript
import { createAuthMiddleware } from '@workspace/database';
import { authService, sessionCache } from '@/lib/auth';

export default createAuthMiddleware({
  authService,
  sessionCache,
  protectedPaths: ['/dashboard', '/settings', '/admin'],
  publicPaths: ['/login', '/register', '/api/auth/login'],
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
```

## Step 5: Create Auth API Routes

Create `app/api/auth/session/route.ts`:

```typescript
import { createAuthApiRoutes } from '@workspace/database';
import { authService, tenantService } from '@/lib/auth';

const authRoutes = createAuthApiRoutes({
  authService,
  tenantService,
});

export async function GET(request: Request) {
  return authRoutes.getSession(request as any);
}
```

Create `app/api/auth/switch-organization/route.ts`:

```typescript
import { createAuthApiRoutes } from '@workspace/database';
import { authService, tenantService } from '@/lib/auth';

const authRoutes = createAuthApiRoutes({
  authService,
  tenantService,
});

export async function POST(request: Request) {
  return authRoutes.switchOrganization(request as any);
}
```

## Step 6: Protect API Routes

### Pattern 1: Using protectRoute

```typescript
import { protectRoute } from '@workspace/database';
import { authService, tenantService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authContext = await protectRoute({
    authService,
    tenantService,
    requiredPermissions: ['customers.read'],
    requireOrganization: true,
  })(request);

  const customers = await customerService.list(authContext.organizationId);
  return Response.json({ customers });
}
```

### Pattern 2: Using PermissionGuard

```typescript
import { createPermissionGuard } from '@workspace/database';
import { authService, tenantService } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  
  const guard = createPermissionGuard(authService, tenantService)
    .withContext(authContext)
    .requirePermission('customers.create')
    .requireOrganization();
  
  await guard.assert();
  
  // Proceed with business logic
}
```

## Step 7: Protect Server Components

```typescript
import { getServerAuthContext, getServerPermissions } from '@workspace/database';

export default async function DashboardPage() {
  const auth = getServerAuthContext();
  const permissions = getServerPermissions();
  
  if (!permissions.includes('customers.read')) {
    return <div>Access denied</div>;
  }
  
  return <DashboardContent />;
}
```

## Step 8: Create Client-Side Auth Hook

Create `hooks/use-auth.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPermissions() {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        const data = await response.json();
        setPermissions(data.permissions || []);
      } catch (error) {
        console.error('Failed to load permissions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPermissions();
  }, []);

  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };

  return { permissions, hasPermission, isLoading };
}
```

## Step 9: Use in Client Components

```typescript
'use client';

import { useAuth } from '@/hooks/use-auth';

export function CustomerList() {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  if (!hasPermission('customers.create')) {
    return null; // Hide button
  }

  return <CreateCustomerButton />;
}
```

## Step 10: Define Permissions

Add permissions to your seed data:

```typescript
// seed/permissions.ts
const permissions = [
  { key: 'customers.read', name: 'View Customers', scope: 'ORGANIZATION' },
  { key: 'customers.create', name: 'Create Customers', scope: 'ORGANIZATION' },
  { key: 'customers.update', name: 'Update Customers', scope: 'ORGANIZATION' },
  { key: 'customers.delete', name: 'Delete Customers', scope: 'ORGANIZATION' },
  { key: 'organization.manage', name: 'Manage Organization', scope: 'ORGANIZATION' },
  { key: 'users.manage', name: 'Manage Users', scope: 'ORGANIZATION' },
];
```

## Step 11: Assign Roles

```typescript
// seed/roles.ts
const roles = [
  {
    name: 'Admin',
    slug: 'admin',
    permissions: ['customers.*', 'organization.manage', 'users.manage'],
  },
  {
    name: 'Editor',
    slug: 'editor',
    permissions: ['customers.read', 'customers.create', 'customers.update'],
  },
  {
    name: 'Viewer',
    slug: 'viewer',
    permissions: ['customers.read'],
  },
];
```

## Testing Authorization

### Test API Route Protection

```typescript
describe('Customer API', () => {
  it('should deny access without permission', async () => {
    const response = await fetch('/api/customers', {
      headers: {
        'x-user-id': 'user-id',
        'x-organization-id': 'org-id',
      },
    });
    expect(response.status).toBe(403);
  });

  it('should allow access with permission', async () => {
    const response = await fetch('/api/customers', {
      headers: {
        'x-user-id': 'admin-user-id',
        'x-organization-id': 'org-id',
      },
    });
    expect(response.status).toBe(200);
  });
});
```

### Test Cross-Tenant Isolation

```typescript
it('should prevent cross-tenant access', async () => {
  const userA = await createUser();
  const orgA = await createOrganization();
  const orgB = await createOrganization();
  
  await addMember(userA.id, orgA.id, ['admin']);
  
  const response = await fetch(`/api/customers/${orgB.id}`, {
    headers: {
      'x-user-id': userA.id,
      'x-organization-id': orgA.id,
    },
  });
  
  expect(response.status).toBe(404); // Don't leak existence
});
```

## Common Patterns

### Conditional Rendering Based on Permissions

```typescript
export function SettingsPage() {
  const { hasPermission } = useAuth();
  
  return (
    <div>
      {hasPermission('organization.manage') && (
        <OrganizationSettings />
      )}
      {hasPermission('users.manage') && (
        <UserManagement />
      )}
    </div>
  );
}
```

### Organization Switching

```typescript
export function OrganizationSwitcher() {
  const [organizations, setOrganizations] = useState([]);

  const switchOrg = async (orgId: string) => {
    await fetch('/api/auth/switch-organization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId }),
    });
    window.location.reload();
  };

  return (
    <select onChange={(e) => switchOrg(e.target.value)}>
      {organizations.map(org => (
        <option key={org.id} value={org.id}>{org.name}</option>
      ))}
    </select>
  );
}
```

## Troubleshooting

### Permission Not Working

1. Check permission is defined in seed data
2. Check role has the permission assigned
3. Check user has the role assigned
4. Check membership is active
5. Check organization context is set

### Session Cache Issues

1. Clear cache: `await sessionCache.invalidateUser(userId)`
2. Check TTL is appropriate
3. Verify cache is enabled
4. Check for permission changes requiring invalidation

### Middleware Not Working

1. Check middleware is in root directory
2. Verify matcher pattern includes your routes
3. Check auth provider is configured correctly
4. Verify session cookie is being set

## Security Best Practices

1. **Always use server-side authorization** - Client-side checks are UX only
2. **Never infer tenant context** - Always require explicit organization ID
3. **Use permission persistence** - Leverage session cache to avoid DB queries
4. **Test cross-tenant access** - Verify isolation between organizations
5. **Log authorization failures** - Monitor for suspicious activity
6. **Invalidate cache on changes** - Clear cache when roles/permissions change

## Next Steps

1. Review the [Security Documentation](./SECURITY.md)
2. Read the [Authorization Skill](./.agents/skills/authorization/SECURITY_SKILL.md)
3. Check the [Architecture Documentation](./AUTH_ARCHITECTURE.md)
4. Implement your first protected route
5. Write tests for authorization boundaries

## Support

For issues or questions:
1. Check this integration guide
2. Review security documentation
3. Check the authorization skill
4. Review existing protected routes for patterns
