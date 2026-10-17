/**
 * Authentication and Authorization Setup
 * Initializes database services for the web app
 */

import { cookies } from 'next/headers';
import {
  prisma,
  PasswordAuthProvider,
  AuthenticationService,
  AuthorizationService,
  TenantService,
  OrganizationService,
  OrgRoleService,
  MembershipService,
} from '@workspace/database';
import { SESSION_COOKIE } from './session-cookie';

// Initialize password auth provider
const authProvider = new PasswordAuthProvider(prisma);

// Initialize authentication service
const authService = new AuthenticationService(prisma, authProvider);

// Initialize authorization service
const authorizationService = new AuthorizationService(prisma);

// Tenant context + organization creation
const tenantService = new TenantService(prisma);
const organizationService = new OrganizationService(prisma);

// Org-scoped role + membership management (multi-org authorization surfaces)
const orgRoleService = new OrgRoleService(prisma);
const membershipService = new MembershipService(prisma);

/**
 * Read the session token from the httpOnly cookie (server components + route
 * handlers). Returns null when no session cookie is present.
 */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export {
  prisma,
  authProvider,
  authService,
  authorizationService,
  tenantService,
  organizationService,
  orgRoleService,
  membershipService,
};

// Export prisma directly for API routes
export const db = prisma;
