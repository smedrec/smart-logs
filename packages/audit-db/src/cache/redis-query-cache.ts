/**
 * Redis-based distributed query cache
 */
import { getSharedRedisConnection } from '@repo/redis-client'

import { QueryCache } from './query-cache.js'

import type { Redis } from 'ioredis'
import type { QueryCacheConfig } from '@repo/audit'
import type { CacheEntry, QueryCacheStats } from './query-cache.js'

export interface RedisQueryCacheConfig extends QueryCacheConfig {
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

/**
 * Distributed query cache using Redis with optional local L1 cache
 */
export class RedisQueryCache {
	private redis: Redis
	private localCache?: QueryCache
	private stats: QueryCacheStats
	private compressionThreshold = 1024 // Compress values larger than 1KB

	constructor(private config: RedisQueryCacheConfig) {
		this.redis = getSharedRedisConnection()

		// Initialize local L1 cache if enabled
		if (config.enableLocalCache) {
			const localConfig: QueryCacheConfig = {
				...config,
				maxSizeMB: config.localCacheSizeMB,
				maxQueries: Math.floor(config.maxQueries * 0.2), // 20% of total for local cache
			}
			this.localCache = new QueryCache(localConfig)
		}

		this.stats = {
			totalQueries: 0,
			cacheHits: 0,
			cacheMisses: 0,
			hitRatio: 0,
			totalSizeMB: 0,
			averageQueryTime: 0,
			evictions: 0,
		}
	}

	/**
	 * Get cached query result with L1/L2 cache strategy
	 */
	async get<T>(key: string): Promise<T | null> {
		const startTime = Date.now()
		this.stats.totalQueries++

		try {
			// Try L1 cache first if enabled
			if (this.localCache) {
				const localResult = this.localCache.get<T>(key)
				if (localResult !== null) {
					this.stats.cacheHits++
					this.updateStats(startTime)
					return localResult
				}
			}

			// Try Redis (L2 cache)
			const redisKey = this.getRedisKey(key)
			const redisValue = await this.redis.get(redisKey)

			if (!redisValue) {
				this.stats.cacheMisses++
				this.updateStats(startTime)
				return null
			}

			// Deserialize and decompress if needed
			const entry = await this.deserializeEntry<T>(redisValue)

			// Check TTL
			if (Date.now() - entry.timestamp > entry.ttl * 1000) {
				await this.redis.del(redisKey)
				this.stats.cacheMisses++
				this.updateStats(startTime)
				return null
			}

			// Update hit count in Redis
			entry.hits++
			await this.redis.set(redisKey, await this.serializeEntry(entry), 'EX', entry.ttl)

			// Store in L1 cache for future access
			if (this.localCache) {
				this.localCache.set(key, entry.data, entry.ttl)
			}

			this.stats.cacheHits++
			this.updateStats(startTime)
			return entry.data
		} catch (error) {
			console.error('Redis cache get error:', error)
			this.stats.cacheMisses++
			this.updateStats(startTime)
			return null
		}
	}

	/**
	 * Set cached query result in both L1 and L2 caches
	 */
	async set<T>(key: string, data: T, ttl?: number): Promise<void> {
		if (!this.config.enabled) return

		const entryTTL = ttl || this.config.defaultTTL
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl: entryTTL,
			hits: 0,
			size: this.estimateSize(data),
		}

		try {
			// Set in Redis (L2 cache)
			const redisKey = this.getRedisKey(key)
			const serializedEntry = await this.serializeEntry(entry)
			await this.redis.set(redisKey, serializedEntry, 'EX', entryTTL)

			// Set in local cache (L1 cache) if enabled
			if (this.localCache) {
				this.localCache.set(key, data, entryTTL)
			}

			// Update cache size tracking
			await this.updateRedisCacheSize(entry.size, 'add')
		} catch (error) {
			console.error('Redis cache set error:', error)
		}
	}

	/**
	 * Delete cached entry from both caches
	 */
	async delete(key: string): Promise<boolean> {
		try {
			const redisKey = this.getRedisKey(key)

			// Get entry size before deletion for size tracking
			const redisValue = await this.redis.get(redisKey)
			let entrySize = 0
			if (redisValue) {
				const entry = await this.deserializeEntry(redisValue)
				entrySize = entry.size
			}

			// Delete from Redis
			const redisDeleted = await this.redis.del(redisKey)

			// Delete from local cache
			let localDeleted = false
			if (this.localCache) {
				localDeleted = this.localCache.delete(key)
			}

			// Update size tracking
			if (redisDeleted > 0) {
				await this.updateRedisCacheSize(entrySize, 'remove')
			}

			return redisDeleted > 0 || localDeleted
		} catch (error) {
			console.error('Redis cache delete error:', error)
			return false
		}
	}

	/**
	 * Clear all cached entries
	 */
	async clear(): Promise<void> {
		try {
			// Clear Redis entries with our prefix
			const pattern = `${this.config.redisKeyPrefix}:*`
			const keys = await this.redis.keys(pattern)

			if (keys.length > 0) {
				await this.redis.del(...keys)
			}

			// Clear local cache
			if (this.localCache) {
				this.localCache.clear()
			}

			// Reset size tracking
			await this.redis.del(this.getSizeTrackingKey())
			this.stats.totalSizeMB = 0
		} catch (error) {
			console.error('Redis cache clear error:', error)
		}
	}

	/**
	 * Get cache statistics (combines local and Redis stats)
	 */
	getStats(): QueryCacheStats {
		const localStats = this.localCache?.getStats() || {
			totalQueries: 0,
			cacheHits: 0,
			cacheMisses: 0,
			hitRatio: 0,
			totalSizeMB: 0,
			averageQueryTime: 0,
			evictions: 0,
		}

		return {
			totalQueries: this.stats.totalQueries,
			cacheHits: this.stats.cacheHits + localStats.cacheHits,
			cacheMisses: this.stats.cacheMisses + localStats.cacheMisses,
			hitRatio: this.stats.hitRatio,
			totalSizeMB: this.stats.totalSizeMB + localStats.totalSizeMB,
			averageQueryTime: this.stats.averageQueryTime,
			evictions: this.stats.evictions + localStats.evictions,
		}
	}

	/**
	 * Cleanup expired entries in Redis
	 */
	async cleanup(): Promise<number> {
		try {
			const pattern = `${this.config.redisKeyPrefix}:*`
			const keys = await this.redis.keys(pattern)
			let cleaned = 0

			// Process in batches to avoid blocking Redis
			const batchSize = 100
			for (let i = 0; i < keys.length; i += batchSize) {
				const batch = keys.slice(i, i + batchSize)
				const pipeline = this.redis.pipeline()

				for (const key of batch) {
					pipeline.get(key)
				}

				const results = await pipeline.exec()
				if (!results) continue
				const now = Date.now()

				for (let j = 0; j < results.length; j++) {
					const [err, value] = results[j]
					if (!err && value) {
						try {
							const entry = await this.deserializeEntry(value as string)
							if (now - entry.timestamp > entry.ttl * 1000) {
								await this.redis.del(batch[j])
								cleaned++
							}
						} catch {
							// Invalid entry, delete it
							await this.redis.del(batch[j])
							cleaned++
						}
					}
				}
			}

			// Cleanup local cache
			if (this.localCache) {
				cleaned += this.localCache.cleanup()
			}

			return cleaned
		} catch (error) {
			console.error('Redis cache cleanup error:', error)
			return 0
		}
	}

	/**
	 * Get Redis-specific cache information
	 */
	async getRedisInfo(): Promise<{
		keyCount: number
		memoryUsage: string
		hitRatio: number
	}> {
		try {
			const pattern = `${this.config.redisKeyPrefix}:*`
			const keys = await this.redis.keys(pattern)
			const info = await this.redis.info('memory')

			return {
				keyCount: keys.length,
				memoryUsage: this.extractMemoryUsage(info),
				hitRatio: this.stats.hitRatio,
			}
		} catch (error) {
			console.error('Redis info error:', error)
			return {
				keyCount: 0,
				memoryUsage: 'unknown',
				hitRatio: 0,
			}
		}
	}

	/**
	 * Generate Redis key with prefix
	 */
	private getRedisKey(key: string): string {
		return `${this.config.redisKeyPrefix}:${this.config.keyPrefix}:${key}`
	}

	/**
	 * Get size tracking key
	 */
	private getSizeTrackingKey(): string {
		return `${this.config.redisKeyPrefix}:size_tracking`
	}

	/**
	 * Serialize cache entry for Redis storage
	 */
	private async serializeEntry<T>(entry: CacheEntry<T>): Promise<string> {
		const serialized = JSON.stringify(entry)

		if (this.config.enableCompression && serialized.length > this.compressionThreshold) {
			// In a real implementation, you'd use a compression library like zlib
			// For now, we'll just use JSON
			return `compressed:${serialized}`
		}

		return serialized
	}

	/**
	 * Deserialize cache entry from Redis
	 */
	private async deserializeEntry<T>(value: string): Promise<CacheEntry<T>> {
		if (value.startsWith('compressed:')) {
			// In a real implementation, you'd decompress here
			const compressed = value.slice(11)
			return JSON.parse(compressed)
		}

		return JSON.parse(value)
	}

	/**
	 * Estimate data size in bytes
	 */
	private estimateSize(data: any): number {
		try {
			return new Blob([JSON.stringify(data)]).size
		} catch {
			return JSON.stringify(data).length * 2
		}
	}

	/**
	 * Update Redis cache size tracking
	 */
	private async updateRedisCacheSize(size: number, operation: 'add' | 'remove'): Promise<void> {
		try {
			const sizeKey = this.getSizeTrackingKey()
			if (operation === 'add') {
				await this.redis.incrby(sizeKey, size)
			} else {
				await this.redis.decrby(sizeKey, size)
			}

			// Update local stats
			const totalSize = await this.redis.get(sizeKey)
			this.stats.totalSizeMB = totalSize ? parseInt(totalSize) / (1024 * 1024) : 0
		} catch (error) {
			console.error('Size tracking error:', error)
		}
	}

	/**
	 * Update performance stats
	 */
	private updateStats(startTime: number): void {
		const queryTime = Date.now() - startTime
		this.stats.averageQueryTime =
			(this.stats.averageQueryTime * (this.stats.totalQueries - 1) + queryTime) /
			this.stats.totalQueries

		if (this.stats.totalQueries > 0) {
			this.stats.hitRatio = (this.stats.cacheHits / this.stats.totalQueries) * 100
		}
	}

	/**
	 * Extract memory usage from Redis info
	 */
	private extractMemoryUsage(info: string): string {
		const match = info.match(/used_memory_human:(.+)/m)
		return match ? match[1].trim() : 'unknown'
	}
}
