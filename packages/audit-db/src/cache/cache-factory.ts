import { OptimizedLRUCache } from './optimized-lru-cache.js'
import { QueryCache } from './query-cache.js'
import { RedisQueryCache } from './redis-query-cache.js'

import type { Redis as RedisType } from 'ioredis'
import type { RedisQueryCacheConfig } from './redis-query-cache.js'

/**
 * Cache factory for creating appropriate cache instances
 */

export type CacheType = 'local' | 'redis' | 'hybrid'

export interface CacheEntry<T = any> {
	data: T
	timestamp: number
	ttl: number
	hits: number
	size: number
}

export interface QueryCacheStats {
	totalQueries: number
	cacheHits: number
	cacheMisses: number
	hitRatio: number
	totalSizeMB: number
	averageQueryTime: number
	evictions: number
}

export interface QueryCacheConfig {
	/** Enable query result caching */
	enabled: boolean
	/** Maximum cache size in MB */
	maxSizeMB: number
	/** Default TTL for cached queries in seconds */
	defaultTTL: number
	/** Maximum number of cached queries */
	maxQueries: number
	/** Cache key prefix */
	keyPrefix: string
}

export interface CacheFactoryConfig {
	/** Cache type */
	type: CacheType
	queryCache: QueryCacheConfig
	redis?: {
		/** Redis key prefix for distributed cache */
		redisKeyPrefix: string
		/** Enable local cache as L1 cache (Redis as L2) */
		enableLocalCache: boolean
		/** Local cache size limit (smaller than main cache) */
		localCacheSizeMB: number
		/** Compression for large values */
		enableCompression: boolean
		/** Serialization format */
		serializationFormat: 'json' | 'msgpack'
	}
}

/**
 * Cache interface that both local and Redis caches implement
 */
export interface IQueryCache {
	get<T>(key: string): Promise<T | null> | T | null
	set<T>(key: string, data: T, ttl?: number): Promise<void> | void
	delete(key: string): Promise<boolean> | boolean
	clear(): Promise<void> | void
	getStats(): QueryCacheStats
	cleanup(): Promise<number> | number
}

/**
 * Factory function to create appropriate cache instance
 */
export function createQueryCache(connection: RedisType, config: CacheFactoryConfig): IQueryCache {
	switch (config.type) {
		case 'local':
			return new LocalCacheAdapter(
				new OptimizedLRUCache({
					enabled: config.queryCache.enabled,
					maxSizeMB: config.queryCache.maxSizeMB,
					defaultTTL: config.queryCache.defaultTTL,
					keyPrefix: config.queryCache.keyPrefix,
					maxKeys: config.queryCache.maxQueries,
					cleanupInterval: 60000,
				})
			)

		case 'redis':
			if (!config.redis) {
				throw new Error('Redis configuration required for Redis cache type')
			}

			const redisConfig: RedisQueryCacheConfig = {
				...config.queryCache,
				...config.redis,
				enableLocalCache: false, // Pure Redis mode
			}

			return new RedisQueryCache(connection, redisConfig)

		case 'hybrid':
			if (!config.redis) {
				throw new Error('Redis configuration required for hybrid cache type')
			}

			const hybridConfig: RedisQueryCacheConfig = {
				...config.queryCache,
				...config.redis,
				enableLocalCache: true, // Enable L1 cache
			}

			return new RedisQueryCache(connection, hybridConfig)

		default:
			throw new Error(`Unknown cache type: ${config.type}`)
	}
}

/**
 * Adapter to make local cache async-compatible
 */
class LocalCacheAdapter implements IQueryCache {
	constructor(private cache: OptimizedLRUCache) {}

	async get<T>(key: string): Promise<T | null> {
		return this.cache.get<T>(key)
	}

	async set<T>(key: string, data: T, ttl?: number): Promise<void> {
		return this.cache.set(key, data, ttl)
	}

	async delete(key: string): Promise<boolean> {
		return this.cache.delete(key)
	}

	async clear(): Promise<void> {
		return this.cache.clear()
	}

	getStats() {
		return this.cache.getStats()
	}

	async cleanup(): Promise<number> {
		return this.cache.cleanup()
	}
}

/**
 * Default cache configurations for different environments
 */
export const DEFAULT_CACHE_CONFIGS = {
	development: {
		type: 'local' as CacheType,
		queryCache: {
			enabled: true,
			maxSizeMB: 50,
			defaultTTL: 300, // 5 minutes
			maxQueries: 1000,
			keyPrefix: 'dev_audit_query',
		},
	},

	production: {
		type: 'hybrid' as CacheType,
		queryCache: {
			enabled: true,
			maxSizeMB: 500,
			defaultTTL: 900, // 15 minutes
			maxQueries: 10000,
			keyPrefix: 'prod_audit_query',
		},
		redis: {
			redisKeyPrefix: 'audit_cache',
			enableLocalCache: true,
			localCacheSizeMB: 100,
			enableCompression: true,
			serializationFormat: 'json' as const,
		},
	},

	test: {
		type: 'local' as CacheType,
		queryCache: {
			enabled: true,
			maxSizeMB: 10,
			defaultTTL: 60, // 1 minute
			maxQueries: 100,
			keyPrefix: 'test_audit_query',
		},
	},
} as const
