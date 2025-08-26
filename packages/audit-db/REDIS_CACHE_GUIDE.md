# Redis-Based Distributed Query Caching

This guide explains how to use the Redis-based distributed caching system for database queries in the audit-db package.

## Overview

The Redis query cache provides:

- **Distributed caching** across multiple application instances
- **L1/L2 cache strategy** with local memory + Redis
- **Automatic cache invalidation** with TTL support
- **Performance monitoring** and statistics
- **Flexible configuration** for different environments

## Architecture

```
Application Instance 1    Application Instance 2    Application Instance N
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   L1 Cache (Local)  │  │   L1 Cache (Local)  │  │   L1 Cache (Local)  │
│   ┌─────────────┐   │  │   ┌─────────────┐   │  │   ┌─────────────┐   │
│   │ QueryCache  │   │  │   │ QueryCache  │   │  │   │ QueryCache  │   │
│   └─────────────┘   │  │   └─────────────┘   │  │   └─────────────┘   │
└─────────┬───────────┘  └─────────┬───────────┘  └─────────┬───────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     L2 Cache (Redis)        │
                    │  ┌─────────────────────────┐ │
                    │  │   Distributed Cache     │ │
                    │  │   - Shared across all   │ │
                    │  │     instances           │ │
                    │  │   - Persistent          │ │
                    │  │   - Scalable            │ │
                    │  └─────────────────────────┘ │
                    └─────────────────────────────┘
```

## Quick Start

### 1. Basic Setup

```typescript
import { createConnectionPool } from './db/connection-pool.js'
import { setupCachedQueryExecutor } from './examples/redis-cache-usage.js'

// Create database pool
const pool = createConnectionPool(dbConfig)

// Setup cached query executor
const executor = setupCachedQueryExecutor(pool, 'production')

// Execute cached queries
const users = await executor.query(
	'SELECT * FROM users WHERE active = $1',
	[true],
	{ ttl: 600 } // Cache for 10 minutes
)
```

### 2. Configuration

```typescript
import { createQueryCache } from './db/cache-factory.js'

const cacheConfig = {
	type: 'hybrid', // 'local' | 'redis' | 'hybrid'
	queryCache: {
		enabled: true,
		maxSizeMB: 500,
		defaultTTL: 900,
		maxQueries: 10000,
		keyPrefix: 'audit_query',
	},
	redis: {
		redisKeyPrefix: 'audit_cache',
		enableLocalCache: true,
		localCacheSizeMB: 100,
		enableCompression: true,
		serializationFormat: 'json',
	},
}

const cache = createQueryCache(cacheConfig)
```

## Cache Types

### Local Cache

- **Use case**: Development, single-instance deployments
- **Pros**: Fast, no network overhead, simple setup
- **Cons**: Not shared between instances, lost on restart

```typescript
const config = {
	type: 'local',
	queryCache: {
		enabled: true,
		maxSizeMB: 50,
		defaultTTL: 300,
		maxQueries: 1000,
		keyPrefix: 'dev_audit',
	},
}
```

### Redis Cache

- **Use case**: Multi-instance deployments, persistent caching
- **Pros**: Shared between instances, persistent, scalable
- **Cons**: Network latency, Redis dependency

```typescript
const config = {
	type: 'redis',
	queryCache: {
		/* ... */
	},
	redis: {
		redisKeyPrefix: 'audit_cache',
		enableLocalCache: false,
		enableCompression: true,
		serializationFormat: 'json',
	},
}
```

### Hybrid Cache (Recommended)

- **Use case**: Production deployments
- **Pros**: Best of both worlds - fast local access + shared persistence
- **Cons**: More complex, higher memory usage

```typescript
const config = {
	type: 'hybrid',
	queryCache: {
		/* ... */
	},
	redis: {
		redisKeyPrefix: 'audit_cache',
		enableLocalCache: true,
		localCacheSizeMB: 100,
		enableCompression: true,
		serializationFormat: 'json',
	},
}
```

## Usage Examples

### Basic Queries

```typescript
// Simple cached query
const result = await executor.query(
	'SELECT COUNT(*) FROM audit_events WHERE created_at > $1',
	[new Date('2024-01-01')],
	{ ttl: 600 }
)

// Skip cache for real-time data
const liveData = await executor.query('SELECT * FROM live_metrics', [], { skipCache: true })

// Force cache refresh
const freshData = await executor.query('SELECT * FROM user_stats', [], {
	refreshCache: true,
	ttl: 1800,
})
```

### Batch Queries

```typescript
const results = await executor.queryBatch([
	{
		sql: 'SELECT COUNT(*) FROM users',
		options: { cacheKey: 'user_count', ttl: 300 },
	},
	{
		sql: 'SELECT COUNT(*) FROM orders WHERE status = $1',
		params: ['completed'],
		options: { cacheKey: 'completed_orders', ttl: 600 },
	},
])
```

### Custom Cache Keys

```typescript
import { QueryCacheUtils } from './db/cached-query-executor.js'

// Table-based cache key
const cacheKey = QueryCacheUtils.createTableCacheKey('users', { active: true })

// Aggregation cache key
const aggKey = QueryCacheUtils.createAggregationCacheKey('orders', 'sum_revenue', ['status'], {
	date_range: '2024-01',
})

// Time-series cache key
const tsKey = QueryCacheUtils.createTimeSeriesCacheKey(
	'audit_events',
	'created_at',
	new Date('2024-01-01'),
	new Date('2024-01-02'),
	'hour'
)
```

## Monitoring and Metrics

### Cache Statistics

```typescript
const stats = executor.getCacheStats()
console.log({
	hitRatio: stats.hitRatio,
	totalQueries: stats.totalQueries,
	cacheHits: stats.cacheHits,
	cacheMisses: stats.cacheMisses,
	totalSizeMB: stats.totalSizeMB,
	averageQueryTime: stats.averageQueryTime,
	evictions: stats.evictions,
})
```

### Health Monitoring

```typescript
import { CacheMonitoringService } from './examples/redis-cache-usage.js'

const monitor = new CacheMonitoringService(executor)
const health = await monitor.checkCacheHealth()

if (health.health.status !== 'healthy') {
	console.warn('Cache health issues:', health.health.issues)
}
```

### Redis-Specific Metrics

```typescript
// For Redis cache instances
if (cache instanceof RedisQueryCache) {
	const redisInfo = await cache.getRedisInfo()
	console.log({
		keyCount: redisInfo.keyCount,
		memoryUsage: redisInfo.memoryUsage,
		hitRatio: redisInfo.hitRatio,
	})
}
```

## Cache Invalidation

### Manual Invalidation

```typescript
// Clear all cache
await executor.invalidateCache()

// Clear specific patterns (future enhancement)
await executor.invalidateCache('user:*')
```

### Automatic Cleanup

```typescript
// Cleanup expired entries
const cleaned = await executor.cleanupCache()
console.log(`Cleaned ${cleaned} expired entries`)

// Schedule regular cleanup
setInterval(
	async () => {
		await executor.cleanupCache()
	},
	5 * 60 * 1000
) // Every 5 minutes
```

### Event-Based Invalidation

```typescript
import { CacheInvalidationService } from './examples/redis-cache-usage.js'

const invalidation = new CacheInvalidationService(executor)

// Invalidate when data changes
await invalidation.onUserUpdate('user123')
await invalidation.onNewAuditEvent({ created_at: new Date() })
```

## Performance Optimization

### Cache Key Strategy

1. **Use consistent key patterns**

   ```typescript
   // Good: predictable, sortable
   const key = `table:users:filter:active=true:sort:name`

   // Bad: inconsistent, hard to manage
   const key = `users_active_true_by_name`
   ```

2. **Include relevant parameters**
   ```typescript
   // Include all parameters that affect results
   const key = QueryCacheUtils.createTableCacheKey('orders', {
   	status: 'completed',
   	date_from: '2024-01-01',
   	date_to: '2024-01-31',
   })
   ```

### TTL Strategy

```typescript
// Short TTL for frequently changing data
const recentOrders = await executor.query(sql, params, { ttl: 60 })

// Medium TTL for business data
const userStats = await executor.query(sql, params, { ttl: 600 })

// Long TTL for reference data
const categories = await executor.query(sql, params, { ttl: 3600 })
```

### Memory Management

```typescript
// Configure appropriate cache sizes
const config = {
	queryCache: {
		maxSizeMB: 500, // Total cache size
		maxQueries: 10000, // Maximum number of cached queries
	},
	redis: {
		localCacheSizeMB: 100, // L1 cache size (20% of total)
		enableCompression: true, // Compress large values
	},
}
```

## Environment Configuration

### Development

```typescript
const devConfig = {
	type: 'local',
	queryCache: {
		enabled: true,
		maxSizeMB: 50,
		defaultTTL: 300,
		maxQueries: 1000,
		keyPrefix: 'dev_audit',
	},
}
```

### Staging

```typescript
const stagingConfig = {
	type: 'hybrid',
	queryCache: {
		enabled: true,
		maxSizeMB: 200,
		defaultTTL: 600,
		maxQueries: 5000,
		keyPrefix: 'staging_audit',
	},
	redis: {
		redisKeyPrefix: 'staging_audit_cache',
		enableLocalCache: true,
		localCacheSizeMB: 50,
		enableCompression: true,
		serializationFormat: 'json',
	},
}
```

### Production

```typescript
const prodConfig = {
	type: 'hybrid',
	queryCache: {
		enabled: true,
		maxSizeMB: 500,
		defaultTTL: 900,
		maxQueries: 10000,
		keyPrefix: 'prod_audit',
	},
	redis: {
		redisKeyPrefix: 'prod_audit_cache',
		enableLocalCache: true,
		localCacheSizeMB: 100,
		enableCompression: true,
		serializationFormat: 'json',
	},
}
```

## Best Practices

### 1. Cache Appropriate Queries

- ✅ SELECT queries with stable results
- ✅ Aggregation queries
- ✅ Reference data lookups
- ❌ Queries with `NOW()`, `RANDOM()`
- ❌ INSERT, UPDATE, DELETE operations

### 2. Use Appropriate TTLs

- **Real-time data**: 30-60 seconds
- **Business metrics**: 5-15 minutes
- **Reference data**: 30-60 minutes
- **Historical data**: 1-24 hours

### 3. Monitor Performance

```typescript
// Set up monitoring
const monitor = new CacheMonitoringService(executor)

// Check health regularly
setInterval(async () => {
	const health = await monitor.checkCacheHealth()
	if (health.health.status !== 'healthy') {
		// Alert or take corrective action
	}
}, 60000) // Every minute
```

### 4. Handle Cache Failures Gracefully

```typescript
try {
	const result = await executor.query(sql, params, { ttl: 600 })
	return result
} catch (error) {
	// Cache failure shouldn't break the application
	console.error('Cache error:', error)
	return executor.query(sql, params, { skipCache: true })
}
```

## Troubleshooting

### Common Issues

1. **Low Hit Ratio**
   - Check if queries are cacheable
   - Verify TTL settings aren't too short
   - Review cache key generation

2. **High Memory Usage**
   - Reduce `maxSizeMB` setting
   - Enable compression
   - Implement more aggressive cleanup

3. **Redis Connection Issues**
   - Verify Redis server is running
   - Check `REDIS_URL` environment variable
   - Review Redis client configuration

### Debug Mode

```typescript
// Enable debug logging
const executor = new CachedQueryExecutor(pool, {
	...config,
	debug: true,
})

// Check cache entries
const entries = cache.getEntries() // For local cache
const redisInfo = await cache.getRedisInfo() // For Redis cache
```

## Migration Guide

### From Local to Redis Cache

1. **Update configuration**

   ```typescript
   // Before
   const config = { type: 'local', ... }

   // After
   const config = {
     type: 'hybrid',
     redis: { ... }
   }
   ```

2. **Test in staging environment**
3. **Monitor performance metrics**
4. **Gradually roll out to production**

### Backward Compatibility

The new Redis cache is fully backward compatible with the existing `QueryCache` class. Existing code will continue to work without changes.

## API Reference

See the TypeScript definitions in:

- `src/db/query-cache.ts` - Base cache interface
- `src/db/redis-query-cache.ts` - Redis implementation
- `src/db/cache-factory.ts` - Factory and configuration
- `src/db/cached-query-executor.ts` - Query executor with caching
