/**
 * ProfileForm Component
 * User profile management form
 * Uses @workspace/ui components
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
    resolver: zodResolver(profileSchema),
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              {...register('name')}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="avatar" className="text-sm font-medium">
              Avatar URL
            </label>
            <Input
              id="avatar"
              type="url"
              placeholder="https://example.com/avatar.jpg"
              {...register('avatar')}
              disabled={isLoading}
            />
            {errors.avatar && (
              <p className="text-sm text-red-500">{errors.avatar.message}</p>
            )}
          </div>

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
