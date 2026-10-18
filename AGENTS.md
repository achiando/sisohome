<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:authorization-security-rules -->
# Multi-Tenant Authorization Security - MANDATORY

**ALL development involving routes, pages, components, or API endpoints MUST follow authorization security rules.**

**CRITICAL**: This applies to EVERY UI component and EVERY database operation that accesses or manipulates protected data. There are NO exceptions.

**ALWAYS invoke the `authorization` agent skill before ANY work involving data access or protected features.**

The skill is located at: `packages/database/.agents/skills/authorization/SECURITY_SKILL.md`

## When to Use the Authorization Skill

**MANDATORY for ALL tasks involving**:

### UI Components
- Creating or modifying ANY component that displays protected data
- Creating or modifying ANY form that submits protected data
- Creating or modifying ANY page that requires authentication
- Creating or modifying ANY list/table showing protected resources
- Creating or modifying ANY dashboard or admin interface
- **ANY UI work that touches the database or displays user/org-specific data**

### Database Operations
- Creating or modifying ANY API route (Next.js API routes, Express routes)
- Creating or modifying ANY server action or mutation
- Creating or modifying ANY database query
- Creating or modifying ANY Prisma operation
- Creating or modifying ANY data fetching logic
- **ANY database operation that is not public data**

### General
- Adding new features that require access control
- Modifying existing authorization logic
- Creating or modifying ANY page (Next.js pages, app router pages)

## Core Security Principles

1. **Default Deny**: All access denied by default. Explicit permission required.
2. **Explicit Tenancy**: Tenant context must always be explicit. Never infer from arbitrary data.
3. **Server-Side Authorization**: Authorization MUST happen on the server. Client-side checks are UX only.
4. **Permission Persistence**: Use session caching to avoid repeated database queries.
5. **No Exceptions**: Every protected data access must be authorized.

## Quick Reference

> **In apps/web the only wired enforcement layer is `apiRoute` (`@/lib/api-route`) /
> `requireAuth` (`@/lib/route-auth`).** The `protectRoute` / `getServerAuthContext`
> helpers in `@workspace/database` are unwired placeholders — do NOT use them.

### API Route Protection (mandatory for every org-scoped route)
```typescript
import { apiRoute, RouteError } from '@/lib/api-route';

export const GET = apiRoute({
  permissions: 'customers.read',   // permission KEYS, never role slugs
  async handler({ actor }) {       // actor.organizationId is non-null
    const customers = await prisma.customer.findMany({
      where: { organizationId: actor.organizationId }, // tenant scoping
    });
    return { customers };          // → { success: true, customers }
  },
});

export const PATCH = apiRoute<{ id: string }>({
  permissions: 'customers.update',
  async handler({ actor, params, body }) {
    const input = await body();
    const result = await prisma.customer.updateMany({
      where: { id: params.id, organizationId: actor.organizationId },
      data: input,
    });
    if (result.count === 0) throw new RouteError(404, 'Customer not found');
  },
});
```
`apiRoute` handles: session-cookie auth, `mustChangePassword` block, active-org
requirement, permission-key checks, params awaiting, cached JSON body parsing,
and error mapping (`RouteError` / `AccessError` → JSON with status).

### Server Pages
All dashboard pages are client components; the real data boundary is the API
layer above. If you add a server page/layout that reads protected data, call
`requireAuth(request, { requiredPermissions: [...] })` from `@/lib/route-auth`
in it — never rely on the proxy (cookie presence only) or client redirects.

### Database Query Protection
```typescript
// ALWAYS include organization context in queries
const customers = await prisma.customer.findMany({
  where: { organizationId: actor.organizationId },
});
```

### Client UI Gates (UX only — never security)
```tsx
const { hasUiPermission } = useUiPermission(); // apps/web/components/shell
{hasUiPermission('customers.update') && <EditButton />}
```

### Middleware
`apps/web/proxy.ts` is an optimistic cookie-presence gate only. Real
authentication + permission checks live in `apiRoute` on every route.

## Security Checklist

Before committing any code that involves data access:
- [ ] Server-side authorization check present
- [ ] Permission key defined in seed data
- [ ] Tenant context explicit (if organization-scoped)
- [ ] Client-side checks paired with server checks
- [ ] Cross-tenant access prevented
- [ ] Authorization tests written
- [ ] Database queries scoped to organization
- [ ] No public data leakage

## Resources

- **Authorization Skill**: `packages/database/.agents/skills/authorization/SECURITY_SKILL.md`
- **Security Documentation**: `packages/database/SECURITY.md`
- **Architecture Documentation**: `packages/database/AUTH_ARCHITECTURE.md`
- **Integration Guide**: `packages/database/INTEGRATION_GUIDE.md`

<!-- END:authorization-security-rules -->

<!-- BEGIN:workspace-ui-rules -->
# @workspace/ui Design System - MANDATORY

**ALL UI work MUST follow the @workspace/ui design system.**

## Required Skill

**ALWAYS invoke the `workspace-ui` agent skill before ANY UI work.**

The skill is located at: `.agents/skills/workspace-ui/SKILL.md`
(Canonical package source: `packages/ui/skills/workspace-ui/SKILL.md`)

## When to Use the UI Skill

**MANDATORY for ALL UI-related tasks**:
- Creating ANY UI component
- Modifying ANY existing UI component
- Building ANY form (standard, wizard, section-edit)
- Implementing ANY responsive layout
- Adding ANY loading state
- Working with ANY table or data listing
- Ensuring ANY accessibility compliance
- Following ANY design system convention
- **Before creating ANY custom UI element**

## Cross-Project Enforcement

When copying `@workspace/ui` components to another project:

### 1. Copy Required Files
Copy these files to the target project:
- `packages/ui/AGENT_UI_SKILL.md` - Agent skill for UI guidance
- `packages/ui/UI_GUIDELINES.md` - Complete design system documentation

### 2. Register the Skill
Add the UI skill to your agent configuration:
```yaml
skills:
  - name: workspace-ui
    path: ./packages/ui/AGENT_UI_SKILL.md
    priority: HIGH
    mandatory_for:
      - ui_components
      - forms
      - layouts
      - styling
```

### 3. Enforce in Code Review
Add these checks to your code review process:
- [ ] All UI components imported from `@workspace/ui`
- [ ] No custom buttons, inputs, cards, or basic UI elements
- [ ] Design tokens followed (spacing, border-radius, shadows)
- [ ] Material Design 3 patterns applied
- [ ] Accessibility features implemented
- [ ] Mobile-first responsive design

### 4. CI/CD Integration
Add automated checks:
```yaml
# Example CI check
- name: Check UI Component Usage
  run: |
    # Check for custom button implementations
    if git diff --name-only | grep -E "button|Button"; then
      echo "ERROR: Custom button detected. Use @workspace/ui Button component."
      exit 1
    fi
```

## Component Usage Rules

### MANDATORY: Use @workspace/ui Components
**ALWAYS import from**:
```tsx
import { Button, Input, Card, Dialog } from "@workspace/ui/components"
```

**NEVER create custom versions of**:
- ❌ Buttons (use Button)
- ❌ Inputs (use Input)
- ❌ Selects (use Select)
- ❌ Cards (use Card)
- ❌ Modals (use Dialog/Sheet)
- ❌ Dropdowns (use DropdownMenu)
- ❌ Loaders (use Loader/Skeleton)
- ❌ Toasts (use Toast)
- ❌ Checkboxes (use Checkbox)
- ❌ Radio buttons (use RadioGroup)
- ❌ Switches (use Switch)
- ❌ Tabs (use Tabs)
- ❌ Accordions (use Accordion)

### Component Catalog
Check `packages/ui/AGENT_UI_SKILL.md` for the complete catalog of 60+ available components before creating anything custom.

## Design Tokens

**ALWAYS use these design tokens**:
- **Border Radius**: `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px)
- **Spacing**: `gap-2` (8px), `gap-3` (12px), `gap-4` (16px), `gap-6` (24px)
- **Shadows**: `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`
- **Typography**: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`

## Material Design 3 Patterns

**ALWAYS follow MD3 patterns**:
- Rounded corners: `rounded-2xl` for cards and large elements
- Touch targets: Minimum 44px height (h-11)
- Elevation: `shadow-sm` → `shadow-lg` on hover
- Ripple effects: Use `useRipple` hook for touch feedback
- Smooth transitions: `duration-300 ease-out`

## Accessibility Standards

**ALWAYS implement**:
- Keyboard navigation for all interactive elements
- ARIA labels for icon-only buttons
- Focus management for modals/drawers
- Visible focus indicators (ring-2 with offset)
- Screen reader support

## Violation Consequences

**Non-compliance will result in**:
- Code review rejection
- Technical debt flagging
- Required refactoring
- Project blockage until fixed

## Quick Reference

### Import Pattern
```tsx
import { Button, Input, Card } from "@workspace/ui/components"
import { useRipple } from "@workspace/ui/hooks"
import { cn } from "@workspace/ui/lib/utils"
```

### Button Pattern
```tsx
<Button variant="primary" size="md" loading={isLoading}>
  Submit
</Button>
```

### Input Pattern
```tsx
<Input className="rounded-xl h-11" placeholder="..." />
```

### Card Pattern
```tsx
<Card className="rounded-2xl shadow-md">
  <CardContent>Content</CardContent>
</Card>
```

## Resources

- **UI Skill**: `packages/ui/AGENT_UI_SKILL.md`
- **UI Guidelines**: `packages/ui/UI_GUIDELINES.md`
- **Component Docs**: `packages/ui/src/components/*.md`
- **Type Definitions**: `packages/ui/src/types/components/`

<!-- END:workspace-ui-rules -->
