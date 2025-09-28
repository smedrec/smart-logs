import { createHash } from 'crypto'

import type { Context } from 'hono'
import type { PerformanceConfig } from '@repo/audit'
import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'
import type { StructuredLogger } from '@repo/logs'
import type { Redis } from '@repo/redis-client'

/**
 * Performance optimization service for the production server
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: Complete performance optimization implementation
 */

export interface PaginationOptions {
	limit?: number
	offset?: number
	cursor?: string
	sort?: {
		field: string
		direction: 'asc' | 'desc'
	}
}

export interface PaginatedResponse<T> {
	data: T[]
	pagination: {
		total?: number
		limit: number
		offset?: number
		cursor?: string
		hasNext: boolean
		hasPrevious: boolean
		nextCursor?: string
		previousCursor?: string
	}
}

export interface StreamingOptions {
	chunkSize?: number
	format?: 'json' | 'csv' | 'ndjson'
	compression?: boolean
}

export interface PerformanceMetrics {
	timestamp: Date
	requestsPerSecond: number
	averageResponseTime: number
	memoryUsage: {
		used: number
		total: number
		percentage: number
	}
	cacheStats: {
		hitRatio: number
		totalRequests: number
		totalHits: number
		totalMisses: number
	}
	concurrency: {
		activeRequests: number
		queuedRequests: number
		maxConcurrentRequests: number
	}
	slowRequests: {
		count: number
		averageTime: number
		slowestEndpoints: Array<{
			endpoint: string
			averageTime: number
			count: number
		}>
	}
}

/**
 * Request queue for managing concurrent requests
 */
class RequestQueue {
	private queue: Array<{
		resolve: (value: any) => void
		reject: (error: Error) => void
		fn: () => Promise<any>
		timestamp: number
	}> = []
	private activeRequests = 0

	constructor(
		private maxConcurrent: number,
		private timeout: number
	) {}

	async execute<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const request = {
				resolve,
				reject,
				fn,
				timestamp: Date.now(),
			}

			this.queue.push(request)
			this.processQueue()
		})
	}

	private async processQueue(): Promise<void> {
		if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
			return
		}

		const request = this.queue.shift()
		if (!request) return

		// Check timeout
		if (Date.now() - request.timestamp > this.timeout) {
			request.reject(new Error('Request timeout in queue'))
			this.processQueue()
			return
		}

		this.activeRequests++

		try {
			const result = await request.fn()
			request.resolve(result)
		} catch (error) {
			request.reject(error instanceof Error ? error : new Error('Unknown error'))
		} finally {
			this.activeRequests--
			this.processQueue()
		}
	}

	getStats() {
		return {
			activeRequests: this.activeRequests,
			queuedRequests: this.queue.length,
			maxConcurrentRequests: this.maxConcurrent,
		}
	}
}

/**
 * Response cache for frequently accessed data
 */
class ResponseCache {
	private readonly keyPrefix: string
	private stats = {
		totalRequests: 0,
		totalHits: 0,
		totalMisses: 0,
		excludedRequests: 0,
	}

	constructor(
		private redis: Redis,
		private config: PerformanceConfig['responseCache']
	) {
		this.keyPrefix = config.keyPrefix
	}

	/**
	 * Check if endpoint should be excluded from caching
	 */
	private shouldExcludeFromCache(endpoint: string): boolean {
		if (!this.config.excludeEndpoints && !this.config.disableCachePatterns) {
			return false
		}

		// Check exact matches in excludeEndpoints
		if (this.config.excludeEndpoints?.includes(endpoint)) {
			return true
		}

		// Check pattern matches in disableCachePatterns
		if (this.config.disableCachePatterns) {
			for (const pattern of this.config.disableCachePatterns) {
				if (this.matchesPattern(endpoint, pattern)) {
					return true
				}
			}
		}

		return false
	}

	/**
	 * Get TTL for specific endpoint (with overrides)
	 */
	private getTTLForEndpoint(endpoint: string, defaultTTL?: number): number {
		const baseTTL = defaultTTL || this.config.defaultTTL

		if (!this.config.endpointTTLOverrides) {
			return baseTTL
		}

		// Check for exact match first
		if (this.config.endpointTTLOverrides[endpoint]) {
			return this.config.endpointTTLOverrides[endpoint]
		}

		// Check for pattern matches
		for (const [pattern, ttl] of Object.entries(this.config.endpointTTLOverrides)) {
			if (this.matchesPattern(endpoint, pattern)) {
				return ttl
			}
		}

		return baseTTL
	}

	/**
	 * Simple pattern matching (supports * wildcards)
	 */
	private matchesPattern(text: string, pattern: string): boolean {
		// Convert pattern to regex
		const regexPattern = pattern
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
			.replace(/\\\*/g, '.*') // Convert * to .*

		const regex = new RegExp(`^${regexPattern}$`, 'i')
		return regex.test(text)
	}

	async get<T>(key: string, endpoint?: string): Promise<T | null> {
		if (!this.config.enabled) return null

		this.stats.totalRequests++

		// Check if endpoint should be excluded from caching
		if (endpoint && this.shouldExcludeFromCache(endpoint)) {
			this.stats.excludedRequests++
			return null
		}

		try {
			const fullKey = `${this.keyPrefix}:${key}`
			const cached = await this.redis.get(fullKey)

			if (cached) {
				this.stats.totalHits++
				return JSON.parse(cached)
			}

			this.stats.totalMisses++
			return null
		} catch (error) {
			console.error('Cache get error:', error)
			this.stats.totalMisses++
			return null
		}
	}

	async set<T>(key: string, value: T, ttl?: number, endpoint?: string): Promise<void> {
		if (!this.config.enabled) return

		// Check if endpoint should be excluded from caching
		if (endpoint && this.shouldExcludeFromCache(endpoint)) {
			return
		}

		try {
			const fullKey = `${this.keyPrefix}:${key}`
			const serialized = JSON.stringify(value)
			const cacheTTL = endpoint
				? this.getTTLForEndpoint(endpoint, ttl)
				: ttl || this.config.defaultTTL

			await this.redis.setex(fullKey, cacheTTL, serialized)
		} catch (error) {
			console.error('Cache set error:', error)
		}
	}

	async invalidate(pattern: string): Promise<number> {
		if (!this.config.enabled) return 0

		try {
			const fullPattern = `${this.keyPrefix}:${pattern}`
			const keys = await this.redis.keys(fullPattern)

			if (keys.length > 0) {
				return await this.redis.del(...keys)
			}

			return 0
		} catch (error) {
			console.error('Cache invalidation error:', error)
			return 0
		}
	}

	getStats() {
		const eligibleRequests = this.stats.totalRequests - this.stats.excludedRequests
		return {
			...this.stats,
			hitRatio: eligibleRequests > 0 ? (this.stats.totalHits / eligibleRequests) * 100 : 0,
			exclusionRatio:
				this.stats.totalRequests > 0
					? (this.stats.excludedRequests / this.stats.totalRequests) * 100
					: 0,
		}
	}
}

/**
 * Performance optimization service
 */
export class PerformanceService {
	private responseCache: ResponseCache
	private requestQueue: RequestQueue
	private metrics: {
		requests: Array<{ timestamp: number; duration: number; endpoint: string }>
		startTime: number
	}

	constructor(
		private redis: Redis,
		private dbClient: EnhancedAuditDatabaseClient,
		private logger: StructuredLogger,
		private config: PerformanceConfig
	) {
		this.responseCache = new ResponseCache(redis, config.responseCache)
		this.requestQueue = new RequestQueue(
			config.concurrency.maxConcurrentRequests,
			config.concurrency.queueTimeout
		)
		this.metrics = {
			requests: [],
			startTime: Date.now(),
		}
	}

	/**
	 * Execute request with performance optimizations
	 */
	async executeOptimized<T>(
		fn: () => Promise<T>,
		options?: {
			cacheKey?: string
			cacheTTL?: number
			skipCache?: boolean
			skipQueue?: boolean
			endpoint?: string
		}
	): Promise<T> {
		const { cacheKey, cacheTTL, skipCache = false, skipQueue = false, endpoint } = options || {}

		// Try cache first
		if (!skipCache && cacheKey) {
			const cached = await this.responseCache.get<T>(cacheKey, endpoint)
			if (cached !== null) {
				return cached
			}
		}

		// Execute with or without queue
		const executeFn = async () => {
			const result = await fn()

			// Cache result
			if (!skipCache && cacheKey) {
				await this.responseCache.set(cacheKey, result, cacheTTL, endpoint)
			}

			return result
		}

		if (skipQueue || !this.config.concurrency.enableRequestQueue) {
			return executeFn()
		}

		return this.requestQueue.execute(executeFn)
	}

	/**
	 * Create paginated response
	 */
	createPaginatedResponse<T>(
		data: T[],
		options: PaginationOptions,
		total?: number
	): PaginatedResponse<T> {
		const limit = Math.min(
			options.limit || this.config.pagination.defaultLimit,
			this.config.pagination.maxLimit
		)
		const offset = options.offset || 0

		// Handle cursor-based pagination
		if (this.config.pagination.enableCursor && options.cursor) {
			// Decode cursor to get offset
			try {
				const decodedCursor = JSON.parse(Buffer.from(options.cursor, 'base64').toString())
				const cursorOffset = decodedCursor.offset || 0
				const actualOffset = cursorOffset
				const paginatedData = data.slice(actualOffset, actualOffset + limit)

				return {
					data: paginatedData,
					pagination: {
						total,
						limit,
						cursor: options.cursor,
						hasNext: actualOffset + limit < (total || data.length),
						hasPrevious: actualOffset > 0,
						nextCursor:
							actualOffset + limit < (total || data.length)
								? Buffer.from(JSON.stringify({ offset: actualOffset + limit })).toString('base64')
								: undefined,
						previousCursor:
							actualOffset > 0
								? Buffer.from(
										JSON.stringify({ offset: Math.max(0, actualOffset - limit) })
									).toString('base64')
								: undefined,
					},
				}
			} catch (error) {
				// Fall back to offset-based pagination
			}
		}

		// Offset-based pagination
		const paginatedData = data.slice(offset, offset + limit)

		return {
			data: paginatedData,
			pagination: {
				total,
				limit,
				offset,
				hasNext: offset + limit < (total || data.length),
				hasPrevious: offset > 0,
			},
		}
	}

	/**
	 * Create streaming response
	 */
	async createStreamingResponse<T>(
		dataGenerator: AsyncGenerator<T[], void, unknown>,
		context: Context,
		options?: StreamingOptions
	): Promise<Response> {
		if (!this.config.streaming.enabled) {
			throw new Error('Streaming is disabled')
		}

		const { format = 'json', compression = false } = options || {}

		const stream = new ReadableStream({
			async start(controller) {
				try {
					let isFirst = true

					// Start JSON array for JSON format
					if (format === 'json') {
						controller.enqueue(new TextEncoder().encode('['))
					}

					for await (const chunk of dataGenerator) {
						let output: string

						switch (format) {
							case 'json':
								const jsonChunk = chunk.map((item) => JSON.stringify(item)).join(',')
								output = isFirst ? jsonChunk : ',' + jsonChunk
								break
							case 'ndjson':
								output = chunk.map((item) => JSON.stringify(item)).join('\n') + '\n'
								break
							case 'csv':
								if (isFirst && chunk.length > 0) {
									// Add CSV header
									const headers = Object.keys(chunk[0] as any).join(',')
									output = headers + '\n'
									output +=
										chunk
											.map((item) =>
												Object.values(item as any)
													.map((v) => (typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v))
													.join(',')
											)
											.join('\n') + '\n'
								} else {
									output =
										chunk
											.map((item) =>
												Object.values(item as any)
													.map((v) => (typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v))
													.join(',')
											)
											.join('\n') + '\n'
								}
								break
							default:
								output = JSON.stringify(chunk)
						}

						controller.enqueue(new TextEncoder().encode(output))
						isFirst = false
					}

					// Close JSON array for JSON format
					if (format === 'json') {
						controller.enqueue(new TextEncoder().encode(']'))
					}

					controller.close()
				} catch (error) {
					controller.error(error)
				}
			},
		})

		const headers: Record<string, string> = {
			'Content-Type': this.getContentType(format),
			'Transfer-Encoding': 'chunked',
		}

		if (compression) {
			headers['Content-Encoding'] = 'gzip'
		}

		return new Response(stream, { headers })
	}

	/**
	 * Record request metrics
	 */
	recordRequest(endpoint: string, duration: number): void {
		if (!this.config.monitoring.enableMetrics) return

		this.metrics.requests.push({
			timestamp: Date.now(),
			duration,
			endpoint,
		})

		// Keep only last hour of metrics
		const oneHourAgo = Date.now() - 60 * 60 * 1000
		this.metrics.requests = this.metrics.requests.filter((r) => r.timestamp > oneHourAgo)

		// Log slow requests
		if (duration > this.config.monitoring.slowRequestThreshold) {
			this.logger.warn('Slow request detected', {
				endpoint,
				duration,
				threshold: this.config.monitoring.slowRequestThreshold,
			})
		}
	}

	/**
	 * Get performance metrics
	 */
	getMetrics(): PerformanceMetrics {
		const now = Date.now()
		const oneMinuteAgo = now - 60 * 1000
		const recentRequests = this.metrics.requests.filter((r) => r.timestamp > oneMinuteAgo)

		// Calculate requests per second
		const requestsPerSecond = recentRequests.length / 60

		// Calculate average response time
		const averageResponseTime =
			recentRequests.length > 0
				? recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length
				: 0

		// Memory usage
		const memoryUsage = process.memoryUsage()
		const memoryStats = {
			used: memoryUsage.heapUsed,
			total: memoryUsage.heapTotal,
			percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
		}

		// Slow requests analysis
		const slowRequests = this.metrics.requests.filter(
			(r) => r.duration > this.config.monitoring.slowRequestThreshold
		)
		const endpointStats = new Map<string, { totalTime: number; count: number }>()

		slowRequests.forEach((r) => {
			const stats = endpointStats.get(r.endpoint) || { totalTime: 0, count: 0 }
			stats.totalTime += r.duration
			stats.count++
			endpointStats.set(r.endpoint, stats)
		})

		const slowestEndpoints = Array.from(endpointStats.entries())
			.map(([endpoint, stats]) => ({
				endpoint,
				averageTime: stats.totalTime / stats.count,
				count: stats.count,
			}))
			.sort((a, b) => b.averageTime - a.averageTime)
			.slice(0, 10)

		return {
			timestamp: new Date(),
			requestsPerSecond,
			averageResponseTime,
			memoryUsage: memoryStats,
			cacheStats: this.responseCache.getStats(),
			concurrency: this.requestQueue.getStats(),
			slowRequests: {
				count: slowRequests.length,
				averageTime:
					slowRequests.length > 0
						? slowRequests.reduce((sum, r) => sum + r.duration, 0) / slowRequests.length
						: 0,
				slowestEndpoints,
			},
		}
	}

	/**
	 * Generate cache key for request
	 */
	generateCacheKey(endpoint: string, params: Record<string, any>): string {
		const sortedKeys = Object.keys(params).sort()
		const pairs = sortedKeys.map((key) => `${key}:${JSON.stringify(params[key])}`)
		const dataToHash = `${endpoint}_${pairs.join('|')}`
		return createHash('sha256').update(dataToHash, 'utf8').digest('hex')
	}

	/**
	 * Invalidate cache by pattern
	 */
	async invalidateCache(pattern: string): Promise<number> {
		return this.responseCache.invalidate(pattern)
	}

	/**
	 * Check if caching is enabled for a specific endpoint
	 */
	isCachingEnabledForEndpoint(endpoint: string): boolean {
		if (!this.config.responseCache.enabled) {
			return false
		}

		// Check if endpoint should be excluded from caching
		if (this.config.responseCache.excludeEndpoints?.includes(endpoint)) {
			return false
		}

		// Check pattern matches in disableCachePatterns
		if (this.config.responseCache.disableCachePatterns) {
			for (const pattern of this.config.responseCache.disableCachePatterns) {
				if (this.matchesPattern(endpoint, pattern)) {
					return false
				}
			}
		}

		return true
	}

	/**
	 * Get cache TTL for a specific endpoint
	 */
	getCacheTTLForEndpoint(endpoint: string, defaultTTL?: number): number {
		const baseTTL = defaultTTL || this.config.responseCache.defaultTTL

		if (!this.config.responseCache.endpointTTLOverrides) {
			return baseTTL
		}

		// Check for exact match first
		if (this.config.responseCache.endpointTTLOverrides[endpoint]) {
			return this.config.responseCache.endpointTTLOverrides[endpoint]
		}

		// Check for pattern matches
		for (const [pattern, ttl] of Object.entries(this.config.responseCache.endpointTTLOverrides)) {
			if (this.matchesPattern(endpoint, pattern)) {
				return ttl
			}
		}

		return baseTTL
	}

	/**
	 * Simple pattern matching (supports * wildcards)
	 */
	private matchesPattern(text: string, pattern: string): boolean {
		// Convert pattern to regex
		const regexPattern = pattern
			.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
			.replace(/\\\*/g, '.*') // Convert * to .*

		const regex = new RegExp(`^${regexPattern}$`, 'i')
		return regex.test(text)
	}

	/**
	 * Get content type for streaming format
	 */
	private getContentType(format: string): string {
		switch (format) {
			case 'json':
				return 'application/json'
			case 'ndjson':
				return 'application/x-ndjson'
			case 'csv':
				return 'text/csv'
			default:
				return 'application/json'
		}
	}

	/**
	 * Create optimized handler for endpoint with automatic caching rules
	 */
	createOptimizedHandler<T>(
		endpoint: string,
		handler: () => Promise<T>,
		options?: {
			customCacheTTL?: number
			forceSkipCache?: boolean
			forceSkipQueue?: boolean
		}
	): () => Promise<T> {
		return async () => {
			const cacheKey = this.generateCacheKey(endpoint, {})
			const skipCache = options?.forceSkipCache || !this.isCachingEnabledForEndpoint(endpoint)
			const cacheTTL = options?.customCacheTTL || this.getCacheTTLForEndpoint(endpoint)

			return this.executeOptimized(handler, {
				cacheKey: skipCache ? undefined : cacheKey,
				cacheTTL,
				skipCache,
				skipQueue: options?.forceSkipQueue,
				endpoint,
			})
		}
	}

	/**
	 * Get cache configuration summary
	 */
	getCacheConfigSummary(): {
		enabled: boolean
		excludedEndpoints: string[]
		disabledPatterns: string[]
		ttlOverrides: Record<string, number>
		stats: ReturnType<ResponseCache['getStats']>
	} {
		return {
			enabled: this.config.responseCache.enabled,
			excludedEndpoints: this.config.responseCache.excludeEndpoints || [],
			disabledPatterns: this.config.responseCache.disableCachePatterns || [],
			ttlOverrides: this.config.responseCache.endpointTTLOverrides || {},
			stats: this.responseCache.getStats(),
		}
	}

	/**
	 * Health check for performance service
	 */
	async healthCheck(): Promise<{
		status: 'healthy' | 'warning' | 'critical'
		details: {
			cache: { status: string; hitRatio: number; exclusionRatio: number }
			concurrency: { status: string; utilization: number }
			memory: { status: string; usage: number }
		}
	}> {
		const metrics = this.getMetrics()
		const cacheHitRatio = metrics.cacheStats.hitRatio
		const concurrencyUtilization =
			(metrics.concurrency.activeRequests / metrics.concurrency.maxConcurrentRequests) * 100
		const memoryUsage = metrics.memoryUsage.percentage

		const cacheStats = this.responseCache.getStats()
		const details = {
			cache: {
				status: cacheHitRatio > 70 ? 'healthy' : cacheHitRatio > 50 ? 'warning' : 'critical',
				hitRatio: cacheHitRatio,
				exclusionRatio: cacheStats.exclusionRatio,
			},
			concurrency: {
				status:
					concurrencyUtilization < 80
						? 'healthy'
						: concurrencyUtilization < 95
							? 'warning'
							: 'critical',
				utilization: concurrencyUtilization,
			},
			memory: {
				status: memoryUsage < 80 ? 'healthy' : memoryUsage < 90 ? 'warning' : 'critical',
				usage: memoryUsage,
			},
		}

		const statuses = Object.values(details).map((d) => d.status)
		const overall = statuses.includes('critical')
			? 'critical'
			: statuses.includes('warning')
				? 'warning'
				: 'healthy'

		return { status: overall, details }
	}
}

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
	responseCache: {
		enabled: true,
		defaultTTL: 300, // 5 minutes
		maxSizeMB: 100,
		keyPrefix: 'api_cache',
		// Example exclusions - endpoints that should not be cached
		excludeEndpoints: [
			'/api/v1/auth/session',
			'/api/v1/auth/logout',
			'/graphql', // Disable caching for all GraphQL requests
		],
		// Example patterns - disable caching for real-time endpoints
		disableCachePatterns: ['/api/v1/realtime/*', '/api/v1/streaming/*', '*/live', '*/current'],
		// Example TTL overrides - shorter cache for frequently changing data
		endpointTTLOverrides: {
			'/api/v1/metrics/*': 60, // 1 minute for metrics
			'/api/v1/health': 30, // 30 seconds for health checks
			'/api/v1/audit/events/recent': 120, // 2 minutes for recent events
		},
	},
	pagination: {
		defaultLimit: 50,
		maxLimit: 1000,
		enableCursor: true,
	},
	streaming: {
		enabled: true,
		chunkSize: 1000,
		maxConcurrentStreams: 10,
	},
	concurrency: {
		maxConcurrentRequests: 100,
		queueTimeout: 30000, // 30 seconds
		enableRequestQueue: true,
	},
	monitoring: {
		enableMetrics: true,
		slowRequestThreshold: 1000, // 1 second
		memoryThreshold: 80, // 80%
	},
}
