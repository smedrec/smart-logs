/**
 * @fileoverview Enhanced Error Handling Middleware
 *
 * Provides comprehensive error handling for REST API:
 * - Structured error responses
 * - HTTP status code mapping
 * - Error logging with context
 * - Request ID tracking
 *
 * Requirements: 2.3, 2.5
 */

import { ApiError } from '@/lib/errors'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import type { HonoEnv } from '@/lib/hono/context'
import type { Context } from 'hono'

export interface ErrorResponse {
	code: string
	message: string
	details?: Record<string, any>
	timestamp: string
	requestId: string
	path?: string
}

/**
 * HTTP status code mapping for error codes
 */
const ERROR_STATUS_MAP: Record<string, number> = {
	// Client errors (4xx)
	VALIDATION_ERROR: 400,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	CONFLICT: 409,
	UNSUPPORTED_MEDIA_TYPE: 415,
	UNPROCESSABLE_ENTITY: 422,
	RATE_LIMIT_EXCEEDED: 429,
	UNSUPPORTED_API_VERSION: 400,
	MISSING_API_VERSION: 400,
	INVALID_API_VERSION: 400,
	INSUFFICIENT_API_VERSION: 400,

	// Server errors (5xx)
	INTERNAL_SERVER_ERROR: 500,
	NOT_IMPLEMENTED: 501,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
	DATABASE_ERROR: 503,
	REDIS_ERROR: 503,
	EXTERNAL_SERVICE_ERROR: 502,
}

/**
 * Enhanced error handling middleware
 */
export function errorHandler() {
	return createMiddleware<HonoEnv>(async (c, next) => {
		try {
			await next()
		} catch (error) {
			handleError(error, c)
		}
	})
}

/**
 * Handle different types of errors
 */
function handleError(error: unknown, c: Context) {
	const { logger } = c.get('services')
	const requestId = c.get('requestId') || 'unknown'
	const path = c.req.path
	const method = c.req.method

	// Handle ApiError (our custom error type)
	if (error instanceof ApiError) {
		const statusCode = ERROR_STATUS_MAP[error.code] || 500

		const errorResponse: ErrorResponse = {
			code: error.code,
			message: error.message,
			details: error.details,
			timestamp: new Date().toISOString(),
			requestId,
			path,
		}

		// Log error with appropriate level
		const logLevel = statusCode >= 500 ? 'error' : 'warn'
		logger[logLevel](`API Error: ${error.code}`, {
			code: error.code,
			message: error.message,
			details: error.details,
			statusCode,
			requestId,
			path,
			method,
			userAgent: c.req.header('user-agent'),
			ip: getClientIP(c),
		})

		return c.json(errorResponse, statusCode as any)
	}

	// Handle Hono HTTPException
	if (error instanceof HTTPException) {
		const errorResponse: ErrorResponse = {
			code: getErrorCodeFromStatus(error.status),
			message: error.message,
			timestamp: new Date().toISOString(),
			requestId,
			path,
		}

		logger.warn(`HTTP Exception: ${error.status}`, {
			status: error.status,
			message: error.message,
			requestId,
			path,
			method,
		})

		return c.json(errorResponse, error.status)
	}

	// Handle validation errors (Zod)
	if (error && typeof error === 'object' && 'issues' in error) {
		const validationError = error as any

		const errorResponse: ErrorResponse = {
			code: 'VALIDATION_ERROR',
			message: 'Request validation failed',
			details: {
				issues: validationError.issues?.map((issue: any) => ({
					path: issue.path?.join('.'),
					message: issue.message,
					code: issue.code,
				})),
			},
			timestamp: new Date().toISOString(),
			requestId,
			path,
		}

		logger.warn('Validation error', {
			issues: validationError.issues,
			requestId,
			path,
			method,
		})

		return c.json(errorResponse, 400 as any)
	}

	// Handle database errors
	if (error instanceof Error && isDatabaseError(error)) {
		const errorResponse: ErrorResponse = {
			code: 'DATABASE_ERROR',
			message: 'Database operation failed',
			timestamp: new Date().toISOString(),
			requestId,
			path,
		}

		logger.error('Database error', {
			error: error.message,
			stack: error.stack,
			requestId,
			path,
			method,
		})

		return c.json(errorResponse, 503 as any)
	}

	// Handle Redis errors
	if (error instanceof Error && isRedisError(error)) {
		const errorResponse: ErrorResponse = {
			code: 'REDIS_ERROR',
			message: 'Cache operation failed',
			timestamp: new Date().toISOString(),
			requestId,
			path,
		}

		logger.error('Redis error', {
			error: error.message,
			stack: error.stack,
			requestId,
			path,
			method,
		})

		return c.json(errorResponse, 503 as any)
	}

	// Handle generic errors
	const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
	const errorStack = error instanceof Error ? error.stack : undefined

	const errorResponse: ErrorResponse = {
		code: 'INTERNAL_SERVER_ERROR',
		message: 'An unexpected error occurred',
		timestamp: new Date().toISOString(),
		requestId,
		path,
	}

	logger.error('Unhandled error', {
		error: errorMessage,
		stack: errorStack,
		requestId,
		path,
		method,
		userAgent: c.req.header('user-agent'),
		ip: getClientIP(c),
	})

	return c.json(errorResponse, 500 as any)
}

/**
 * Get error code from HTTP status
 */
function getErrorCodeFromStatus(status: number): string {
	switch (status) {
		case 400:
			return 'BAD_REQUEST'
		case 401:
			return 'UNAUTHORIZED'
		case 403:
			return 'FORBIDDEN'
		case 404:
			return 'NOT_FOUND'
		case 405:
			return 'METHOD_NOT_ALLOWED'
		case 409:
			return 'CONFLICT'
		case 415:
			return 'UNSUPPORTED_MEDIA_TYPE'
		case 422:
			return 'UNPROCESSABLE_ENTITY'
		case 429:
			return 'RATE_LIMIT_EXCEEDED'
		case 500:
			return 'INTERNAL_SERVER_ERROR'
		case 501:
			return 'NOT_IMPLEMENTED'
		case 502:
			return 'BAD_GATEWAY'
		case 503:
			return 'SERVICE_UNAVAILABLE'
		case 504:
			return 'GATEWAY_TIMEOUT'
		default:
			return 'UNKNOWN_ERROR'
	}
}

/**
 * Check if error is a database error
 */
function isDatabaseError(error: Error): boolean {
	const message = error.message.toLowerCase()
	const stack = error.stack?.toLowerCase() || ''

	return (
		message.includes('database') ||
		message.includes('connection') ||
		message.includes('postgres') ||
		message.includes('sql') ||
		stack.includes('pg') ||
		stack.includes('postgres') ||
		error.name === 'DatabaseError'
	)
}

/**
 * Check if error is a Redis error
 */
function isRedisError(error: Error): boolean {
	const message = error.message.toLowerCase()
	const stack = error.stack?.toLowerCase() || ''

	return (
		message.includes('redis') ||
		message.includes('connection refused') ||
		stack.includes('redis') ||
		stack.includes('ioredis') ||
		error.name === 'RedisError'
	)
}

/**
 * Get client IP address
 */
function getClientIP(c: Context): string {
	const forwarded = c.req.header('x-forwarded-for')
	if (forwarded) {
		return forwarded.split(',')[0].trim()
	}

	const realIP = c.req.header('x-real-ip')
	if (realIP) {
		return realIP
	}

	return c.env?.incoming?.socket?.remoteAddress || '127.0.0.1'
}

/**
 * Middleware to handle 404 errors for unmatched routes
 */
export function notFoundHandler() {
	return createMiddleware<HonoEnv>(async (c) => {
		const requestId = c.get('requestId') || 'unknown'

		const errorResponse: ErrorResponse = {
			code: 'NOT_FOUND',
			message: `Route ${c.req.method} ${c.req.path} not found`,
			timestamp: new Date().toISOString(),
			requestId,
			path: c.req.path,
		}

		const { logger } = c.get('services')
		logger.warn('Route not found', {
			method: c.req.method,
			path: c.req.path,
			requestId,
			userAgent: c.req.header('user-agent'),
			ip: getClientIP(c),
		})

		return c.json(errorResponse, 404 as any)
	})
}

/**
 * Middleware to handle method not allowed errors
 */
export function methodNotAllowedHandler(allowedMethods: string[]) {
	return createMiddleware<HonoEnv>(async (c) => {
		const requestId = c.get('requestId') || 'unknown'

		const errorResponse: ErrorResponse = {
			code: 'METHOD_NOT_ALLOWED',
			message: `Method ${c.req.method} not allowed for ${c.req.path}`,
			details: {
				allowedMethods,
			},
			timestamp: new Date().toISOString(),
			requestId,
			path: c.req.path,
		}

		// Set Allow header
		c.header('Allow', allowedMethods.join(', '))

		const { logger } = c.get('services')
		logger.warn('Method not allowed', {
			method: c.req.method,
			path: c.req.path,
			allowedMethods: JSON.stringify(allowedMethods),
			requestId,
		})

		return c.json(errorResponse, 405 as any)
	})
}
