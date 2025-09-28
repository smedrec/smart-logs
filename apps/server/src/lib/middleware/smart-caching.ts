/**
 * Smart Caching Middleware
 * Automatically applies caching rules based on endpoint configuration
 */

import { createMiddleware } from 'hono/factory'

import type { HonoEnv } from '../hono/context'

/**
 * Smart caching middleware that automatically applies cache exclusions
 * based on the performance service configuration
 */
export const smartCachingMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
	const { performance } = c.get('services')
	const endpoint = c.req.path
	const method = c.req.method

	// Only apply caching to GET requests
	if (method !== 'GET') {
		return next()
	}

	// Check if caching is enabled for this endpoint
	const isCachingEnabled = performance.isCachingEnabledForEndpoint(endpoint)

	if (!isCachingEnabled) {
		// Add header to indicate caching was skipped
		c.res.headers.set('X-Cache-Status', 'EXCLUDED')
		return next()
	}

	// Generate cache key based on endpoint and query parameters
	const queryParams = Object.fromEntries(c.req.queries())
	const cacheKey = performance.generateCacheKey(endpoint, queryParams)
	const cacheTTL = performance.getCacheTTLForEndpoint(endpoint)

	// Try to get from cache first
	const cached = await performance.executeOptimized(
		async () => {
			// This will only execute if cache miss
			await next()

			// Return the response data for caching
			return {
				status: c.res.status,
				headers: Object.fromEntries(c.res.headers.entries()),
				body: await c.res.clone().text(),
			}
		},
		{
			cacheKey,
			cacheTTL,
			endpoint,
		}
	)

	// If we got cached data, return it
	if (cached && c.res.status === 200) {
		c.res.headers.set('X-Cache-Status', 'HIT')
		c.res.headers.set('X-Cache-TTL', cacheTTL.toString())
		return new Response(cached.body, {
			status: cached.status,
			headers: cached.headers,
		})
	}

	// Add cache headers for fresh responses
	c.res.headers.set('X-Cache-Status', 'MISS')
	c.res.headers.set('X-Cache-TTL', cacheTTL.toString())
})

/**
 * Cache invalidation middleware for write operations
 * Automatically invalidates related cache entries on POST/PUT/DELETE
 */
export const cacheInvalidationMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
	const { performance } = c.get('services')
	const endpoint = c.req.path
	const method = c.req.method

	// Execute the request first
	await next()

	// Only invalidate cache on successful write operations
	if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) || c.res.status >= 400) {
		return
	}

	// Define invalidation patterns based on endpoint
	const invalidationPatterns = getInvalidationPatterns(endpoint)

	let totalInvalidated = 0
	for (const pattern of invalidationPatterns) {
		const invalidated = await performance.invalidateCache(pattern)
		totalInvalidated += invalidated
	}

	if (totalInvalidated > 0) {
		c.res.headers.set('X-Cache-Invalidated', totalInvalidated.toString())
		console.log(`Invalidated ${totalInvalidated} cache entries for ${endpoint}`)
	}
})

/**
 * Get cache invalidation patterns for an endpoint
 */
function getInvalidationPatterns(endpoint: string): string[] {
	const patterns: string[] = []

	// Audit events endpoints
	if (endpoint.includes('/audit/events')) {
		patterns.push('*audit_events*', '*audit*')
	}

	// User-related endpoints
	if (endpoint.includes('/users') || endpoint.includes('/user/')) {
		patterns.push('*users*', '*user*')
	}

	// Organization-related endpoints
	if (endpoint.includes('/organizations') || endpoint.includes('/org/')) {
		patterns.push('*organizations*', '*org*')
	}

	// Reports endpoints
	if (endpoint.includes('/reports')) {
		patterns.push('*reports*', '*compliance*')
	}

	// Metrics endpoints
	if (endpoint.includes('/metrics')) {
		patterns.push('*metrics*', '*stats*')
	}

	// Alerts endpoints
	if (endpoint.includes('/alerts')) {
		patterns.push('*alerts*', '*notifications*')
	}

	// Default: invalidate anything related to the base resource
	const pathParts = endpoint.split('/').filter(Boolean)
	if (pathParts.length >= 3) {
		const resource = pathParts[2] // e.g., 'events' from '/api/v1/events'
		patterns.push(`*${resource}*`)
	}

	return patterns
}

/**
 * Cache warming middleware for frequently accessed endpoints
 */
export const cacheWarmingMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
	const { performance } = c.get('services')
	const endpoint = c.req.path

	// List of endpoints that should trigger cache warming
	const warmingTriggers = [
		'/api/auth/sign-in/email',
		'/api/auth/sign-up/email',
		'/api/v1/dashboard',
	]

	await next()

	// Only warm cache on successful responses to trigger endpoints
	if (!warmingTriggers.includes(endpoint) || c.res.status >= 400) {
		return
	}

	// Warm up commonly accessed endpoints in the background
	const warmupEndpoints = [
		'/api/v1/audit/events/recent',
		'/api/v1/metrics/dashboard',
		'/api/v1/alerts/active',
		'/api/v1/compliance/status',
	]

	// Don't await - run in background
	Promise.all(
		warmupEndpoints.map(async (warmupEndpoint) => {
			try {
				const cacheKey = performance.generateCacheKey(warmupEndpoint, {})
				// TODO:
				// This would typically make a request to warm the cache
				// For now, we'll just log the intent
				console.log(`Cache warming triggered for ${warmupEndpoint}`)
			} catch (error) {
				console.error(`Cache warming failed for ${warmupEndpoint}:`, error)
			}
		})
	).catch((error) => {
		console.error('Cache warming error:', error)
	})
})

/**
 * Cache debugging middleware (development only)
 */
export const cacheDebugMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
	const { performance, config } = c.get('services')

	// Only enable in development
	if (config.getEnvironment() !== 'development') {
		return next()
	}

	const endpoint = c.req.path
	const method = c.req.method

	// Add debug headers
	c.res.headers.set('X-Cache-Enabled', performance.isCachingEnabledForEndpoint(endpoint).toString())
	c.res.headers.set('X-Cache-TTL-Config', performance.getCacheTTLForEndpoint(endpoint).toString())

	const cacheConfig = performance.getCacheConfigSummary()
	c.res.headers.set('X-Cache-Hit-Ratio', cacheConfig.stats.hitRatio.toFixed(2))
	c.res.headers.set('X-Cache-Exclusion-Ratio', cacheConfig.stats.exclusionRatio.toFixed(2))

	await next()

	// Log cache decision
	console.log(`[CACHE DEBUG] ${method} ${endpoint}:`, {
		cachingEnabled: performance.isCachingEnabledForEndpoint(endpoint),
		configuredTTL: performance.getCacheTTLForEndpoint(endpoint),
		cacheStatus: c.res.headers.get('X-Cache-Status'),
	})
})
