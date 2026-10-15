/**
 * Auth Context Provider
 * Manages authentication state and provides auth methods
 * Integrates with @workspace/database authorization system
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuthAPI, AuthResponse, LoginCredentials, SignUpCredentials } from '../lib/auth-api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  organizationId?: string;
  permissions?: string[];
  roles?: string[];
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  refreshSession: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const authAPI = getAuthAPI();

  const refreshSession = useCallback(async () => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      const response = await authAPI.getSession();
      
      if (response.success && response.user) {
        setState({
          user: {
            ...response.user,
            organizationId: response.session?.organizationId,
            permissions: response.session?.permissions,
            roles: response.session?.roles,
          },
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    } catch (error) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: error instanceof Error ? error.message : 'Failed to refresh session',
      });
    }
  }, [authAPI]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      const response = await authAPI.login(credentials);
      
      if (response.success && response.user) {
        setState({
          user: {
            ...response.user,
            organizationId: response.session?.organizationId,
            permissions: response.session?.permissions,
            roles: response.session?.roles,
          },
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      setState((prev: AuthState) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  }, [authAPI]);

  const signUp = useCallback(async (credentials: SignUpCredentials) => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      const response = await authAPI.signUp(credentials);
      
      if (response.success && response.user) {
        setState({
          user: {
            ...response.user,
            organizationId: response.session?.organizationId,
            permissions: response.session?.permissions,
            roles: response.session?.roles,
          },
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        throw new Error(response.error || 'Sign up failed');
      }
    } catch (error) {
      setState((prev: AuthState) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Sign up failed',
      }));
      throw error;
    }
  }, [authAPI]);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    }
  }, [authAPI]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      await authAPI.resetPassword({ email });
      setState((prev: AuthState) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev: AuthState) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Reset password failed',
      }));
      throw error;
    }
  }, [authAPI]);

  const updateProfile = useCallback(async (data: Partial<AuthUser>) => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      const response = await authAPI.updateProfile(data);
      
      if (response.success && response.user) {
        setState((prev: AuthState) => ({
          ...prev,
          user: { ...prev.user, ...response.user } as AuthUser,
          isLoading: false,
        }));
      } else {
        throw new Error(response.error || 'Update profile failed');
      }
    } catch (error) {
      setState((prev: AuthState) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Update profile failed',
      }));
      throw error;
    }
  }, [authAPI]);

  const switchOrganization = useCallback(async (organizationId: string) => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      const response = await authAPI.switchOrganization(organizationId);
      
      if (response.success && response.user) {
        setState({
          user: {
            ...response.user,
            organizationId: response.session?.organizationId,
            permissions: response.session?.permissions,
            roles: response.session?.roles,
          },
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        throw new Error(response.error || 'Switch organization failed');
      }
    } catch (error) {
      setState((prev: AuthState) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Switch organization failed',
      }));
      throw error;
    }
  }, [authAPI]);

  const value: AuthContextValue = {
    ...state,
    login,
    signUp,
    logout,
    resetPassword,
    updateProfile,
    refreshSession,
    switchOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
