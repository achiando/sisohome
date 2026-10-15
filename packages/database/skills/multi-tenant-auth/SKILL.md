---
name: multi-tenant-auth
description: >-
  MANDATORY security and tenancy manual for @workspace/database.
  Required for all backend, API routes, Server Actions, database queries,
  and UI conditional rendering (hiding/showing buttons, navigation, and actions based on permissions).
---

# Multi-Tenant Auth & Tenancy Security Manual

## ⚠️ MANDATORY ENFORCEMENT ACROSS ALL APPLICATIONS

All vertical applications (CRM, Property, Restaurant, Inventory, E-commerce, etc.) MUST strictly adhere to these rules.

---

## 1. Core Architectural Invariants

1. **User != Tenant**:
   - A user belongs to organizations via `OrganizationMember`.
   - Never tie resources directly to `User.id` when they belong to a business tenant.
2. **Tenant Boundary is `Organization`**:
   - Every tenant-owned entity has `organizationId`.
   - Active organization context (`ctx.organizationId`) must be explicit. Never silently guess.
3. **Defense in Depth**:
   - Application authorization (`authorization.require(...)`)
   - PLUS Database tenant-scoping (`where: { id, organizationId }`)
   - PLUS UI conditional rendering (hide buttons/actions if unauthorized).

---

## 2. UI Conditional Rendering Rules (Hiding/Showing Actions)

### Rule: Always Check Permissions Before Rendering Destructive or Privileged Controls

Never render edit, delete, invite, or export buttons to users who lack the permission.

```tsx
import { hasUiPermission, hasUiRole } from '@workspace/database';
import { Button } from '@workspace/ui/components/button';
import { Trash2, Edit, Plus } from 'lucide-react';

interface CustomerActionsProps {
  userPermissions: string[];
  customer: Customer;
}

export function CustomerActions({ userPermissions, customer }: CustomerActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Conditionally show Edit button */}
      {hasUiPermission(userPermissions, 'customers.update') && (
        <Button variant="outline" size="sm" leftIcon={Edit}>
          Edit
        </Button>
      )}

      {/* Conditionally show Delete button */}
      {hasUiPermission(userPermissions, 'customers.delete') && (
        <Button variant="destructive" size="sm" leftIcon={Trash2}>
          Delete
        </Button>
      )}
    </div>
  );
}
```

### Rule: Navigation & Tab Visibility
```tsx
// Only show organization settings if user has management permissions
{hasUiPermission(userPermissions, 'organization.update') && (
  <NavLink href="/settings/organization">Organization Settings</NavLink>
)}
```

### ⚠️ Critical Security Warning
> **Hiding a button in the UI is NOT security.**
> The underlying Server Action or API route **MUST ALWAYS** independently enforce `authorization.require(ctx, permission, resource)`.

---

## 3. Database Query Rules (Tenant Scoping)

### Rule: Every Tenant Query Must Include `organizationId`

```ts
// ❌ FORBIDDEN (Vulnerable to cross-tenant IDOR/BOLA attacks)
const customer = await prisma.customer.findUnique({
  where: { id: customerId }
});

// ✅ MANDATORY (Tenant-isolated query)
const customer = await prisma.customer.findFirst({
  where: {
    id: customerId,
    organizationId: ctx.organizationId,
  }
});

// ✅ MANDATORY for Mutations
await prisma.customer.updateMany({
  where: {
    id: customerId,
    organizationId: ctx.organizationId,
  },
  data: updateData,
});
```

---

## 4. Backend Route & Server Action Rules

### Standard API / Server Action Pattern

Always follow this exact 4-step sequence:

```ts
import { prisma, AuthorizationService, TenantService } from '@workspace/database';

const authService = new AuthorizationService(prisma);
const tenantService = new TenantService(prisma);

export async function updateCustomerAction(ctx: AuthContext, customerId: string, data: any) {
  // 1. Enforce explicit tenant context & active membership
  tenantService.requireTenant(ctx.organizationId);
  await tenantService.validateMembership(ctx.userId, ctx.organizationId!);

  // 2. Fetch tenant-scoped resource
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: ctx.organizationId! }
  });
  if (!customer) {
    throw new Error('Customer not found');
  }

  // 3. Enforce permission + resource policy
  await authService.require(ctx, 'customers.update', customer);

  // 4. Perform mutation
  return prisma.customer.update({
    where: { id: customer.id },
    data,
  });
}
```

---

## 5. Permission Key Conventions

Permissions follow the stable `resource.action` convention:

* `customers.read`, `customers.create`, `customers.update`, `customers.delete`
* `orders.read`, `orders.create`, `orders.update`, `orders.cancel`
* `organization.members.read`, `organization.members.manage`
* `roles.read`, `roles.assign`, `roles.manage`
* `audit.read`, `audit.export`

Do NOT invent non-standard formats like `can_edit_customer` or `EDIT_CUSTOMERS`.
