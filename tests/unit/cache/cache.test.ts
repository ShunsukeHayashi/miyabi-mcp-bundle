/**
 * Tests for SimpleCache class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleCache, globalCache, resourceCacheKey, networkCacheKey, processCacheKey } from '../../../src/cache.js';

describe('SimpleCache', () => {
  let cache: SimpleCache;

  beforeEach(() => {
    cache = new SimpleCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should overwrite existing values', () => {
      cache.set('key', 'value1');
      cache.set('key', 'value2');
      expect(cache.get('key')).toBe('value2');
    });

    it('should store different types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('object', { foo: 'bar' });
      cache.set('array', [1, 2, 3]);
      cache.set('boolean', true);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
      expect(cache.get('boolean')).toBe(true);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      cache.set('key', 'value', 1000); // 1 second TTL
      expect(cache.get('key')).toBe('value');

      vi.advanceTimersByTime(999);
      expect(cache.get('key')).toBe('value');

      vi.advanceTimersByTime(2);
      expect(cache.get('key')).toBeNull();
    });

    it('should use default TTL when not specified', () => {
      const customCache = new SimpleCache({ defaultTTL: 2000 });
      customCache.set('key', 'value');

      vi.advanceTimersByTime(1999);
      expect(customCache.get('key')).toBe('value');

      vi.advanceTimersByTime(2);
      expect(customCache.get('key')).toBeNull();
    });

    it('should allow custom TTL per entry', () => {
      cache.set('short', 'value', 100);
      cache.set('long', 'value', 10000);

      vi.advanceTimersByTime(101);
      expect(cache.get('short')).toBeNull();
      expect(cache.get('long')).toBe('value');
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      const smallCache = new SimpleCache({ maxSize: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      smallCache.set('key4', 'value4'); // Should evict key1

      expect(smallCache.get('key1')).toBeNull();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');
    });

    it('should update LRU order on get', () => {
      const smallCache = new SimpleCache({ maxSize: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // Access key1 to move it to end
      smallCache.get('key1');

      smallCache.set('key4', 'value4'); // Should evict key2

      expect(smallCache.get('key1')).toBe('value1');
      expect(smallCache.get('key2')).toBeNull();
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');
    });
  });

  describe('delete and clear', () => {
    it('should delete specific entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should return false when deleting non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.size).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired keys', () => {
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      cache.set('key', 'value', 100);
      vi.advanceTimersByTime(101);
      expect(cache.has('key')).toBe(false);
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate entries matching pattern', () => {
      cache.set('user:1', 'data1');
      cache.set('user:2', 'data2');
      cache.set('post:1', 'data3');

      const count = cache.invalidatePattern(/^user:/);

      expect(count).toBe(2);
      expect(cache.get('user:1')).toBeNull();
      expect(cache.get('user:2')).toBeNull();
      expect(cache.get('post:1')).toBe('data3');
    });

    it('should return 0 when no matches', () => {
      cache.set('key1', 'value1');
      expect(cache.invalidatePattern(/^nonexistent/)).toBe(0);
    });
  });

  describe('invalidatePrefix', () => {
    it('should invalidate entries with prefix', () => {
      cache.set('cache:user:1', 'data1');
      cache.set('cache:user:2', 'data2');
      cache.set('cache:post:1', 'data3');

      const count = cache.invalidatePrefix('cache:user:');

      expect(count).toBe(2);
      expect(cache.get('cache:user:1')).toBeNull();
      expect(cache.get('cache:user:2')).toBeNull();
      expect(cache.get('cache:post:1')).toBe('data3');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cache.set('key', 'cached');
      const factory = vi.fn().mockResolvedValue('fresh');

      const result = await cache.getOrSet('key', factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const factory = vi.fn().mockResolvedValue('fresh');

      const result = await cache.getOrSet('key', factory);

      expect(result).toBe('fresh');
      expect(factory).toHaveBeenCalledOnce();
      expect(cache.get('key')).toBe('fresh');
    });

    it('should use custom TTL', async () => {
      const factory = vi.fn().mockResolvedValue('value');

      await cache.getOrSet('key', factory, 100);

      vi.advanceTimersByTime(101);
      expect(cache.get('key')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const customCache = new SimpleCache({ maxSize: 50, defaultTTL: 3000 });
      customCache.set('key1', 'value1');
      customCache.set('key2', 'value2');

      const stats = customCache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(50);
      expect(stats.defaultTTL).toBe(3000);
    });
  });
});

describe('Cache Key Builders', () => {
  describe('resourceCacheKey', () => {
    it('should create resource cache keys', () => {
      expect(resourceCacheKey('cpu')).toBe('resource:cpu');
      expect(resourceCacheKey('memory')).toBe('resource:memory');
    });
  });

  describe('networkCacheKey', () => {
    it('should create network cache keys', () => {
      expect(networkCacheKey('ping')).toBe('network:ping:');
      expect(networkCacheKey('dns', 'example.com')).toBe('network:dns:example.com');
      expect(networkCacheKey('ping', 'host', '3')).toBe('network:ping:host:3');
    });
  });

  describe('processCacheKey', () => {
    it('should create process cache keys', () => {
      expect(processCacheKey('list')).toBe('process:list');
      expect(processCacheKey('info', 1234)).toBe('process:info:1234');
    });
  });
});

describe('globalCache', () => {
  it('should be a SimpleCache instance', () => {
    expect(globalCache).toBeInstanceOf(SimpleCache);
  });

  it('should be usable for caching', () => {
    globalCache.set('test:key', 'test:value');
    expect(globalCache.get('test:key')).toBe('test:value');
    globalCache.delete('test:key');
  });
});
