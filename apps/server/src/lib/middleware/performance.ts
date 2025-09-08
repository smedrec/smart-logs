import type { Context, MiddlewareHandler } from 'hono'
import type { HonoEnv } from '../hono/context.js'
import type {
	PaginationOptions,
	PerformanceService,
	StreamingOptions,
} from '../services/performance.js'

/**
 * Performance middleware for request optimization
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: Performance middleware implementation
 */

export interface PerformanceMiddlewareConfig {
	enableCaching: boolean
	enablePagination: boolean
	enableStreaming: boolean
	enableConcurrencyControl: boolean
	enableMetrics: boolean
}

/**
 * Performance monitoring middleware
 */
export function performanceMiddleware(
	config: PerformanceMiddlewareConfig = {
		enableCaching: true,
		enablePagination: true,
		enableStreaming: true,
		enableConcurrencyControl: true,
		enableMetrics: true,
	}
): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		const startTime = Date.now()
		const services = c.get('services')

		if (!services?.performance) {
			// Performance service not available, continue without optimization
			await next()
			return
		}

		const performance = services.performance as PerformanceService

		// Add performance helpers to context
		c.set('performance', {
			// Cache helpers
			getCached: async <T>(key: string): Promise<T | null> => {
				if (!config.enableCaching) return null
				return performance.executeOptimized(
					async () => null, // This will only check cache
					{ cacheKey: key, skipCache: false }
				)
			},

			setCached: async <T>(key: string, value: T, ttl?: number): Promise<void> => {
				if (!config.enableCaching) return
				await performance.executeOptimized(async () => value, { cacheKey: key, cacheTTL: ttl })
			},

			// Pagination helpers
			paginate: <T>(data: T[], options: PaginationOptions) => {
				if (!config.enablePagination) {
					return { data, pagination: { limit: data.length, hasNext: false, hasPrevious: false } }
				}
				return performance.createPaginatedResponse(data, options)
			},

			// Streaming helpers
			stream: async <T>(
				dataGenerator: AsyncGenerator<T[], void, unknown>,
				options?: StreamingOptions
			) => {
				if (!config.enableStreaming) {
					throw new Error('Streaming is disabled')
				}
				return performance.createStreamingResponse(dataGenerator, c, options)
			},

			// Optimized execution
			execute: async <T>(
				fn: () => Promise<T>,
				options?: {
					cacheKey?: string
					cacheTTL?: number
					skipCache?: boolean
					skipQueue?: boolean
				}
			): Promise<T> => {
				return performance.executeOptimized(fn, {
					...options,
					skipQueue: !config.enableConcurrencyControl || options?.skipQueue,
				})
			},

			// Cache key generation
			generateCacheKey: (params: Record<string, any>): string => {
				const endpoint = c.req.path
				return performance.generateCacheKey(endpoint, params)
			},

			// Cache invalidation
			invalidateCache: (pattern: string): Promise<number> => {
				return performance.invalidateCache(pattern)
			},
		})

		await next()

		// Record performance metrics
		if (config.enableMetrics) {
			const duration = Date.now() - startTime
			const endpoint = `${c.req.method} ${c.req.path}`
			performance.recordRequest(endpoint, duration)
		}
	}
}

/**
 * Response compression middleware
 */
export function compressionMiddleware(): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		await next()

		const acceptEncoding = c.req.header('accept-encoding') || ''
		const contentType = c.res.headers.get('content-type') || ''

		// Only compress text-based responses
		if (
			!contentType.includes('application/json') &&
			!contentType.includes('text/') &&
			!contentType.includes('application/xml')
		) {
			return
		}

		// Check if client accepts gzip
		if (acceptEncoding.includes('gzip')) {
			const body = await c.res.text()

			// Only compress if body is large enough
			if (body.length > 1024) {
				try {
					// Note: In a real implementation, you'd use a proper compression library
					// This is a placeholder for the compression logic
					c.res.headers.set('Content-Encoding', 'gzip')
					c.res.headers.set('Vary', 'Accept-Encoding')
				} catch (error) {
					console.error('Compression failed:', error)
				}
			}
		}
	}
}

/**
 * Request timeout middleware
 */
export function timeoutMiddleware(timeoutMs: number = 30000): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Request timeout after ${timeoutMs}ms`))
			}, timeoutMs)
		})

		try {
			await Promise.race([next(), timeoutPromise])
		} catch (error) {
			if (error instanceof Error && error.message.includes('timeout')) {
				return c.json(
					{
						error: 'REQUEST_TIMEOUT',
						message: 'Request took too long to process',
						timeout: timeoutMs,
					},
					408
				)
			}
			throw error
		}
	}
}

/**
 * Memory monitoring middleware
 */
export function memoryMonitoringMiddleware(thresholdMB: number = 500): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		const beforeMemory = process.memoryUsage()

		await next()

		const afterMemory = process.memoryUsage()
		const memoryDelta = afterMemory.heapUsed - beforeMemory.heapUsed
		const memoryDeltaMB = memoryDelta / (1024 * 1024)

		// Log high memory usage requests
		if (memoryDeltaMB > thresholdMB) {
			const services = c.get('services')
			const logger = services?.logger

			if (logger) {
				logger.warn('High memory usage request', {
					endpoint: `${c.req.method} ${c.req.path}`,
					memoryDeltaMB: memoryDeltaMB.toFixed(2),
					threshold: thresholdMB,
					beforeHeapMB: (beforeMemory.heapUsed / (1024 * 1024)).toFixed(2),
					afterHeapMB: (afterMemory.heapUsed / (1024 * 1024)).toFixed(2),
				})
			}
		}

		// Add memory usage headers in development
		const services = c.get('services')
		if (services?.config?.isDevelopment()) {
			c.res.headers.set('X-Memory-Delta-MB', memoryDeltaMB.toFixed(2))
			c.res.headers.set('X-Memory-Heap-MB', (afterMemory.heapUsed / (1024 * 1024)).toFixed(2))
		}
	}
}

/**
 * Request size limiting middleware
 */
export function requestSizeLimitMiddleware(maxSizeMB: number = 10): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		const contentLength = c.req.header('content-length')

		if (contentLength) {
			const sizeMB = parseInt(contentLength) / (1024 * 1024)

			if (sizeMB > maxSizeMB) {
				return c.json(
					{
						error: 'REQUEST_TOO_LARGE',
						message: `Request size ${sizeMB.toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`,
						maxSizeMB,
					},
					413
				)
			}
		}

		await next()
	}
}

/**
 * Response caching middleware
 */
export function responseCachingMiddleware(
	defaultTTL: number = 300,
	cacheableStatusCodes: number[] = [200]
): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		const method = c.req.method
		const path = c.req.path

		// Only cache GET requests
		if (method !== 'GET' || path.includes('/auth/')) {
			await next()
			return
		}

		const services = c.get('services')
		const performance = services?.performance as PerformanceService | undefined

		if (!performance) {
			await next()
			return
		}

		// Generate cache key
		const url = new URL(c.req.url)
		const cacheKey = performance.generateCacheKey(
			url.pathname,
			Object.fromEntries(url.searchParams)
		)

		// Try to get from cache
		const cached = await performance.executeOptimized(async () => null, {
			cacheKey,
			skipCache: false,
		})

		if (cached) {
			// Return cached response
			return c.json(cached)
		}

		await next()

		// Cache successful responses
		if (cacheableStatusCodes.includes(c.res.status)) {
			try {
				const responseBody = await c.res.clone().json()
				await performance.executeOptimized(async () => responseBody, {
					cacheKey,
					cacheTTL: defaultTTL,
				})
			} catch (error) {
				// Ignore caching errors
				console.error('Response caching failed:', error)
			}
		}
	}
}

/**
 * Concurrent request limiting middleware
 */
export function concurrencyLimitMiddleware(
	maxConcurrent: number = 100
): MiddlewareHandler<HonoEnv> {
	let activeRequests = 0

	return async (c, next) => {
		if (activeRequests >= maxConcurrent) {
			return c.json(
				{
					error: 'TOO_MANY_REQUESTS',
					message: 'Server is currently handling too many requests',
					maxConcurrent,
					activeRequests,
				},
				503
			)
		}

		activeRequests++

		try {
			await next()
		} finally {
			activeRequests--
		}
	}
}

/**
 * Performance headers middleware
 */
export function performanceHeadersMiddleware(): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		const startTime = Date.now()

		await next()

		const duration = Date.now() - startTime

		// Add performance headers
		c.res.headers.set('X-Response-Time', `${duration}ms`)
		c.res.headers.set('X-Timestamp', new Date().toISOString())

		// Add cache headers for cacheable responses
		if (c.req.method === 'GET' && c.res.status === 200) {
			c.res.headers.set('Cache-Control', 'public, max-age=300') // 5 minutes
			c.res.headers.set('ETag', `"${Date.now()}"`)
		}
	}
}
