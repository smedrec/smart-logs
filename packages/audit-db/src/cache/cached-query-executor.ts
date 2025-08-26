/**
 * Database query executor with caching support
 */
import crypto from 'crypto'

import { createQueryCache } from './cache-factory.js'

import type { Pool } from 'pg'
import type { CacheFactoryConfig, IQueryCache } from './cache-factory.js'

export interface QueryResult<T = any> {
	rows: T[]
	rowCount: number
	command: string
}

export interface CachedQueryOptions {
	/** Custom TTL for this query (overrides default) */
	ttl?: number
	/** Skip cache for this query */
	skipCache?: boolean
	/** Force refresh cache for this query */
	refreshCache?: boolean
	/** Custom cache key (auto-generated if not provided) */
	cacheKey?: string
}

/**
 * Database query executor with intelligent caching
 */
export class CachedQueryExecutor {
	private cache: IQueryCache

	constructor(
		private pool: Pool,
		cacheConfig: CacheFactoryConfig
	) {
		this.cache = createQueryCache(cacheConfig)
	}

	/**
	 * Execute a query with caching support
	 */
	async query<T = any>(
		sql: string,
		params: any[] = [],
		options: CachedQueryOptions = {}
	): Promise<QueryResult<T>> {
		const { ttl, skipCache = false, refreshCache = false, cacheKey: customKey } = options

		// Generate cache key
		const cacheKey = customKey || this.generateCacheKey(sql, params)

		// Skip cache if requested or for non-SELECT queries
		if (skipCache || !this.isCacheableQuery(sql)) {
			return this.executeQuery<T>(sql, params)
		}

		// Try to get from cache first (unless refreshing)
		if (!refreshCache) {
			const cached = await this.cache.get<QueryResult<T>>(cacheKey)
			if (cached) {
				return cached
			}
		}

		// Execute query and cache result
		const result = await this.executeQuery<T>(sql, params)

		// Only cache successful SELECT queries
		if (this.isCacheableQuery(sql) && result.rows) {
			await this.cache.set(cacheKey, result, ttl)
		}

		return result
	}

	/**
	 * Execute a batch of queries with caching
	 */
	async queryBatch<T = any>(
		queries: Array<{
			sql: string
			params?: any[]
			options?: CachedQueryOptions
		}>
	): Promise<QueryResult<T>[]> {
		const results: QueryResult<T>[] = []

		// Process queries in parallel where possible
		const promises = queries.map(({ sql, params = [], options = {} }) =>
			this.query<T>(sql, params, options)
		)

		return Promise.all(promises)
	}

	/**
	 * Invalidate cache entries by pattern
	 */
	async invalidateCache(pattern?: string): Promise<void> {
		if (pattern) {
			// For pattern-based invalidation, we'd need to implement
			// a more sophisticated cache key tracking system
			console.warn('Pattern-based cache invalidation not yet implemented')
		} else {
			await this.cache.clear()
		}
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats() {
		return this.cache.getStats()
	}

	/**
	 * Cleanup expired cache entries
	 */
	async cleanupCache(): Promise<number> {
		return this.cache.cleanup()
	}

	/**
	 * Execute query against database
	 */
	private async executeQuery<T>(sql: string, params: any[]): Promise<QueryResult<T>> {
		const client = await this.pool.connect()

		try {
			const result = await client.query(sql, params)
			return {
				rows: result.rows,
				rowCount: result.rowCount || 0,
				command: result.command,
			}
		} finally {
			client.release()
		}
	}

	/**
	 * Generate cache key from SQL and parameters
	 */
	private generateCacheKey(sql: string, params: any[]): string {
		const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase()
		const paramsStr = JSON.stringify(params)
		const combined = `${normalizedSql}:${paramsStr}`

		return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32)
	}

	/**
	 * Check if query is cacheable (SELECT queries only)
	 */
	private isCacheableQuery(sql: string): boolean {
		const normalizedSql = sql.trim().toLowerCase()
		return (
			normalizedSql.startsWith('select') &&
			!normalizedSql.includes('random()') &&
			!normalizedSql.includes('now()') &&
			!normalizedSql.includes('current_timestamp')
		)
	}
}

/**
 * Utility functions for common caching patterns
 */
export class QueryCacheUtils {
	/**
	 * Create cache key for table-based queries
	 */
	static createTableCacheKey(table: string, conditions: Record<string, any> = {}): string {
		const conditionsStr = Object.keys(conditions)
			.sort()
			.map((key) => `${key}:${conditions[key]}`)
			.join(',')

		return `table:${table}:${conditionsStr}`
	}

	/**
	 * Create cache key for aggregation queries
	 */
	static createAggregationCacheKey(
		table: string,
		aggregation: string,
		groupBy?: string[],
		conditions: Record<string, any> = {}
	): string {
		const groupByStr = groupBy ? groupBy.sort().join(',') : ''
		const conditionsStr = Object.keys(conditions)
			.sort()
			.map((key) => `${key}:${conditions[key]}`)
			.join(',')

		return `agg:${table}:${aggregation}:${groupByStr}:${conditionsStr}`
	}

	/**
	 * Create cache key for time-series queries
	 */
	static createTimeSeriesCacheKey(
		table: string,
		timeColumn: string,
		startTime: Date,
		endTime: Date,
		interval?: string
	): string {
		const start = startTime.toISOString()
		const end = endTime.toISOString()
		const intervalStr = interval || 'raw'

		return `timeseries:${table}:${timeColumn}:${start}:${end}:${intervalStr}`
	}
}
