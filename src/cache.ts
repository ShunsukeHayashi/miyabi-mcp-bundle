/**
 * Miyabi MCP Bundle - Cache System
 *
 * LRU cache with TTL support for reducing redundant operations.
 */

import { CacheEntry, CacheConfig } from './types.js';
import { CACHE_MAX_SIZE, CACHE_TTL } from './constants.js';

/**
 * Enhanced LRU cache with TTL support
 */
export class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? CACHE_MAX_SIZE,
      defaultTTL: config.defaultTTL ?? CACHE_TTL.default,
    };
  }

  /**
   * Get value from cache
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end for LRU ordering
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  /**
   * Set value in cache with optional TTL
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    // LRU eviction: remove oldest entry if at capacity
    if (this.cache.size >= this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs ?? this.config.defaultTTL,
    });
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set value using factory function
   * If cached value exists and not expired, returns it
   * Otherwise, calls factory, caches result, and returns it
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, ttlMs);
    return data;
  }

  /**
   * Invalidate entries matching a pattern
   * @returns Number of entries invalidated
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalidate entries with a prefix
   * @returns Number of entries invalidated
   */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    defaultTTL: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      defaultTTL: this.config.defaultTTL,
    };
  }
}

// ========== Singleton Cache Instance ==========

/**
 * Global cache instance for the MCP server
 */
export const globalCache = new SimpleCache();

// ========== Cache Key Builders ==========

/**
 * Build cache key for resource operations
 */
export function resourceCacheKey(operation: string): string {
  return `resource:${operation}`;
}

/**
 * Build cache key for network operations
 */
export function networkCacheKey(operation: string, ...args: string[]): string {
  return `network:${operation}:${args.join(':')}`;
}

/**
 * Build cache key for process operations
 */
export function processCacheKey(operation: string, pid?: number): string {
  return pid ? `process:${operation}:${pid}` : `process:${operation}`;
}
