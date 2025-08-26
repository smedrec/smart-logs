/**
 * Query cache
 */
import type { QueryCacheConfig } from '@repo/audit'

// Re-export distributed cache functionality
export { RedisQueryCache, type RedisQueryCacheConfig } from './redis-query-cache.js'
export { createQueryCache, type IQueryCache, DEFAULT_CACHE_CONFIGS } from './cache-factory.js'

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

/**
 * Query result cache with LRU eviction and TTL support
 */
export class QueryCache {
	private cache = new Map<string, CacheEntry>()
	private accessOrder: string[] = []
	private stats: QueryCacheStats

	constructor(private config: QueryCacheConfig) {
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
	 * Get cached query result
	 */
	get<T>(key: string): T | null {
		this.stats.totalQueries++

		const fullKey = `${this.config.keyPrefix}:${key}`
		const entry = this.cache.get(fullKey)

		if (!entry) {
			this.stats.cacheMisses++
			this.updateHitRatio()
			return null
		}

		// Check TTL
		if (Date.now() - entry.timestamp > entry.ttl * 1000) {
			this.cache.delete(fullKey)
			this.removeFromAccessOrder(fullKey)
			this.stats.cacheMisses++
			this.updateHitRatio()
			return null
		}

		// Update access order for LRU
		this.updateAccessOrder(fullKey)
		entry.hits++

		this.stats.cacheHits++
		this.updateHitRatio()

		return entry.data as T
	}

	/**
	 * Set cached query result
	 */
	set<T>(key: string, data: T, ttl?: number): void {
		if (!this.config.enabled) return

		const fullKey = `${this.config.keyPrefix}:${key}`
		const entryTTL = ttl || this.config.defaultTTL
		const dataSize = this.estimateSize(data)

		// Check if we need to evict entries
		this.evictIfNeeded(dataSize)

		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl: entryTTL,
			hits: 0,
			size: dataSize,
		}

		this.cache.set(fullKey, entry)
		this.updateAccessOrder(fullKey)
		this.updateTotalSize()
	}

	/**
	 * Delete cached entry
	 */
	delete(key: string): boolean {
		const fullKey = `${this.config.keyPrefix}:${key}`
		const deleted = this.cache.delete(fullKey)
		if (deleted) {
			this.removeFromAccessOrder(fullKey)
			this.updateTotalSize()
		}
		return deleted
	}

	/**
	 * Clear all cached entries
	 */
	clear(): void {
		this.cache.clear()
		this.accessOrder = []
		this.stats.totalSizeMB = 0
	}

	/**
	 * Get cache statistics
	 */
	getStats(): QueryCacheStats {
		return { ...this.stats }
	}

	/**
	 * Get cache entries for debugging
	 */
	getEntries(): Array<{ key: string; entry: CacheEntry }> {
		return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }))
	}

	/**
	 * Cleanup expired entries
	 */
	cleanup(): number {
		const now = Date.now()
		let cleaned = 0

		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > entry.ttl * 1000) {
				this.cache.delete(key)
				this.removeFromAccessOrder(key)
				cleaned++
			}
		}

		if (cleaned > 0) {
			this.updateTotalSize()
		}

		return cleaned
	}

	/**
	 * Evict entries if cache is too large
	 */
	private evictIfNeeded(newEntrySize: number): void {
		const maxSizeBytes = this.config.maxSizeMB * 1024 * 1024
		const currentSizeBytes = this.stats.totalSizeMB * 1024 * 1024

		// Evict LRU entries if needed
		while (
			(currentSizeBytes + newEntrySize > maxSizeBytes ||
				this.cache.size >= this.config.maxQueries) &&
			this.accessOrder.length > 0
		) {
			const lruKey = this.accessOrder[0]
			this.cache.delete(lruKey)
			this.removeFromAccessOrder(lruKey)
			this.stats.evictions++
		}

		this.updateTotalSize()
	}

	/**
	 * Update access order for LRU
	 */
	private updateAccessOrder(key: string): void {
		// Remove from current position
		this.removeFromAccessOrder(key)
		// Add to end (most recently used)
		this.accessOrder.push(key)
	}

	/**
	 * Remove from access order
	 */
	private removeFromAccessOrder(key: string): void {
		const index = this.accessOrder.indexOf(key)
		if (index > -1) {
			this.accessOrder.splice(index, 1)
		}
	}

	/**
	 * Estimate data size in bytes
	 */
	private estimateSize(data: any): number {
		try {
			return new Blob([JSON.stringify(data)]).size
		} catch {
			// Fallback estimation
			return JSON.stringify(data).length * 2 // Rough estimate for UTF-16
		}
	}

	/**
	 * Update total cache size
	 */
	private updateTotalSize(): void {
		let totalSize = 0
		for (const entry of this.cache.values()) {
			totalSize += entry.size
		}
		this.stats.totalSizeMB = totalSize / (1024 * 1024)
	}

	/**
	 * Update hit ratio
	 */
	private updateHitRatio(): void {
		if (this.stats.totalQueries > 0) {
			this.stats.hitRatio = (this.stats.cacheHits / this.stats.totalQueries) * 100
		}
	}
}
