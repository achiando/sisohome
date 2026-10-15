/**
 * Authorization Cache Interface
 * Abstract cache layer for authorization data
 */

// ============================================================================
// CACHE INTERFACE
// ============================================================================

export interface AuthorizationCache {
  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  set<T>(key: string, value: T, ttl: number): Promise<void>;

  /**
   * Delete specific key from cache
   * @param key - Cache key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Delete all keys matching prefix
   * @param prefix - Key prefix to match
   */
  deleteByPrefix(prefix: string): Promise<void>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Check if cache is healthy/available
   * @returns true if cache is operational
   */
  isHealthy(): Promise<boolean>;
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export interface AuthorizationCacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize?: number; // For in-memory cache
  strategy: 'memory' | 'redis' | 'database';
}

// ============================================================================
// CACHE ENTRY
// ============================================================================

export interface AuthorizationCacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: Date;
  metadata?: Record<string, any>;
}
