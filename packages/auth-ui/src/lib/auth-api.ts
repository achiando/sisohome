/**
 * Auth API client for authentication operations
 * Integrates with @workspace/database authorization system
 */

export interface AuthResponse {
  success: boolean;
  /** Present on signup — the client should route to /onboarding. */
  onboardingRequired?: boolean;
  /** True when the user must change a temporary password before proceeding. */
  mustChangePassword?: boolean;
  /**
   * Password accepted for an account with 2FA on — no session yet; the
   * client must collect a second-factor code and call verifyTwoFactor().
   */
  twoFactorRequired?: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    phone?: string | null;
    twoFactorEnabled?: boolean;
    twoFactorMethod?: 'TOTP' | 'SMS' | 'EMAIL' | null;
  };
  session?: {
    /** The session token lives in an httpOnly cookie and is never returned here. */
    expiresAt: string;
    organizationId?: string | null;
    permissions?: string[];
    roles?: string[];
  };
  error?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  name: string;
}

export interface ResetPasswordCredentials {
  email: string;
}

export interface UpdateProfileData {
  name?: string;
  avatar?: string;
  /** Contact number. Deliberately no `email` — identity is immutable. */
  phone?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export class AuthAPI {
  private baseURL: string;

  constructor(baseURL: string = '/api/auth') {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>('/signup', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/logout', {
      method: 'POST',
    });
  }

  async resetPassword(credentials: ResetPasswordCredentials): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/reset-password', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async newPassword(
    token: string,
    password: string
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/new-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async getProfile(): Promise<AuthResponse> {
    return this.request<AuthResponse>('/profile');
  }

  /** Step 2 of sign-in for 2FA accounts: live authenticator code or a recovery code. */
  async verifyTwoFactor(input: { token?: string; recoveryCode?: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/2fa/verify', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateProfile(data: UpdateProfileData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: ChangePasswordData): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSession(): Promise<AuthResponse> {
    return this.request<AuthResponse>('/session');
  }

  async switchOrganization(organizationId: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/switch-organization', {
      method: 'POST',
      body: JSON.stringify({ organizationId }),
    });
  }
}

// Singleton instance
let authAPIInstance: AuthAPI | null = null;

export function getAuthAPI(baseURL?: string): AuthAPI {
  if (!authAPIInstance) {
    authAPIInstance = new AuthAPI(baseURL);
  }
  return authAPIInstance;
}
