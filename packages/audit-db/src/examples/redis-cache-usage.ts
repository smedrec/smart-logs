/**
 * Example usage of Redis-based distributed query caching
 */
import type { LoggingConfig } from '@repo/logs'
import { DEFAULT_CACHE_CONFIGS } from '../cache/cache-factory.js'
import { CachedQueryExecutor, QueryCacheUtils } from '../cache/cached-query-executor.js'

import type { Redis as RedisType } from 'ioredis'
import type { Pool } from 'pg'

/**
 * Example: Setting up cached query executor
 */
export function setupCachedQueryExecutor(
	connection: RedisType,
	pool: Pool,
	loggerConfig: LoggingConfig,
	environment: 'development' | 'production' | 'test'
) {
	const cacheConfig = DEFAULT_CACHE_CONFIGS[environment]
	return new CachedQueryExecutor(connection, pool, cacheConfig, loggerConfig)
}

/**
 * Example: Basic cached queries
 */
export async function basicCachedQueries(executor: CachedQueryExecutor) {
	// Simple SELECT query - will be cached automatically
	const users = await executor.query(
		'SELECT id, name, email FROM users WHERE active = $1',
		[true],
		{ ttl: 600 } // Cache for 10 minutes
	)

	// Aggregation query with custom cache key
	const userStats = await executor.query(
		'SELECT COUNT(*) as total, AVG(age) as avg_age FROM users WHERE created_at > $1',
		[new Date('2024-01-01')],
		{
			cacheKey: QueryCacheUtils.createAggregationCacheKey('users', 'count_avg', undefined, {
				created_after: '2024-01-01',
			}),
			ttl: 1800, // Cache for 30 minutes
		}
	)

	// Time-series query
	const auditEvents = await executor.query(
		`SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*) as event_count 
		 FROM audit_events 
		 WHERE created_at BETWEEN $1 AND $2 
		 GROUP BY hour 
		 ORDER BY hour`,
		[new Date('2024-01-01'), new Date('2024-01-02')],
		{
			cacheKey: QueryCacheUtils.createTimeSeriesCacheKey(
				'audit_events',
				'created_at',
				new Date('2024-01-01'),
				new Date('2024-01-02'),
				'hour'
			),
			ttl: 3600, // Cache for 1 hour
		}
	)

	return { users, userStats, auditEvents }
}

/**
 * Example: Batch queries with caching
 */
export async function batchCachedQueries(executor: CachedQueryExecutor) {
	const queries = [
		{
			sql: 'SELECT COUNT(*) as total FROM users',
			options: {
				cacheKey: 'user_count',
				ttl: 300,
			},
		},
		{
			sql: 'SELECT COUNT(*) as total FROM audit_events WHERE created_at > $1',
			params: [new Date(Date.now() - 24 * 60 * 60 * 1000)], // Last 24 hours
			options: {
				cacheKey: 'recent_events_count',
				ttl: 600,
			},
		},
		{
			sql: 'SELECT status, COUNT(*) as count FROM orders GROUP BY status',
			options: {
				cacheKey: 'order_status_summary',
				ttl: 900,
			},
		},
	]

	return executor.queryBatch(queries)
}

/**
 * Example: Cache invalidation patterns
 */
export class CacheInvalidationService {
	constructor(private executor: CachedQueryExecutor) { }

	/**
	 * Invalidate user-related caches when user data changes
	 */
	async onUserUpdate(userId: string) {
		// In a real implementation, you'd track which cache keys
		// are related to specific users and invalidate them
		console.log(`Invalidating caches for user ${userId}`)

		// For now, we can clear specific known cache keys
		// or implement a tagging system for more sophisticated invalidation
	}

	/**
	 * Invalidate time-series caches when new events are added
	 */
	async onNewAuditEvent(event: { created_at: Date }) {
		// Invalidate recent time-series caches
		console.log('Invalidating recent audit event caches')

		// Clear caches for the current hour/day
		const now = new Date()
		const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())

		// Implementation would depend on your cache key strategy
	}

	/**
	 * Scheduled cache cleanup
	 */
	async scheduledCleanup() {
		const cleaned = await this.executor.cleanupCache()
		console.log(`Cleaned up ${cleaned} expired cache entries`)

		const stats = this.executor.getCacheStats()
		console.log('Cache stats:', stats)

		return { cleaned, stats }
	}
}

/**
 * Example: Monitoring and metrics
 */
export class CacheMonitoringService {
	constructor(private executor: CachedQueryExecutor) { }

	/**
	 * Get comprehensive cache metrics
	 */
	async getCacheMetrics() {
		const stats = this.executor.getCacheStats()

		return {
			hitRatio: stats.hitRatio,
			totalQueries: stats.totalQueries,
			cacheHits: stats.cacheHits,
			cacheMisses: stats.cacheMisses,
			totalSizeMB: stats.totalSizeMB,
			averageQueryTime: stats.averageQueryTime,
			evictions: stats.evictions,
			efficiency: stats.cacheHits > 0 ? (stats.cacheHits / stats.totalQueries) * 100 : 0,
		}
	}

	/**
	 * Check if cache performance is healthy
	 */
	async checkCacheHealth() {
		const metrics = await this.getCacheMetrics()

		const health = {
			status: 'healthy' as 'healthy' | 'warning' | 'critical',
			issues: [] as string[],
		}

		// Check hit ratio
		if (metrics.hitRatio < 30) {
			health.status = 'warning'
			health.issues.push(`Low hit ratio: ${metrics.hitRatio.toFixed(2)}%`)
		}

		// Check cache size
		if (metrics.totalSizeMB > 400) {
			// Assuming 500MB limit
			health.status = 'warning'
			health.issues.push(`High cache usage: ${metrics.totalSizeMB.toFixed(2)}MB`)
		}

		// Check eviction rate
		const evictionRate = metrics.evictions / metrics.totalQueries
		if (evictionRate > 0.1) {
			health.status = 'critical'
			health.issues.push(`High eviction rate: ${(evictionRate * 100).toFixed(2)}%`)
		}

		return { ...metrics, health }
	}
}

/**
 * Example: Configuration for different environments
 */
export const CACHE_CONFIGURATIONS = {
	development: {
		type: 'local' as const,
		queryCache: {
			enabled: true,
			maxSizeMB: 50,
			defaultTTL: 300,
			maxQueries: 1000,
			keyPrefix: 'dev_audit',
		},
	},

	staging: {
		type: 'hybrid' as const,
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
			serializationFormat: 'json' as const,
		},
	},

	production: {
		type: 'hybrid' as const,
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
			serializationFormat: 'json' as const,
		},
	},
} as const
