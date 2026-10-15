/**
 * Memory Cache Implementation
 * In-memory cache for authorization data
 */

import {
  AuthorizationCache,
  AuthorizationCacheEntry,
  AuthorizationCacheConfig,
} from './cache.interface';

export class MemoryAuthorizationCache implements AuthorizationCache {
  private cache: Map<string, AuthorizationCacheEntry> = new Map();
  private config: AuthorizationCacheConfig;

  constructor(config: Partial<AuthorizationCacheConfig> = {}) {
    this.config = {
      enabled: true,
      ttl: 300, // 5 minutes default
      strategy: 'memory',
      maxSize: 1000,
      ...config,
    };
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    if (!this.config.enabled) return;

    // Enforce size limit
    if (this.config.maxSize && this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const entry: AuthorizationCacheEntry<T> = {
      key,
      value,
      expiresAt: new Date(Date.now() + ttl * 1000),
    };

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async isHealthy(): Promise<boolean> {
    return true; // Memory cache is always healthy
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}
