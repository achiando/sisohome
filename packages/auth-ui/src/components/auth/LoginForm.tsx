/**
 * LoginForm Component
 * Email/password login with live validation (errors update as you type)
 * Uses @workspace/ui components
 */

'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context';
import { loginSchema, type LoginFormData } from '../../lib/validators';
import { Button, Input, Checkbox, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components';

export interface LoginFormProps {
  redirectTo?: string;
  onboardingRedirectTo?: string;
  /** Forced-password-change screen (preserves any deep link). */
  changePasswordTo?: string;
  showSignUpLink?: boolean;
  showForgotPasswordLink?: boolean;
}

export default function LoginForm({
  redirectTo = '/',
  onboardingRedirectTo = '/onboarding',
  changePasswordTo = '/change-password',
  showSignUpLink = true,
  showForgotPasswordLink = true,
}: LoginFormProps) {
  const router = useRouter();
  const {
    login,
    isLoading,
    isAuthenticated,
    needsOnboarding,
    needsPasswordChange,
  } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Already signed in (real session restore — not stale cookie optimism) →
  // route past the login screen: forced password change first, else onboarding
  // or the destination. Also breaks the / ↔ /login bounce when cookies exist
  // but the session row has expired (in that case this effect never fires).
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (needsPasswordChange) router.replace(changePasswordTo);
    else router.replace(needsOnboarding ? onboardingRedirectTo : redirectTo);
  }, [
    isLoading,
    isAuthenticated,
    needsPasswordChange,
    needsOnboarding,
    changePasswordTo,
    onboardingRedirectTo,
    redirectTo,
    router,
  ]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: standardSchemaResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      const response = await login(data);
      // Route on the FRESH login result (never stale render-time state):
      // 1. Temporary password → forced change screen first.
      // 2. No active organization → onboarding.
      // 3. Otherwise → destination.
      if (response.mustChangePassword) {
        router.push(changePasswordTo);
      } else {
        router.push(
          response.session?.organizationId ? redirectTo : onboardingRedirectTo
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Enter your email and password to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            id="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
            disabled={isLoading}
          />

          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            showPasswordToggle
            {...register('password')}
            disabled={isLoading}
          />

          <Controller
            control={control}
            name="rememberMe"
            render={({ field }) => (
              <Checkbox
                id="rememberMe"
                checked={!!field.value}
                onCheckedChange={field.onChange}
                disabled={isLoading}
                label="Remember me"
              />
            )}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" loading={isLoading}>
            Sign In
          </Button>

          {showForgotPasswordLink && (
            <div className="text-center">
              <a
                href="/forgot-password"
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot your password?
              </a>
            </div>
          )}

          {showSignUpLink && (
            <div className="text-center text-sm">
              Don't have an account?{' '}
              <a href="/signup" className="text-blue-600 hover:underline">
                Sign up
              </a>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
