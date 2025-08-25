/**
 * Enhanced connection pooling and query caching
 * Requirements 7.4: Connection pooling and query caching where appropriate
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'
import type { ConnectionPoolConfig, QueryCacheConfig } from '@repo/audit'

export interface CacheEntry<T = any> {
	data: T
	timestamp: number
	ttl: number
	hits: number
	size: number
}

export interface ConnectionPoolStats {
	totalConnections: number
	activeConnections: number
	idleConnections: number
	waitingRequests: number
	totalRequests: number
	successfulConnections: number
	failedConnections: number
	averageAcquisitionTime: number
	averageConnectionLifetime: number
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
 * Enhanced database connection pool with monitoring and optimization
 */
export class EnhancedConnectionPool {
	private client: Sql
	private db: PostgresJsDatabase<typeof schema>
	private stats: ConnectionPoolStats
	private connectionTimes: number[] = []
	private acquisitionTimes: number[] = []

	constructor(private config: ConnectionPoolConfig) {
		this.client = postgres(config.url, {
			max: config.maxConnections,
			idle_timeout: Math.floor(config.idleTimeout / 1000), // postgres.js expects seconds
			connect_timeout: Math.floor(config.acquireTimeout / 1000),
			prepare: false, // Disable prepared statements for better connection reuse
			transform: {
				undefined: null, // Transform undefined to null for PostgreSQL
			},
			onnotice: (notice) => {
				console.log('PostgreSQL notice:', notice)
			},
			debug: process.env.NODE_ENV === 'development',
			ssl: config.ssl,
		})

		this.db = drizzle(this.client, { schema })

		this.stats = {
			totalConnections: 0,
			activeConnections: 0,
			idleConnections: 0,
			waitingRequests: 0,
			totalRequests: 0,
			successfulConnections: 0,
			failedConnections: 0,
			averageAcquisitionTime: 0,
			averageConnectionLifetime: 0,
		}

		this.setupMonitoring()
	}

	/**
	 * Get database instance
	 */
	getDatabase(): PostgresJsDatabase<typeof schema> {
		return this.db
	}

	/**
	 * Get raw client for advanced operations
	 */
	getClient(): Sql {
		return this.client
	}

	/**
	 * Execute query with connection pool monitoring
	 */
	async executeQuery<T>(
		queryFn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>
	): Promise<T> {
		const startTime = Date.now()
		this.stats.totalRequests++

		try {
			const result = await queryFn(this.db)
			this.stats.successfulConnections++

			const acquisitionTime = Date.now() - startTime
			this.acquisitionTimes.push(acquisitionTime)

			// Keep only last 100 measurements for rolling average
			if (this.acquisitionTimes.length > 100) {
				this.acquisitionTimes = this.acquisitionTimes.slice(-100)
			}

			this.updateAverageAcquisitionTime()

			return result
		} catch (error) {
			this.stats.failedConnections++
			throw error
		}
	}

	/**
	 * Check connection health
	 */
	async healthCheck(): Promise<{
		healthy: boolean
		connectionTime: number
		error?: string
	}> {
		const startTime = Date.now()

		try {
			await this.client`SELECT 1 as health_check`
			const connectionTime = Date.now() - startTime

			return {
				healthy: true,
				connectionTime,
			}
		} catch (error) {
			return {
				healthy: false,
				connectionTime: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * Get connection pool statistics
	 */
	getStats(): ConnectionPoolStats {
		return { ...this.stats }
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = {
			totalConnections: 0,
			activeConnections: 0,
			idleConnections: 0,
			waitingRequests: 0,
			totalRequests: 0,
			successfulConnections: 0,
			failedConnections: 0,
			averageAcquisitionTime: 0,
			averageConnectionLifetime: 0,
		}
		this.acquisitionTimes = []
		this.connectionTimes = []
	}

	/**
	 * Close all connections
	 */
	async close(): Promise<void> {
		await this.client.end()
	}

	/**
	 * Setup connection monitoring
	 */
	private setupMonitoring(): void {
		// Monitor connection events if available
		// Note: postgres.js doesn't expose detailed connection events
		// This is a placeholder for future enhancement
	}

	/**
	 * Update average acquisition time
	 */
	private updateAverageAcquisitionTime(): void {
		if (this.acquisitionTimes.length > 0) {
			const sum = this.acquisitionTimes.reduce((a, b) => a + b, 0)
			this.stats.averageAcquisitionTime = sum / this.acquisitionTimes.length
		}
	}
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

/**
 * Enhanced database client with connection pooling and caching
 */
export class EnhancedDatabaseClient {
	private connectionPool: EnhancedConnectionPool
	private queryCache: QueryCache
	private cleanupInterval: NodeJS.Timeout | null = null

	constructor(poolConfig: ConnectionPoolConfig, cacheConfig: QueryCacheConfig) {
		this.connectionPool = new EnhancedConnectionPool(poolConfig)
		this.queryCache = new QueryCache(cacheConfig)

		// Setup periodic cache cleanup
		if (cacheConfig.enabled) {
			this.cleanupInterval = setInterval(() => {
				const cleaned = this.queryCache.cleanup()
				if (cleaned > 0) {
					console.log(`Cleaned up ${cleaned} expired cache entries`)
				}
			}, 60000) // Cleanup every minute
		}
	}

	/**
	 * Get database instance
	 */
	getDatabase(): PostgresJsDatabase<typeof schema> {
		return this.connectionPool.getDatabase()
	}

	/**
	 * Execute query with optional caching
	 */
	async executeQuery<T>(
		queryFn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>,
		cacheKey?: string,
		cacheTTL?: number
	): Promise<T> {
		// Try cache first if caching is enabled and cache key provided
		if (cacheKey && this.queryCache.getStats().totalQueries >= 0) {
			const cached = this.queryCache.get<T>(cacheKey)
			if (cached !== null) {
				return cached
			}
		}

		// Execute query through connection pool
		const result = await this.connectionPool.executeQuery(queryFn)

		// Cache result if caching is enabled and cache key provided
		if (cacheKey && result !== null && result !== undefined) {
			this.queryCache.set(cacheKey, result, cacheTTL)
		}

		return result
	}

	/**
	 * Execute query without caching
	 */
	async executeQueryUncached<T>(
		queryFn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>
	): Promise<T> {
		return this.connectionPool.executeQuery(queryFn)
	}

	/**
	 * Invalidate cache entries by pattern
	 */
	invalidateCache(pattern: string): number {
		let invalidated = 0
		const entries = this.queryCache.getEntries()

		for (const { key } of entries) {
			if (key.includes(pattern)) {
				this.queryCache.delete(key.replace(`${this.queryCache['config'].keyPrefix}:`, ''))
				invalidated++
			}
		}

		return invalidated
	}

	/**
	 * Get performance statistics
	 */
	getStats(): {
		connectionPool: ConnectionPoolStats
		queryCache: QueryCacheStats
	} {
		return {
			connectionPool: this.connectionPool.getStats(),
			queryCache: this.queryCache.getStats(),
		}
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<{
		connectionPool: { healthy: boolean; connectionTime: number; error?: string }
		queryCache: { enabled: boolean; hitRatio: number; sizeMB: number }
	}> {
		const poolHealth = await this.connectionPool.healthCheck()
		const cacheStats = this.queryCache.getStats()

		return {
			connectionPool: poolHealth,
			queryCache: {
				enabled: this.queryCache['config'].enabled,
				hitRatio: cacheStats.hitRatio,
				sizeMB: cacheStats.totalSizeMB,
			},
		}
	}

	/**
	 * Close connections and cleanup
	 */
	async close(): Promise<void> {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
		}

		this.queryCache.clear()
		await this.connectionPool.close()
	}
}
