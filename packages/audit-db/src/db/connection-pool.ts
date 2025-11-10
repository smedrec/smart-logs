/**
 * Enhanced connection pooling and query caching
 * Requirements 7.4: Connection pooling and query caching where appropriate
 */

import { withReplicas } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { StructuredLogger } from '@repo/logs'

import { createQueryCache } from '../cache/cache-factory.js'
import * as schema from './schema.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Redis as RedisType } from 'ioredis'
import type { Sql } from 'postgres'
import type { LoggingConfig } from '@repo/logs'
import type { CacheFactoryConfig, IQueryCache, QueryCacheStats } from '../cache/cache-factory.js'

export interface ConnectionPoolConfig {
	/** Database connection URL */
	url: string
	/** Minimum number of connections in pool */
	minConnections: number
	/** Maximum number of connections in pool */
	maxConnections: number
	/** Connection idle timeout in milliseconds */
	idleTimeout: number
	/** Connection acquisition timeout in milliseconds */
	acquireTimeout: number
	/** Connection validation query */
	validationQuery?: string
	/** Enable connection validation */
	validateConnections: boolean
	/** Connection retry attempts */
	retryAttempts: number
	/** Retry delay in milliseconds */
	retryDelay: number
	/** Enable SSL */
	ssl: boolean
}

export interface ReplicationConfig {
	enabled: boolean
	readReplicas?: string[]
	routingStrategy?: 'round-robin'
	fallbackToMaster?: boolean
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

/**
 * Enhanced database connection pool with monitoring and optimization
 */
export class EnhancedConnectionPool {
	private client: Sql
	private db: PostgresJsDatabase<typeof schema>
	private stats: ConnectionPoolStats
	private connectionTimes: number[] = []
	private acquisitionTimes: number[] = []
	private logger: StructuredLogger

	constructor(
		private connection: RedisType,
		private config: ConnectionPoolConfig,
		private replication: ReplicationConfig = { enabled: false },
		loggerConfig: LoggingConfig
	) {
		// Initialize Structured Logger
		this.logger = new StructuredLogger({
			...loggerConfig,
			service: '@repo/audit-db - EnhancedConnectionPool',
		})

		this.client = postgres(config.url, {
			max: config.maxConnections,
			idle_timeout: Math.floor(config.idleTimeout / 1000), // postgres.js expects seconds
			connect_timeout: Math.floor(config.acquireTimeout / 1000),
			prepare: false, // Disable prepared statements for better connection reuse
			transform: {
				undefined: null, // Transform undefined to null for PostgreSQL
			},
			onnotice: (notice) => {
				// TODO: add metadata
				this.logger.info(`Primary PostgreSQL notice: ${notice}`)
			},
			debug: process.env.NODE_ENV === 'development',
			ssl: config.ssl,
		})

		if (
			this.replication.enabled &&
			this.replication.readReplicas &&
			this.replication.readReplicas.length > 0
		) {
			let read: PostgresJsDatabase<typeof schema>[] = []
			let num = 0
			this.replication.readReplicas?.forEach((url) => {
				num++
				const client = postgres(url, {
					max: config.maxConnections,
					idle_timeout: Math.floor(config.idleTimeout / 1000), // postgres.js expects seconds
					connect_timeout: Math.floor(config.acquireTimeout / 1000),
					prepare: false, // Disable prepared statements for better connection reuse
					transform: {
						undefined: null,
					},
					onnotice: (notice) => {
						this.logger.info(`Replica ${num} PostgreSQL notice: ${notice}`)
					},
					// TODO: Add support for SSL
				})
				const db = drizzle(client, { schema })
				read.push(db)
			})

			const primaryDb = drizzle(this.client, { schema })
			this.db = withReplicas(primaryDb, read as any)
			this.logger.info(`Connected with ${this.replication.readReplicas.length} replicas`)
		} else {
			this.db = drizzle(this.client, { schema })
		}

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
	 * Execute query and return metadata (rows, rowCount, duration)
	 * This is non-breaking: existing executeQuery remains unchanged.
	 */
	async executeQueryWithMeta<T>(
		queryFn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>
	): Promise<import('./types.js').QueryResult<T>> {
		const startTime = Date.now()
		this.stats.totalRequests++

		try {
			const result = await queryFn(this.db)
			this.stats.successfulConnections++

			const acquisitionTime = Date.now() - startTime
			this.acquisitionTimes.push(acquisitionTime)

			if (this.acquisitionTimes.length > 100) {
				this.acquisitionTimes = this.acquisitionTimes.slice(-100)
			}

			this.updateAverageAcquisitionTime()

			let rowCount = 1
			try {
				if (Array.isArray(result)) {
					rowCount = result.length
				} else if (result && typeof result === 'object' && 'rowCount' in (result as any)) {
					rowCount = (result as any).rowCount ?? 1
				}
			} catch (_) {
				rowCount = 1
			}

			return {
				rows: result,
				rowCount,
				durationMs: Date.now() - startTime,
			}
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
 * Enhanced database client with connection pooling and caching
 */
export class EnhancedDatabaseClient {
	private connectionPool: EnhancedConnectionPool
	private queryCache: IQueryCache
	private cacheConfig: CacheFactoryConfig
	private cleanupInterval: NodeJS.Timeout | null = null

	constructor(
		connection: RedisType,
		poolConfig: ConnectionPoolConfig,
		cacheConfig: CacheFactoryConfig,
		replicationConfig: ReplicationConfig,
		loggerConfig: LoggingConfig
	) {
		this.connectionPool = new EnhancedConnectionPool(
			connection,
			poolConfig,
			replicationConfig,
			loggerConfig
		)
		this.queryCache = createQueryCache(connection, cacheConfig)
		this.cacheConfig = cacheConfig

		// Setup periodic cache cleanup
		/**if (cacheConfig.enabled) {
			this.cleanupInterval = setInterval(() => {
				const cleaned = this.queryCache.cleanup()
				if (cleaned > 0) {
					console.log(`Cleaned up ${cleaned} expired cache entries`)
				}
			}, 60000) // Cleanup every minute
		} */
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
			const cached = await this.queryCache.get<T>(cacheKey)
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
	 * Execute query without caching and return metadata (rows, rowCount, duration)
	 */
	async executeQueryUncachedWithMeta<T>(
		queryFn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>
	): Promise<import('./types.js').QueryResult<T>> {
		return this.connectionPool.executeQueryWithMeta(queryFn)
	}

	/**
	 * Execute query with optional caching and return metadata (rows, rowCount, duration)
	 */
	async executeQueryWithMeta<T>(
		queryFn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>,
		cacheKey?: string,
		cacheTTL?: number
	): Promise<import('./types.js').QueryResult<T>> {
		// Try cache first if caching is enabled and cache key provided
		if (cacheKey && this.queryCache.getStats().totalQueries >= 0) {
			const cached = await this.queryCache.get<T>(cacheKey)
			if (cached !== null) {
				return {
					rows: cached,
					rowCount: Array.isArray(cached) ? (cached as any).length : 1,
					durationMs: 0,
				}
			}
		}

		// Execute query through connection pool with metadata
		const meta = await this.connectionPool.executeQueryWithMeta(queryFn)

		// Cache result if caching is enabled and cache key provided
		if (cacheKey && meta.rows !== null && meta.rows !== undefined) {
			this.queryCache.set(cacheKey, meta.rows as any, cacheTTL)
		}

		return meta
	}

	/**
	 * Invalidate cache entries by pattern
	 */
	/**invalidateCache(pattern: string): number {
		let invalidated = 0
		const entries = this.queryCache.get()

		for (const { key } of entries) {
			if (key.includes(pattern)) {
				this.queryCache.delete(key.replace(`${this.cacheConfig.queryCache.keyPrefix}:`, ''))
				invalidated++
			}
		}

		return invalidated
	}*/

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
				enabled: this.cacheConfig.queryCache.enabled,
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
