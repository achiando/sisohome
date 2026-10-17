/**
 * LoginForm Component
 * Email/password login with live validation (errors update as you type)
 * Uses @workspace/ui components
 */

'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context';
import { loginSchema, type LoginFormData } from '../../lib/validators';
import {
  Button,
  Input,
  Checkbox,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  UniversalForm,
  type FormSection,
} from '@workspace/ui/components';

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
    twoFactorPending,
    cancelTwoFactor,
    verificationNeeded,
    resendVerification,
  } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // A verification link was just re-sent from this screen.
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

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

  const emailValue = useWatch({ control, name: 'email' }) ?? '';

  const onResend = async () => {
    const email = String(emailValue).trim();
    if (!email || resending) return;
    setResending(true);
    try {
      await resendVerification(email);
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email');
    } finally {
      setResending(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      setResent(false);
      const response = await login(data);
      // 2FA accounts: password accepted but no session yet — the context
      // flips twoFactorPending and the code prompt takes over, so stop here.
      if (response.twoFactorRequired) return;
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

  // Second factor: password already proved, session withheld until a live
  // authenticator code (or a recovery code) is accepted.
  if (twoFactorPending) {
    return (
      <TwoFactorStep
        changePasswordTo={changePasswordTo}
        redirectTo={redirectTo}
        onboardingRedirectTo={onboardingRedirectTo}
        onCancel={cancelTwoFactor}
      />
    );
  }

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

          {/* Address never verified — offer a fresh link right here. */}
          {verificationNeeded && !resent && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              loading={resending}
              onClick={onResend}
            >
              Resend verification email
            </Button>
          )}
          {verificationNeeded && resent && (
            <p className="text-center text-sm text-emerald-600">
              Sent — check your inbox for a new verification link.
            </p>
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

/**
 * Step 2 of sign-in for accounts with two-factor authentication on.
 * Built on the design-system UniversalForm like every other form.
 */
function TwoFactorStep({
  changePasswordTo,
  redirectTo,
  onboardingRedirectTo,
  onCancel,
}: {
  changePasswordTo: string;
  redirectTo: string;
  onboardingRedirectTo: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const { verifyTwoFactor, isLoading, twoFactorChannel } = useAuth();
  const [mode, setMode] = useState<'authenticator' | 'recovery'>('authenticator');
  const [values, setValues] = useState<Record<string, unknown>>({ code: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isRecovery = mode === 'recovery';
  /** Account signs in with codes sent by email instead of an app. */
  const emailChannel = twoFactorChannel === 'email' && !isRecovery;

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const onSubmit = (submitValues: Record<string, unknown>) => {
    const raw = String(submitValues.code ?? '').trim();

    if (!raw) {
      setErrors({
        code: isRecovery ? 'Enter a recovery code' : 'Enter the code from your authenticator app',
      });
      return;
    }
    if (isRecovery) {
      if (raw.replace(/[^a-zA-Z0-9]/g, '').length < 8) {
        setErrors({ code: 'Recovery codes look like XXXXXX-XXXXXX' });
        return;
      }
    } else if (!/^\d{6}$/.test(raw)) {
      setErrors({ code: 'Enter the 6-digit code' });
      return;
    }
    setErrors({});

    void (async () => {
      try {
        const response = await verifyTwoFactor(
          isRecovery ? { recoveryCode: raw } : { token: raw }
        );
        if (response.mustChangePassword) {
          router.push(changePasswordTo);
        } else {
          router.push(
            response.session?.organizationId ? redirectTo : onboardingRedirectTo
          );
        }
      } catch (err) {
        setErrors({
          code:
            err instanceof Error
              ? err.message
              : 'That code was not accepted. Try again.',
        });
      }
    })();
  };

  const sections: FormSection[] = [
    {
      id: 'two-factor',
      title: isRecovery ? 'Recovery code' : emailChannel ? 'Email code' : 'Authentication code',
      columns: 4,
      fields: [
        {
          name: 'code',
          label: isRecovery ? 'Recovery code' : emailChannel ? '6-digit email code' : '6-digit code',
          type: 'text',
          colSpan: 'full',
          required: true,
          placeholder: isRecovery ? 'XXXXXX-XXXXXX' : '123456',
          helperText: isRecovery
            ? 'Each recovery code works exactly once.'
            : emailChannel
              ? 'We emailed you a 6-digit code — it expires in 10 minutes and can be used once.'
              : 'Open Google Authenticator, Authy or 1Password and enter the code shown for SisoHome.',
          disabled: isLoading,
        },
      ],
    },
  ];

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>
          {emailChannel
            ? 'Your password was accepted. Enter the code we emailed you to finish signing in.'
            : 'Your password was accepted. Enter your code to finish signing in.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <UniversalForm
          title="Two-factor authentication"
          values={values}
          errors={errors}
          onChange={handleChange}
          sections={sections}
          onSubmit={onSubmit}
          primaryLabel="Verify"
          isLoading={isLoading}
        />

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => {
              setMode(isRecovery ? 'authenticator' : 'recovery');
              setValues({ code: '' });
              setErrors({});
            }}
          >
            {isRecovery ? 'Use an authenticator code' : 'Use a recovery code'}
          </Button>
          <Button type="button" variant="text" size="sm" onClick={onCancel}>
            Back to sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
