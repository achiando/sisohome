# @workspace/auth-ui

Reusable authentication UI components and guards for multi-tenant applications using `@workspace/database` and `@workspace/ui`.

## Features

- **Complete Auth Flow**: Login, Sign Up, Reset Password, Profile Management
- **Permission Guards**: AuthGuard and PermissionGuard for UI access control
- **Multi-Tenant Ready**: Integrates with @workspace/database authorization
- **Form Validation**: Zod schemas with react-hook-form
- **Type Safe**: Full TypeScript support
- **Accessible**: WCAG AA compliant
- **Responsive**: Mobile-first design using @workspace/ui

## Installation

```bash
pnpm add @workspace/auth-ui
```

## Setup

### 1. Add AuthProvider to your app

Wrap your application with the AuthProvider:

```tsx
import { AuthProvider } from '@workspace/auth-ui';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 2. Create API Routes

Create the following API routes in your Next.js app:

#### `/api/auth/login`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { protectRoute } from '@workspace/database';
import { authService, tenantService } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const authContext = await protectRoute({
    authService,
    tenantService,
  })(request);

  // Your login logic here
  // Return { success: true, user: {...}, session: {...} }
}
```

#### `/api/auth/signup`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authService, tenantService } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Your signup logic here
  // Return { success: true, user: {...}, session: {...} }
}
```

#### `/api/auth/logout`
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Your logout logic here
  // Return { success: true }
}
```

#### `/api/auth/reset-password`
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Your reset password logic here
  // Return { success: true }
}
```

#### `/api/auth/session`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthContext } from '@workspace/database';

export async function GET(request: NextRequest) {
  const auth = getServerAuthContext();
  
  if (!auth.user) {
    return NextResponse.json({ success: false });
  }
  
  return NextResponse.json({
    success: true,
    user: auth.user,
    session: {
      organizationId: auth.organizationId,
      permissions: auth.permissions,
      roles: auth.roles,
    },
  });
}
```

## Usage

### Login Form

```tsx
import { LoginForm } from '@workspace/auth-ui';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoginForm redirectTo="/dashboard" />
    </div>
  );
}
```

### Sign Up Form

```tsx
import { SignUpForm } from '@workspace/auth-ui';

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUpForm redirectTo="/dashboard" />
    </div>
  );
}
```

### Reset Password Form

```tsx
import { ResetPasswordForm } from '@workspace/auth-ui';

export default function ResetPasswordPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <ResetPasswordForm redirectTo="/login" />
    </div>
  );
}
```

### Profile Form

```tsx
import { ProfileForm } from '@workspace/auth-ui';

export default function ProfilePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <ProfileForm onSuccess={() => console.log('Profile updated')} />
    </div>
  );
}
```

### Auth Guard

Protect routes that require authentication:

```tsx
import { AuthGuard } from '@workspace/auth-ui';
import { Dashboard } from '@/components/Dashboard';

export default function DashboardPage() {
  return (
    <AuthGuard redirectTo="/login">
      <Dashboard />
    </AuthGuard>
  );
}
```

### Permission Guard

Protect components that require specific permissions:

```tsx
import { PermissionGuard } from '@workspace/auth-ui';
import { AdminPanel } from '@/components/AdminPanel';

export default function AdminPage() {
  return (
    <PermissionGuard permission="admin.access">
      <AdminPanel />
    </PermissionGuard>
  );
}
```

Require multiple permissions (any):

```tsx
<PermissionGuard permissions={['admin.access', 'moderator.access']}>
  <AdminPanel />
</PermissionGuard>
```

Require all permissions:

```tsx
<PermissionGuard 
  permissions={['admin.access', 'moderator.access']} 
  requireAll={true}
>
  <AdminPanel />
</PermissionGuard>
```

Custom fallback:

```tsx
<PermissionGuard 
  permission="admin.access"
  fallback={<div>Access denied</div>}
>
  <AdminPanel />
</PermissionGuard>
```

### useAuth Hook

Access auth state and methods:

```tsx
import { useAuth } from '@workspace/auth-ui';

export default function UserProfile() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in</div>;

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### usePermissions Hook

Check permissions programmatically:

```tsx
import { usePermissions } from '@workspace/auth-ui';

export default function UserActions() {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  return (
    <div>
      {hasPermission('users.create') && (
        <button>Create User</button>
      )}
      
      {hasAnyPermission(['admin.access', 'moderator.access']) && (
        <button>Moderate</button>
      )}
      
      {hasAllPermissions(['admin.access', 'superadmin.access']) && (
        <button>Super Admin Actions</button>
      )}
    </div>
  );
}
```

## Components

### Auth Forms

- **LoginForm**: Email/password login with remember me option
- **SignUpForm**: Registration with password strength validation
- **ResetPasswordForm**: Password reset request
- **ProfileForm**: User profile management

### Guards

- **AuthGuard**: Protects authenticated routes
- **PermissionGuard**: Protects permission-based components

### Hooks

- **useAuth**: Access auth state and methods
- **usePermissions**: Check permissions programmatically

## API

### AuthContext

```typescript
interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  refreshSession: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
}
```

### AuthUser

```typescript
interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  organizationId?: string;
  permissions?: string[];
  roles?: string[];
}
```

## Validation Schemas

All forms use Zod validation:

- **loginSchema**: Email, password (min 8 chars), remember me
- **signUpSchema**: Email, password (with strength requirements), confirm password, name, terms acceptance
- **resetPasswordSchema**: Email
- **profileSchema**: Name, email, avatar URL
- **changePasswordSchema**: Current password, new password (with strength requirements), confirm password

## Styling

All components use `@workspace/ui` components and follow the Material Design 3 guidelines. Customize via:

1. **Theming**: Configure @workspace/ui theme
2. **CSS**: Override component styles
3. **Props**: Use component props for customization

## TypeScript

This package is fully typed. Exported types:

```typescript
import type {
  AuthUser,
  AuthState,
  AuthContextValue,
  LoginFormData,
  SignUpFormData,
  ResetPasswordFormData,
  ProfileFormData,
  ChangePasswordFormData,
  AuthGuardProps,
  PermissionGuardProps,
  LoginFormProps,
  SignUpFormProps,
  ResetPasswordFormProps,
  ProfileFormProps,
} from '@workspace/auth-ui';
```

## Security

- Server-side authorization via @workspace/database
- Permission-based access control
- Session management
- CSRF protection (via Next.js)
- Secure password handling

## License

Private - Workspace internal use only
