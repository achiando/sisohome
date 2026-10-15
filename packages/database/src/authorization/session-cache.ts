/**
 * Session-Based Authorization Cache
 * Persists permissions and auth context across requests
 */

import { AuthorizationCache, AuthorizationCacheEntry } from '../cache/cache.interface';
import { AuthContext } from '../authentication/types';

// ============================================================================
// SESSION CACHE ENTRY
// ============================================================================

export interface SessionCacheEntry extends AuthorizationCacheEntry {
  authContext: AuthContext;
  permissions: string[];
  roles: string[];
  lastRefreshed: Date;
}

// ============================================================================
// SESSION CACHE
// ============================================================================

export class SessionAuthorizationCache implements AuthorizationCache {
  private cache: Map<string, SessionCacheEntry> = new Map();
  private ttl: number; // Time to live in seconds

  constructor(ttl: number = 300) {
    this.ttl = ttl;
  }

  /**
   * Get cached auth context and permissions for user
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set cached auth context and permissions
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    const entry: SessionCacheEntry = {
      key,
      value,
      expiresAt: new Date(Date.now() + ttl * 1000),
      authContext: (value as any).authContext,
      permissions: (value as any).permissions || [],
      roles: (value as any).roles || [],
      lastRefreshed: new Date(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete specific key
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Delete all keys matching prefix
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Check if cache is healthy
   */
  async isHealthy(): Promise<boolean> {
    return true;
  }

  /**
   * Get or create session entry for user
   */
  async getOrCreateSession(
    userId: string,
    organizationId: string | null
  ): Promise<SessionCacheEntry | null> {
    const key = this.buildSessionKey(userId, organizationId);
    const entry = this.cache.get(key);

    if (entry && entry.expiresAt > new Date()) {
      return entry;
    }

    return null;
  }

  /**
   * Update session with new permissions
   */
  async updateSession(
    userId: string,
    organizationId: string | null,
    authContext: AuthContext,
    permissions: string[],
    roles: string[]
  ): Promise<void> {
    const key = this.buildSessionKey(userId, organizationId);
    const value = { authContext, permissions, roles };

    await this.set(key, value, this.ttl);
  }

  /**
   * Invalidate user's sessions (all organizations)
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.deleteByPrefix(`session:${userId}:`);
  }

  /**
   * Invalidate specific organization session
   */
  async invalidateOrganization(userId: string, organizationId: string): Promise<void> {
    const key = this.buildSessionKey(userId, organizationId);
    await this.delete(key);
  }

  /**
   * Build session cache key
   */
  private buildSessionKey(userId: string, organizationId: string | null): string {
    return `session:${userId}:${organizationId || 'global'}`;
  }

  /**
   * Get all session keys for a user
   */
  getUserSessionKeys(userId: string): string[] {
    return Array.from(this.cache.keys()).filter(key =>
      key.startsWith(`session:${userId}:`)
    );
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
