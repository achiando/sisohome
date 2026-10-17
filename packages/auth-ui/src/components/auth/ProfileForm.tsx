/**
 * ProfileForm Component
 * Edit-only form for the user's own profile (display name + avatar), built on
 * the design-system UniversalForm — the standard for all forms across the app.
 *
 * The email is the account identity: it is never a field here and is never
 * accepted by the update endpoint. Callers render a read-only view and swap
 * this in when the user presses Edit.
 */

'use client';

import { useState } from 'react';
import { useAuth } from '../../context';
import { profileSchema } from '../../lib/validators';
import { UniversalForm, type FormSection } from '@workspace/ui/components';

export interface ProfileFormProps {
  /** Leave edit mode without saving. */
  onCancel?: () => void;
  onSuccess?: () => void;
}

export default function ProfileForm({ onCancel, onSuccess }: ProfileFormProps) {
  const { user, updateProfile, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    name: user?.name || '',
    avatar: user?.avatar || '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const onSubmit = async (submitValues: Record<string, unknown>) => {
    const parsed = profileSchema.safeParse(submitValues);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      setError(null);
      await updateProfile(parsed.data);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update profile failed');
    } finally {
      setSaving(false);
    }
  };

  const sections: FormSection[] = [
    {
      id: 'profile',
      title: 'Profile',
      description: 'How you appear across every workspace you belong to.',
      columns: 4,
      fields: [
        {
          name: 'name',
          label: 'Name',
          type: 'text',
          colSpan: 'full',
          required: true,
          placeholder: 'John Doe',
          disabled: isLoading || saving,
        },
        {
          name: 'avatar',
          label: 'Avatar URL',
          type: 'text',
          colSpan: 'full',
          placeholder: 'https://example.com/avatar.jpg',
          disabled: isLoading || saving,
          helperText: 'Paste a link to your photo. Used as your profile picture.',
        },
      ],
    },
  ];

  return (
    <UniversalForm
      title="Profile"
      description="Your name and picture as they appear across workspaces."
      mode="edit"
      values={values}
      errors={errors}
      onChange={handleChange}
      sections={sections}
      onSubmit={onSubmit}
      onCancel={onCancel}
      primaryLabel="Save changes"
      isLoading={isLoading || saving}
      formClassName="max-w-2xl"
    >
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-3">
          <p className="text-sm text-success">Profile updated successfully</p>
        </div>
      )}
    </UniversalForm>
  );
}
