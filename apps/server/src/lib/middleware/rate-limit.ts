/**
 * @fileoverview Rate Limiting Middleware
 *
 * Implements configurable rate limiting for REST API endpoints:
 * - IP-based rate limiting
 * - User-based rate limiting
 * - Session-based rate limiting
 * - In-memory storage for simplicity (can be extended to Redis)
 *
 * Requirements: 2.4, 2.5
 */

import { ApiError } from '@/lib/errors'
import { createMiddleware } from 'hono/factory'

import type { HonoEnv } from '@/lib/hono/context'
import type { Context } from 'hono'

export interface RateLimitConfig {
	windowMs: number
	maxRequests: number
	skipSuccessfulRequests: boolean
	keyGenerator: 'ip' | 'user' | 'session'
	message?: string
	headers?: boolean
	standardHeaders?: boolean
	legacyHeaders?: boolean
}

export interface RateLimitInfo {
	limit: number
	current: number
	remaining: number
	resetTime: Date
}

interface RateLimitEntry {
	count: number
	resetTime: number
}

// In-memory rate limit store
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup expired entries periodically
setInterval(() => {
	const now = Date.now()
	for (const [key, entry] of rateLimitStore.entries()) {
		if (entry.resetTime <= now) {
			rateLimitStore.delete(key)
		}
	}
}, 60000) // Cleanup every minute

/**
 * Rate limiting middleware factory
 */
export function rateLimit(config: RateLimitConfig) {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const { logger } = c.get('services')

		try {
			// Generate rate limit key
			const key = generateRateLimitKey(c, config.keyGenerator)

			// Get current count from store
			const current = getCurrentCount(key, config.windowMs)

			// Check if limit exceeded
			if (current >= config.maxRequests) {
				const resetTime = getResetTime(key, config.windowMs)

				// Set rate limit headers
				if (config.headers !== false) {
					setRateLimitHeaders(
						c,
						{
							limit: config.maxRequests,
							current,
							remaining: 0,
							resetTime,
						},
						config
					)
				}

				logger.warn(`Rate limit exceeded for key: ${key}`, {
					key,
					current,
					limit: config.maxRequests,
					ip: getClientIP(c),
					userAgent: c.req.header('user-agent'),
				})

				throw new ApiError({
					code: 'RATE_LIMITED',
					message: config.message || 'Too many requests, please try again later',
				})
			}

			// Execute the request
			await next()

			// Increment counter only if request was successful (unless skipSuccessfulRequests is false)
			const shouldIncrement = !config.skipSuccessfulRequests || c.res.status >= 400

			if (shouldIncrement) {
				const newCount = incrementCount(key, config.windowMs)

				// Set rate limit headers
				if (config.headers !== false) {
					const resetTime = getResetTime(key, config.windowMs)
					setRateLimitHeaders(
						c,
						{
							limit: config.maxRequests,
							current: newCount,
							remaining: Math.max(0, config.maxRequests - newCount),
							resetTime,
						},
						config
					)
				}
			}
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			// If rate limiting fails, log error but don't block requests
			logger.error('Rate limiting error, allowing request', {
				error: error instanceof Error ? error.message : 'Unknown error',
				key: generateRateLimitKey(c, config.keyGenerator),
			})

			await next()
		}
	})
}

/**
 * Generate rate limit key based on strategy
 */
function generateRateLimitKey(c: Context, strategy: 'ip' | 'user' | 'session'): string {
	const prefix = 'rate_limit'

	switch (strategy) {
		case 'ip': {
			const ip = getClientIP(c)
			return `${prefix}:ip:${ip}`
		}

		case 'user': {
			const session = c.get('session')
			if (session?.session?.userId) {
				return `${prefix}:user:${session.session.userId}`
			}
			// Fallback to IP if no user session
			const ip = getClientIP(c)
			return `${prefix}:ip:${ip}`
		}

		case 'session': {
			const session = c.get('session')
			if (session?.session?.id) {
				return `${prefix}:session:${session.session.id}`
			}
			// Fallback to IP if no session
			const ip = getClientIP(c)
			return `${prefix}:ip:${ip}`
		}

		default:
			throw new Error(`Unknown rate limit strategy: ${strategy}`)
	}
}

/**
 * Get client IP address
 */
function getClientIP(c: Context): string {
	// Check for forwarded headers (behind proxy)
	const forwarded = c.req.header('x-forwarded-for')
	if (forwarded) {
		return forwarded.split(',')[0].trim()
	}

	const realIP = c.req.header('x-real-ip')
	if (realIP) {
		return realIP
	}

	// Fallback to connection remote address
	return c.env?.incoming?.socket?.remoteAddress || 'unknown'
}

/**
 * Get current request count from store
 */
function getCurrentCount(key: string, windowMs: number): number {
	const entry = rateLimitStore.get(key)
	const now = Date.now()

	if (!entry || entry.resetTime <= now) {
		return 0
	}

	return entry.count
}

/**
 * Increment request count in store
 */
function incrementCount(key: string, windowMs: number): number {
	const now = Date.now()
	const resetTime = now + windowMs
	const entry = rateLimitStore.get(key)

	if (!entry || entry.resetTime <= now) {
		// Create new entry
		rateLimitStore.set(key, { count: 1, resetTime })
		return 1
	} else {
		// Increment existing entry
		entry.count++
		rateLimitStore.set(key, entry)
		return entry.count
	}
}

/**
 * Get reset time for rate limit window
 */
function getResetTime(key: string, windowMs: number): Date {
	const entry = rateLimitStore.get(key)

	if (entry && entry.resetTime > Date.now()) {
		return new Date(entry.resetTime)
	}

	// If no entry or expired, calculate based on window
	return new Date(Date.now() + windowMs)
}

/**
 * Set rate limit headers on response
 */
function setRateLimitHeaders(c: Context, info: RateLimitInfo, config: RateLimitConfig) {
	// Standard rate limit headers (draft RFC)
	if (config.standardHeaders !== false) {
		c.header('RateLimit-Limit', info.limit.toString())
		c.header('RateLimit-Remaining', info.remaining.toString())
		c.header('RateLimit-Reset', Math.ceil(info.resetTime.getTime() / 1000).toString())
	}

	// Legacy X-RateLimit headers (widely supported)
	if (config.legacyHeaders !== false) {
		c.header('X-RateLimit-Limit', info.limit.toString())
		c.header('X-RateLimit-Remaining', info.remaining.toString())
		c.header('X-RateLimit-Reset', Math.ceil(info.resetTime.getTime() / 1000).toString())
	}

	// Retry-After header when limit exceeded
	if (info.remaining === 0) {
		const retryAfter = Math.ceil((info.resetTime.getTime() - Date.now()) / 1000)
		c.header('Retry-After', retryAfter.toString())
	}
}

/**
 * Create rate limit middleware with different presets
 */
export const rateLimitPresets = {
	/**
	 * Strict rate limiting for authentication endpoints
	 */
	strict: (config?: Partial<RateLimitConfig>) =>
		rateLimit({
			windowMs: 15 * 60 * 1000, // 15 minutes
			maxRequests: 5,
			skipSuccessfulRequests: false,
			keyGenerator: 'ip',
			message: 'Too many authentication attempts, please try again later',
			...config,
		}),

	/**
	 * Moderate rate limiting for general API endpoints
	 */
	moderate: (config?: Partial<RateLimitConfig>) =>
		rateLimit({
			windowMs: 60 * 1000, // 1 minute
			maxRequests: 100,
			skipSuccessfulRequests: true,
			keyGenerator: 'user',
			...config,
		}),

	/**
	 * Lenient rate limiting for read-only endpoints
	 */
	lenient: (config?: Partial<RateLimitConfig>) =>
		rateLimit({
			windowMs: 60 * 1000, // 1 minute
			maxRequests: 1000,
			skipSuccessfulRequests: true,
			keyGenerator: 'user',
			...config,
		}),

	/**
	 * Per-IP rate limiting for public endpoints
	 */
	perIP: (config?: Partial<RateLimitConfig>) =>
		rateLimit({
			windowMs: 60 * 1000, // 1 minute
			maxRequests: 60,
			skipSuccessfulRequests: true,
			keyGenerator: 'ip',
			...config,
		}),
}

/**
 * Rate limit middleware that adapts based on endpoint type
 */
export function adaptiveRateLimit() {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const path = c.req.path
		const method = c.req.method

		// Determine rate limit strategy based on endpoint
		let middleware

		if (path.includes('/auth/')) {
			// Strict limits for authentication
			middleware = rateLimitPresets.strict()
		} else if (method === 'GET' && (path.includes('/events') || path.includes('/metrics'))) {
			// Lenient limits for read operations
			middleware = rateLimitPresets.lenient()
		} else if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
			// Moderate limits for write operations
			middleware = rateLimitPresets.moderate()
		} else {
			// Default moderate limits
			middleware = rateLimitPresets.moderate()
		}

		return middleware(c, next)
	})
}
