/**
 * AuthGuard Component
 * Wraps components that require authentication
 * Redirects to login if not authenticated
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context';

export interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  onboardingRedirectTo?: string;
  fallback?: React.ReactNode;
}

export default function AuthGuard({
  children,
  redirectTo = '/login',
  onboardingRedirectTo = '/onboarding',
  fallback,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push(redirectTo);
      return;
    }
    if (needsOnboarding) {
      router.push(onboardingRedirectTo);
    }
  }, [isAuthenticated, isLoading, needsOnboarding, redirectTo, onboardingRedirectTo, router]);

  if (isLoading) {
    return fallback || <div>Loading...</div>;
  }

  if (!isAuthenticated || needsOnboarding) {
    return fallback || null;
  }

  return <>{children}</>;
}
