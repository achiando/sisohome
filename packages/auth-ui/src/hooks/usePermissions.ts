/**
 * usePermissions Hook
 * Provides permission checking functionality
 * Integrates with @workspace/database authorization system
 */

'use client';

import { useMemo } from 'react';
import { useAuth } from '../context';

export function usePermissions() {
  const { user } = useAuth();

  const permissions = user?.permissions || [];

  const hasPermission = useMemo(() => {
    return (permission: string): boolean => {
      return permissions.includes(permission);
    };
  }, [permissions]);

  const hasAnyPermission = useMemo(() => {
    return (requiredPermissions: string[]): boolean => {
      return requiredPermissions.some((perm) => permissions.includes(perm));
    };
  }, [permissions]);

  const hasAllPermissions = useMemo(() => {
    return (requiredPermissions: string[]): boolean => {
      return requiredPermissions.every((perm) => permissions.includes(perm));
    };
  }, [permissions]);

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading: !user,
  };
}
