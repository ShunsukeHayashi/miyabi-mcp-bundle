
/**
 * Miyabi MCP Bundle - Shared Cache
 * 
 * Simple in-memory cache for resource and network tools.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

export class SimpleCache {
    private cache = new Map<string, CacheEntry<unknown>>();

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlMs: number = 5000): void {
        this.cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
    }

    clear(): void {
        this.cache.clear();
    }
}

// Export singleton instance
export const sharedCache = new SimpleCache();
