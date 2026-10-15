# Auth UI Architecture

## Overview

Reusable authentication UI components and guards for multi-tenant applications using `@workspace/database` and `@workspace/ui`.

## Package Structure

```
@workspace/auth-ui
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignUpForm.tsx
│   │   │   ├── ResetPasswordForm.tsx
│   │   │   ├── ProfileForm.tsx
│   │   │   └── index.ts
│   │   ├── guards/
│   │   │   ├── AuthGuard.tsx
│   │   │   ├── PermissionGuard.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePermissions.ts
│   │   └── index.ts
│   ├── lib/
│   │   ├── auth-api.ts
│   │   └── validators.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

## Components

### Auth Forms

#### LoginForm
- Email/password input with validation
- Remember me option
- Forgot password link
- Sign up link
- Loading states
- Error handling

#### SignUpForm
- Email input with validation
- Password input with strength indicator
- Confirm password validation
- Terms of service checkbox
- Loading states
- Error handling

#### ResetPasswordForm
- Email input
- Password reset link sent confirmation
- Loading states
- Error handling

#### ProfileForm
- User profile editing
- Avatar upload
- Email change (with verification)
- Password change
- Organization switching
- Loading states
- Error handling

### Guards

#### AuthGuard
- Wraps components that require authentication
- Redirects to login if not authenticated
- Shows loading state while checking auth
- Optional redirect path

#### PermissionGuard
- Wraps components that require specific permissions
- Shows fallback UI if no permission
- Optional custom fallback component
- Works with server-side permissions

## Context & Hooks

### AuthContext
- Provides auth state (user, session, loading, error)
- Provides auth methods (login, logout, signup, resetPassword)
- Integrates with @workspace/database
- Persists session

### useAuth Hook
- Access auth context
- Convenience methods for auth operations

### usePermissions Hook
- Access user permissions
- Check specific permissions
- Permission-based rendering

## API Integration

### Auth API Client
- Login endpoint
- Sign up endpoint
- Reset password endpoint
- Profile update endpoint
- Session refresh endpoint
- Organization switch endpoint

### Validation
- Zod schemas for all forms
- Client-side validation
- Server-side validation

## Design Principles

1. **Provider Agnostic**: Works with any auth provider (Supabase, Clerk, Auth0)
2. **Multi-Tenant Ready**: Integrates with @workspace/database tenancy
3. **Permission Based**: Uses @workspace/database authorization
4. **Type Safe**: Full TypeScript support
5. **Accessible**: WCAG AA compliant
6. **Responsive**: Mobile-first design
7. **Customizable**: Theming support via @workspace/ui

## Dependencies

- @workspace/ui (base components)
- @workspace/database (authorization)
- react (peer dependency)
- zod (validation)
- react-hook-form (form management)

## Usage Example

```typescript
import { AuthProvider, AuthGuard, PermissionGuard, LoginForm } from '@workspace/auth-ui';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route 
          path="/dashboard" 
          element={
            <AuthGuard>
              <PermissionGuard permission="dashboard.read">
                <Dashboard />
              </PermissionGuard>
            </AuthGuard>
          } 
        />
      </Routes>
    </AuthProvider>
  );
}
```

## Next Steps

1. Create package structure
2. Implement AuthContext
3. Implement auth API client
4. Create LoginForm component
5. Create SignUpForm component
6. Create ResetPasswordForm component
7. Create ProfileForm component
8. Create AuthGuard component
9. Create PermissionGuard component
10. Create useAuth hook
11. Create usePermissions hook
12. Add validation schemas
13. Create API routes in apps
14. Write documentation
15. Add examples
