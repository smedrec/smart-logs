/**
 * @fileoverview Rate Limiting Middleware
 *
 * Implements configurable rate limiting for REST API endpoints:
 * - IP-based rate limiting
 * - User-based rate limiting
 * - Session-based rate limiting
 * - Redis-based storage for distributed rate limiting
 *
 * Requirements: 2.4, 2.5
 */

import { ApiError } from '@/lib/errors'
import { createMiddleware } from 'hono/factory'

import type { HonoEnv } from '@/lib/hono/context'
import type { Context } from 'hono'
import type { Redis } from '@repo/redis-client'

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

/**
 * Rate limiting middleware factory
 */
export function rateLimit(config: RateLimitConfig) {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const { logger, redis } = c.get('services')

		try {
			// Generate rate limit key
			const key = generateRateLimitKey(c, config.keyGenerator)

			// Get current count from Redis
			const current = await getCurrentCount(redis, key, config.windowMs)

			// Check if limit exceeded
			if (current >= config.maxRequests) {
				const resetTime = await getResetTime(redis, key, config.windowMs)

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
				const newCount = await incrementCount(redis, key, config.windowMs)

				// Set rate limit headers
				if (config.headers !== false) {
					const resetTime = await getResetTime(redis, key, config.windowMs)
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
			logger.error(
				'Rate limiting error, allowing request',
				error instanceof Error ? error.message : 'Unknown error',
				{
					key: generateRateLimitKey(c, config.keyGenerator),
				}
			)

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
 * Get current request count from Redis
 */
async function getCurrentCount(redis: Redis, key: string, windowMs: number): Promise<number> {
	try {
		const data = await redis.get(key)
		if (!data) {
			return 0
		}

		const entry: RateLimitEntry = JSON.parse(data)
		const now = Date.now()

		if (entry.resetTime <= now) {
			// Entry expired, clean it up
			await redis.del(key)
			return 0
		}

		return entry.count
	} catch (error) {
		// If Redis fails, return 0 to allow request
		return 0
	}
}

/**
 * Increment request count in Redis using atomic operations
 */
async function incrementCount(redis: Redis, key: string, windowMs: number): Promise<number> {
	try {
		const now = Date.now()
		const resetTime = now + windowMs
		const ttlSeconds = Math.ceil(windowMs / 1000)

		// Use Lua script for atomic operation to avoid race conditions
		const luaScript = `
			local key = KEYS[1]
			local now = tonumber(ARGV[1])
			local resetTime = tonumber(ARGV[2])
			local ttl = tonumber(ARGV[3])
			
			local current = redis.call('GET', key)
			local entry
			
			if current == false then
				-- No existing entry, create new one
				entry = { count = 1, resetTime = resetTime }
			else
				entry = cjson.decode(current)
				if entry.resetTime <= now then
					-- Entry expired, create new one
					entry = { count = 1, resetTime = resetTime }
				else
					-- Increment existing entry
					entry.count = entry.count + 1
				end
			end
			
			redis.call('SETEX', key, ttl, cjson.encode(entry))
			return entry.count
		`

		const result = (await redis.eval(
			luaScript,
			1,
			key,
			now.toString(),
			resetTime.toString(),
			ttlSeconds.toString()
		)) as number
		return result
	} catch (error) {
		// Fallback to non-atomic operation if Lua script fails
		try {
			const now = Date.now()
			const resetTime = now + windowMs
			const ttlSeconds = Math.ceil(windowMs / 1000)

			// Get current entry
			const data = await redis.get(key)
			let entry: RateLimitEntry

			if (!data) {
				// Create new entry
				entry = { count: 1, resetTime }
			} else {
				const existingEntry: RateLimitEntry = JSON.parse(data)

				if (existingEntry.resetTime <= now) {
					// Entry expired, create new one
					entry = { count: 1, resetTime }
				} else {
					// Increment existing entry
					entry = { count: existingEntry.count + 1, resetTime: existingEntry.resetTime }
				}
			}

			// Set the entry with TTL
			await redis.setex(key, ttlSeconds, JSON.stringify(entry))
			return entry.count
		} catch (fallbackError) {
			// If Redis completely fails, return 1 to allow request
			return 1
		}
	}
}

/**
 * Get reset time for rate limit window from Redis
 */
async function getResetTime(redis: Redis, key: string, windowMs: number): Promise<Date> {
	try {
		const data = await redis.get(key)

		if (data) {
			const entry: RateLimitEntry = JSON.parse(data)
			if (entry.resetTime > Date.now()) {
				return new Date(entry.resetTime)
			}
		}

		// If no entry or expired, calculate based on window
		return new Date(Date.now() + windowMs)
	} catch (error) {
		// If Redis fails, return current time + window
		return new Date(Date.now() + windowMs)
	}
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

/**
 * Utility functions for Redis-based rate limiting
 */
export const rateLimitUtils = {
	/**
	 * Clear rate limit for a specific key
	 */
	async clearRateLimit(redis: Redis, key: string): Promise<boolean> {
		try {
			const result = await redis.del(key)
			return result > 0
		} catch (error) {
			return false
		}
	},

	/**
	 * Get rate limit info for a specific key
	 */
	async getRateLimitInfo(redis: Redis, key: string): Promise<RateLimitInfo | null> {
		try {
			const data = await redis.get(key)
			if (!data) {
				return null
			}

			const entry: RateLimitEntry = JSON.parse(data)
			const now = Date.now()

			if (entry.resetTime <= now) {
				// Entry expired
				await redis.del(key)
				return null
			}

			return {
				limit: 0, // This would need to be passed in or stored separately
				current: entry.count,
				remaining: 0, // This would need to be calculated with the limit
				resetTime: new Date(entry.resetTime),
			}
		} catch (error) {
			return null
		}
	},

	/**
	 * Clear all rate limits matching a pattern
	 */
	async clearRateLimitPattern(redis: Redis, pattern: string): Promise<number> {
		try {
			const keys = await redis.keys(pattern)
			if (keys.length === 0) {
				return 0
			}
			return await redis.del(...keys)
		} catch (error) {
			return 0
		}
	},
}
