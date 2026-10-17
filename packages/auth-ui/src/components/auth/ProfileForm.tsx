/**
 * ProfileForm Component
 * User profile management form
 * Uses @workspace/ui components
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useAuth } from '../../context';
import { profileSchema, type ProfileFormData } from '../../lib/validators';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components';

export interface ProfileFormProps {
  onSuccess?: () => void;
}

export default function ProfileForm({ onSuccess }: ProfileFormProps) {
  const { user, updateProfile, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: standardSchemaResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      avatar: user?.avatar || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setError(null);
      await updateProfile(data);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update profile failed');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>Update your profile information</CardDescription>
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

          <Input
            id="avatar"
            type="url"
            label="Avatar URL"
            placeholder="https://example.com/avatar.jpg"
            error={errors.avatar?.message}
            {...register('avatar')}
            disabled={isLoading}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600">Profile updated successfully</p>
            </div>
          )}

          <Button type="submit" className="w-full" loading={isLoading}>
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
