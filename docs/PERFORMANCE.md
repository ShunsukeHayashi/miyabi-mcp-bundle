# Performance Guide

Optimization tips and best practices for Miyabi MCP Bundle.

## Built-in Caching

Miyabi MCP Bundle includes an intelligent caching system to reduce redundant operations.

### Cache TTLs

| Data Type | TTL | Reason |
|-----------|-----|--------|
| CPU stats | 2s | Frequently changes |
| Memory stats | 2s | Frequently changes |
| Disk stats | 10s | Slower to change |
| Network stats | 2s | Active monitoring |
| Process list | 3s | Moderate change rate |
| Network interfaces | 30s | Rarely changes |

### Cache Implementation

```typescript
// Internal cache with TTL support
class SimpleCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private defaultTTL: number;

  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttlMs?: number): void;
  invalidate(key: string): void;
  clear(): void;
}
```

### Manual Cache Control

For tools that support it:
```typescript
// Force fresh data (bypasses cache)
resource_cpu({ fresh: true })

// Use cached data if available
resource_cpu({})
```

## Parallel Operations

### When to Parallelize

**Good candidates for parallelization:**
- Multiple independent file reads
- Multiple git status checks
- Multiple network pings
- Multiple process info queries

**NOT suitable for parallelization:**
- Operations that depend on each other
- Rate-limited APIs (GitHub)
- Heavy I/O operations

### Parallel File Operations

```typescript
// Instead of sequential:
for (const file of files) {
  const stats = await file_stats({ path: file });
}

// Use parallel (internally optimized):
// file_duplicates uses p-limit for controlled concurrency
file_duplicates({ directory: '.', limit: 100 })
```

## Resource Limits

### Input Limits

Prevent excessive resource usage:

| Limit | Value | Purpose |
|-------|-------|---------|
| Query length | 1,000 chars | Prevent memory overflow |
| Path length | 4,096 chars | OS compatibility |
| Process list | 200 items | Response size |
| File read | 100 KB | Memory safety |
| Log entries | 100 lines | Response size |

### Timeouts

All operations have default timeouts:

| Operation | Timeout | Configurable |
|-----------|---------|--------------|
| Shell commands | 30s | No |
| Network requests | 30s | No |
| File operations | 10s | No |
| Git operations | 60s | No |

## Tool-Specific Optimization

### Git Tools

**git_log optimization:**
```typescript
// Slow: Fetch all history
git_log({ limit: 1000 })

// Fast: Fetch recent only
git_log({ limit: 20 })
```

**git_diff optimization:**
```typescript
// Slow: Full diff
git_diff({})

// Fast: Specific file
git_diff({ file: 'src/index.ts' })
```

### GitHub Tools

**Rate limiting:**
- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour

**Optimization tips:**
```typescript
// Use pagination wisely
github_list_issues({ per_page: 30 })  // Default, good balance

// Avoid large pages when possible
github_list_issues({ per_page: 100 }) // Slower response
```

### Resource Tools

**resource_overview vs individual tools:**
```typescript
// If you need multiple metrics:
resource_overview({})  // Single call, cached

// If you need only one metric:
resource_cpu({})  // Faster for single metric
```

### File Tools

**file_search optimization:**
```typescript
// Slow: Recursive with broad pattern
file_search({ pattern: '**/*' })

// Fast: Specific directory and pattern
file_search({ pattern: 'src/**/*.ts', directory: 'src' })
```

**file_duplicates optimization:**
```typescript
// Slow: Large directory, no limit
file_duplicates({ directory: '.' })

// Fast: Limited scope
file_duplicates({ directory: 'src', limit: 50 })
```

### Network Tools

**network_ping optimization:**
```typescript
// Slow: Many pings
network_ping({ host: 'example.com', count: 10 })

// Fast: Quick check
network_ping({ host: 'example.com', count: 1 })
```

### Process Tools

**process_list optimization:**
```typescript
// Slow: All processes
process_list({})

// Fast: Limited with sorting
process_list({ limit: 10, sort_by: 'cpu' })
```

## Memory Management

### Avoiding Memory Leaks

1. **Don't hold references to large results:**
   ```typescript
   // Bad: Storing all results
   const allLogs = await log_get_recent({ limit: 10000 });

   // Good: Process and discard
   const recentLogs = await log_get_recent({ limit: 100 });
   ```

2. **Use streaming for large data (when available):**
   ```typescript
   // For large files, use external tools
   // or paginate with offset/limit
   ```

### Process Pool Management

The server maintains lightweight state:
- Thinking sessions: Automatically cleaned after 1 hour
- Cache entries: LRU eviction at 100 entries
- No persistent connections held

## Benchmarks

Typical response times on modern hardware (M1 Mac):

| Tool | Cold Start | Cached |
|------|------------|--------|
| git_status | 50ms | N/A |
| resource_cpu | 100ms | 1ms |
| resource_memory | 80ms | 1ms |
| file_stats | 5ms | N/A |
| network_ping (1) | 100ms | N/A |
| process_list (10) | 50ms | 15ms |
| github_list_issues | 200ms | N/A |

## Monitoring Performance

### Using health_check

```typescript
health_check({})
```

Returns:
- System resource usage
- Response times
- Error rates

### Custom Monitoring

```typescript
// Monitor response times
const start = Date.now();
const result = await tool_name({});
console.log(`Took ${Date.now() - start}ms`);
```

## Production Recommendations

### For High-Volume Usage

1. **Configure environment variables:**
   ```bash
   # Increase Node.js memory if needed
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

2. **Use appropriate limits:**
   - Set reasonable `limit` parameters
   - Use `fresh: false` when stale data is acceptable

3. **Monitor resources:**
   - Use `resource_overview` periodically
   - Watch for memory growth

### For CI/CD Integration

1. **Minimize cold starts:**
   - Keep server running between calls
   - Pre-warm cache with common queries

2. **Batch operations:**
   - Group related queries
   - Use tools that return multiple data points

### For Development

1. **Enable debug logging:**
   ```bash
   DEBUG=miyabi:* npx miyabi-mcp-server
   ```

2. **Profile slow operations:**
   ```bash
   node --prof npx miyabi-mcp-server
   ```

## Future Optimizations

Planned improvements:
- [ ] Persistent disk cache for expensive operations
- [ ] WebSocket-based streaming for large results
- [ ] Configurable timeouts per tool
- [ ] Batch API for multiple tool calls
