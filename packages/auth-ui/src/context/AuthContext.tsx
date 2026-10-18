/**
 * Auth Context Provider
 * Manages authentication state and provides auth methods
 * Integrates with @workspace/database authorization system
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getAuthAPI,
  AuthApiError,
  AuthResponse,
  LoginCredentials,
  SignUpCredentials,
  UpdateProfileData,
} from '../lib/auth-api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  /** Contact number; also the SMS channel for a future 2FA fallback. */
  phone?: string | null;
  /** Two-factor authentication status (foundation columns, flow ships later). */
  twoFactorEnabled?: boolean;
  twoFactorMethod?: 'TOTP' | 'SMS' | 'EMAIL' | null;
  /** Null while the user still needs onboarding (no active organization). */
  organizationId?: string | null;
  /** True while signed in with a temporary password that must be replaced. */
  mustChangePassword?: boolean;
  /** True while any required document (Terms/Privacy) is unaccepted. */
  needsConsent?: boolean;
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
  /** True when authenticated but the user has no active organization yet. */
  needsOnboarding: boolean;
  /**
   * True when authenticated with a temporary password — the user must set a
   * real password before doing anything else (routes to /change-password).
   */
  needsPasswordChange: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  /**
   * True while sign-in is paused because the account has two-factor
   * authentication on: the password passed, the second factor has not.
   */
  twoFactorPending: boolean;
  /** Which second factor the paused sign-in expects: app code or emailed code. */
  twoFactorChannel: 'totp' | 'email' | null;
  /** Complete the pending sign-in with an authenticator or recovery code. */
  verifyTwoFactor: (input: { token?: string; recoveryCode?: string }) => Promise<AuthResponse>;
  /** Abandon the pending 2FA step and return to the password screen. */
  cancelTwoFactor: () => void;
  /**
   * Signup completes with `verificationRequired` — no session yet, the
   * emailed link must be clicked before onboarding can start.
   */
  signUp: (credentials: SignUpCredentials) => Promise<AuthResponse>;
  /**
   * True when the last sign-in attempt was refused because the address has
   * never verified — the sign-in form can offer a resend inline.
   */
  verificationNeeded: boolean;
  /** Redeem the emailed signup link: verifies the address and signs in. */
  verifyEmail: (token: string) => Promise<AuthResponse>;
  /** Ask for a fresh verification link (never reveals whether the account exists). */
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Set a new password with the single-use token from the reset email. */
  newPassword: (token: string, password: string) => Promise<void>;
  /**
   * Update the signed-in user's profile. Typed as the endpoint's allow-list
   * (name / avatar / phone) so callers physically cannot send `email`.
   */
  updateProfile: (data: UpdateProfileData) => Promise<void>;
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

  // Sign-in paused at the second factor (password already proven).
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  // Which factor the paused sign-in wants (email channel = code by email).
  const [twoFactorChannel, setTwoFactorChannel] = useState<'totp' | 'email' | null>(null);
  // Last sign-in was refused by the email-verification gate.
  const [verificationNeeded, setVerificationNeeded] = useState(false);

  // Derive onboarding state: authenticated but not yet attached to an org.
  const needsOnboarding = state.isAuthenticated && !state.user?.organizationId;

  // Forced password change (admin-issued temporary password) outranks
  // everything: no workspace actions until a real password is set.
  const needsPasswordChange = state.isAuthenticated && state.user?.mustChangePassword === true;

  const refreshSession = useCallback(async () => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      const response = await authAPI.getSession();
      
      if (response.success && response.user) {
        setState({
          user: {
            ...response.user,
            mustChangePassword: response.mustChangePassword,
            needsConsent: response.needsConsent,
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

  // Any full session supersedes a paused 2FA step (and vice versa): a failed
  // session restore must not leave the sign-in flow stuck on the code screen.
  useEffect(() => {
    if (state.isAuthenticated) setTwoFactorPending(false);
  }, [state.isAuthenticated]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      setVerificationNeeded(false);
      const response = await authAPI.login(credentials);

      // 2FA accounts: password proved, no session issued yet. Surface the
      // pending step instead of treating this as a completed sign-in.
      if (response.success && response.twoFactorRequired) {
        setTwoFactorPending(true);
        setTwoFactorChannel(response.twoFactorChannel ?? 'totp');
        setState((prev: AuthState) => ({ ...prev, isLoading: false, error: null }));
        return response;
      }

      if (response.success && response.user) {
        setTwoFactorPending(false);
        setTwoFactorChannel(null);
        setState({
          user: {
            ...response.user,
            mustChangePassword: response.mustChangePassword,
            needsConsent: response.needsConsent,
            organizationId: response.session?.organizationId,
            permissions: response.session?.permissions,
            roles: response.session?.roles,
          },
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
        // Returned so callers can route on the FRESH result (e.g. onboarding
        // when no organizationId) instead of stale render-time state.
        return response;
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      // Unverified address — keep the flag so the form can offer a resend.
      setVerificationNeeded(
        error instanceof AuthApiError && error.body.needsVerification === true
      );
      setState((prev: AuthState) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  }, [authAPI]);

  const signUp = useCallback(async (credentials: SignUpCredentials): Promise<AuthResponse> => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      const response = await authAPI.signUp(credentials);

      // Verified-by-link flow: account created, no session — the caller shows
      // "check your email" instead of routing to onboarding.
      if (response.success && response.verificationRequired) {
        setState((prev: AuthState) => ({ ...prev, isLoading: false, error: null }));
        return response;
      }

      if (response.success && response.user) {
        setState({
          user: {
            ...response.user,
            mustChangePassword: response.mustChangePassword,
            needsConsent: response.needsConsent,
            organizationId: response.session?.organizationId,
            permissions: response.session?.permissions,
            roles: response.session?.roles,
          },
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
        return response;
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

  /**
   * Redeem the emailed signup link. On success the server has set the
   * session cookie, so the local state is updated exactly like a login.
   */
  const verifyEmail = useCallback(
    async (token: string): Promise<AuthResponse> => {
      try {
        setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
        const response = await authAPI.verifyEmail(token);
        if (response.success && response.user) {
          setVerificationNeeded(false);
          setState({
          user: {
            ...response.user,
            mustChangePassword: response.mustChangePassword,
            needsConsent: response.needsConsent,
            organizationId: response.session?.organizationId,
            permissions: response.session?.permissions,
            roles: response.session?.roles,
          },
            isLoading: false,
            isAuthenticated: true,
            error: null,
          });
          return response;
        }
        throw new AuthApiError(response.error || 'Verification failed', 400, response);
      } catch (error) {
        setState((prev: AuthState) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Verification failed',
        }));
        throw error;
      }
    },
    [authAPI]
  );

  /**
   * Resend is intentionally stateless: the endpoint always answers success,
   * so there is no meaningful error state to hoist — callers surface the
   * rare network failure themselves.
   */
  const resendVerification = useCallback(
    async (email: string): Promise<void> => {
      await authAPI.resendVerification(email);
    },
    [authAPI]
  );

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setTwoFactorPending(false);
      setTwoFactorChannel(null);
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

  const newPassword = useCallback(async (token: string, password: string) => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      await authAPI.newPassword(token, password);
      setState((prev: AuthState) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev: AuthState) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Password could not be changed',
      }));
      throw error;
    }
  }, [authAPI]);

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
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
            mustChangePassword: response.mustChangePassword,
            needsConsent: response.needsConsent,
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

  const cancelTwoFactor = useCallback(() => {
    setTwoFactorPending(false);
    setTwoFactorChannel(null);
    setState((prev: AuthState) => ({ ...prev, isLoading: false, error: null }));
  }, []);

  const verifyTwoFactor = useCallback(async (input: { token?: string; recoveryCode?: string }) => {
    try {
      setState((prev: AuthState) => ({ ...prev, isLoading: true, error: null }));
      const response = await authAPI.verifyTwoFactor(input);

      if (response.success && response.user) {
        setTwoFactorPending(false);
        setTwoFactorChannel(null);
        setState({
          user: {
            ...response.user,
            mustChangePassword: response.mustChangePassword,
            needsConsent: response.needsConsent,
            organizationId: response.session?.organizationId,
            permissions: response.session?.permissions,
            roles: response.session?.roles,
          },
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
        return response;
      }
      throw new Error(response.error || 'Verification failed');
    } catch (error) {
      setState((prev: AuthState) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      }));
      throw error;
    }
  }, [authAPI]);

  const value: AuthContextValue = {
    ...state,
    needsOnboarding,
    needsPasswordChange,
    login,
    twoFactorPending,
    twoFactorChannel,
    verifyTwoFactor,
    cancelTwoFactor,
    signUp,
    verificationNeeded,
    verifyEmail,
    resendVerification,
    logout,
    resetPassword,
    newPassword,
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
