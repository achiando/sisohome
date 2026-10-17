/**
 * ResetPasswordForm Component
 * Password reset request form
 * Uses @workspace/ui components
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context';
import { resetPasswordSchema, type ResetPasswordFormData } from '../../lib/validators';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components';

export interface ResetPasswordFormProps {
  redirectTo?: string;
  showLoginLink?: boolean;
}

export default function ResetPasswordForm({ redirectTo = '/login', showLoginLink = true }: ResetPasswordFormProps) {
  const router = useRouter();
  const { resetPassword, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: standardSchemaResolver(resetPasswordSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      setError(null);
      await resetPassword(data.email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset password failed');
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check Your Email</CardTitle>
          <CardDescription>
            We've sent a password reset link to your email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push(redirectTo)} className="w-full">
            Back to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>Enter your email to receive a password reset link</CardDescription>
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

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" loading={isLoading}>
            Send Reset Link
          </Button>

          {showLoginLink && (
            <div className="text-center text-sm">
              Remember your password?{' '}
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
