/**
 * SignUpForm Component
 * User registration with live validation — errors and the password
 * requirements checklist update on every keystroke, rendered below
 * each input by the @workspace/ui Input component.
 */

'use client';

import { useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context';
import { signUpSchema, type SignUpFormData } from '../../lib/validators';
import { Button, Input, Checkbox, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components';
import PasswordChecklist from './PasswordChecklist';

export interface SignUpFormProps {
  redirectTo?: string;
  showLoginLink?: boolean;
}

export default function SignUpForm({ redirectTo = '/onboarding', showLoginLink = true }: SignUpFormProps) {
  const router = useRouter();
  const { signUp, resendVerification, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Set when the account was created but must verify its email first —
  // the form is replaced by a "check your email" card with a resend.
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Outbox transport only — the 6-digit code echoed by signup/resend, shown
  // so the address can be proven without opening the mail file.
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: standardSchemaResolver(signUpSchema),
    mode: 'onChange',
  });

  const password = useWatch({ control, name: 'password' }) ?? '';

  const onSubmit = async (data: SignUpFormData) => {
    try {
      setError(null);
      const response = await signUp(data);
      // Verification link is out — nothing to route to until it's clicked.
      if (response.verificationRequired) {
        setSentTo(response.email ?? data.email);
        setIssuedCode(response.code ?? null);
        return;
      }
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    }
  };

  const onResend = async () => {
    if (!sentTo || resending) return;
    setResending(true);
    try {
      const response = await resendVerification(sentTo);
      setResent(true);
      setIssuedCode(response.code ?? issuedCode);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email');
    } finally {
      setResending(false);
    }
  };

  if (sentTo) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a verification link and a 6-digit code to{' '}
            <span className="font-medium text-foreground">{sentTo}</span>. Open the link or
            enter the code to finish creating your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {issuedCode && (
            <div className="rounded-md bg-muted p-3 text-center">
              <p className="text-sm text-muted-foreground">Your verification code</p>
              <p className="font-mono text-xl font-semibold tracking-[0.3em]">
                {issuedCode}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            The link works once and expires in 24 hours. Don&apos;t see it? Check spam, or send
            it again.
          </p>
          {resent && (
            <p className="text-sm text-emerald-600">
              {issuedCode
                ? 'Sent — a fresh code is shown above.'
                : 'Sent — we just emailed a fresh link.'}
            </p>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <Button type="button" variant="outline" className="w-full" loading={resending} onClick={onResend}>
            {resent ? 'Send another email' : 'Resend verification email'}
          </Button>
          <p className="text-center text-sm">
            <a
              href={`/verify-email-by-code${
                sentTo ? `?email=${encodeURIComponent(sentTo)}` : ""
              }`}
              className="text-blue-600 hover:underline"
            >
              Enter verification code instead
            </a>
          </p>
          {showLoginLink && (
            <p className="text-center text-sm">
              <a href="/login" className="text-blue-600 hover:underline">
                Back to sign in
              </a>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Enter your information to create an account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            id="name"
            type="text"
            label="Name"
            placeholder="John Doe"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name')}
            disabled={isLoading}
          />

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

          <div className="space-y-2">
            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.password?.message}
              showPasswordToggle
              {...register('password')}
              disabled={isLoading}
            />
            <PasswordChecklist password={password} />
          </div>

          <Input
            id="confirmPassword"
            type="password"
            label="Confirm password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            showPasswordToggle
            {...register('confirmPassword')}
            disabled={isLoading}
          />

          <Controller
            control={control}
            name="acceptTerms"
            render={({ field }) => (
              <Checkbox
                id="acceptTerms"
                checked={!!field.value}
                onCheckedChange={field.onChange}
                disabled={isLoading}
                label={
                  <>
                    I accept the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Privacy Policy
                    </a>
                  </>
                }
                error={errors.acceptTerms?.message}
              />
            )}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" loading={isLoading}>
            Create Account
          </Button>

          {showLoginLink && (
            <div className="text-center text-sm">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 hover:underline">
                Sign in
              </a>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
