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
  const { signUp, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

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
      await signUp(data);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    }
  };

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
                label="I accept the terms and conditions"
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
