/**
 * @fileoverview Enhanced Error Handling Middleware
 *
 * Provides comprehensive error handling middleware for all API types:
 * - Global error handler for Hono
 * - TRPC error middleware
 * - GraphQL error formatter
 * - Request context enrichment
 *
 * Requirements: 1.5, 2.3, 3.5, 6.3
 */

import { TRPCError } from '@trpc/server'
import { GraphQLError } from 'graphql'

import { LoggerFactory } from '@repo/logs'

import { handleError } from '../errors/http'
import { UnifiedErrorHandler } from '../errors/unified-handler'

import type { GraphQLFormattedError } from 'graphql'
import type { MiddlewareHandler } from 'hono'
import type { EnhancedErrorContext } from '../errors/unified-handler'
import type { HonoEnv } from '../hono/context'

/**
 * Global error handling middleware for Hono
 */
export function createGlobalErrorHandler(): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		try {
			await next()
		} catch (error) {
			// Use existing error handler but with enhanced context
			const context: EnhancedErrorContext = {
				requestId: c.get('requestId'),
				userId: c.get('session')?.session.userId,
				sessionId: c.get('session')?.session.id,
				organizationId: c.get('session')?.session.activeOrganizationId || undefined,
				endpoint: c.req.path,
				method: c.req.method,
				userAgent: c.req.header('user-agent'),
				ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
				timestamp: new Date().toISOString(),
				apiType: 'rest',
				metadata: {
					headers: Object.fromEntries(c.req.raw.headers.entries()),
					query: c.req.query(),
				},
			}

			const services = c.get('services')
			if (services?.logger) {
				const unifiedHandler = new UnifiedErrorHandler(services.logger)
				return unifiedHandler.handleRESTError(error, context, c)
			}

			// Fallback to existing error handler
			return handleError(error as Error, c)
		}
	}
}

/**
 * TRPC error handling middleware
 */
export function createTRPCErrorHandler() {
	return async ({ error, ctx }: { error: any; ctx: any }) => {
		const context: EnhancedErrorContext = {
			requestId: ctx.requestId,
			userId: ctx.session?.session.userId,
			sessionId: ctx.session?.session.id,
			organizationId: ctx.session?.session.activeOrganizationId,
			endpoint: ctx.path || 'trpc',
			method: 'POST',
			timestamp: new Date().toISOString(),
			apiType: 'trpc',
			operation: ctx.procedure,
			variables: ctx.input,
		}

		if (ctx.services?.logger) {
			const unifiedHandler = new UnifiedErrorHandler(ctx.services.logger)
			throw unifiedHandler.handleTRPCError(error, context)
		}

		// Fallback error handling
		if (error instanceof TRPCError) {
			throw error
		}

		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'An unexpected error occurred',
			cause: error,
		})
	}
}

/**
 * GraphQL error formatter
 */
export function createGraphQLErrorFormatter() {
	return (error: GraphQLError, context?: any): GraphQLFormattedError => {
		const enhancedContext: EnhancedErrorContext = {
			requestId: context?.requestId || 'unknown',
			userId: context?.session?.session.userId,
			sessionId: context?.session?.session.id,
			organizationId: context?.session?.session.activeOrganizationId,
			endpoint: '/graphql',
			method: 'POST',
			timestamp: new Date().toISOString(),
			apiType: 'graphql',
			operation: context?.operationName,
			variables: context?.variables,
		}

		if (context?.services?.logger) {
			const unifiedHandler = new UnifiedErrorHandler(context.services.logger)
			return unifiedHandler.handleGraphQLError(error, enhancedContext)
		}

		// Fallback error formatting
		return {
			message: error.message,
			locations: error.locations,
			path: error.path,
			extensions: {
				code: error.extensions?.code || 'INTERNAL_ERROR',
				timestamp: enhancedContext.timestamp,
				requestId: enhancedContext.requestId,
			},
		}
	}
}

/**
 * Request context enrichment middleware
 */
export function createContextEnrichmentMiddleware(): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		// Enrich request context with additional information
		const startTime = Date.now()
		c.set('requestStartTime', startTime)

		// Add request metadata
		const metadata = {
			userAgent: c.req.header('user-agent'),
			ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
			referer: c.req.header('referer'),
			contentType: c.req.header('content-type'),
			acceptLanguage: c.req.header('accept-language'),
		}
		c.set('requestMetadata', metadata)

		try {
			await next()
		} finally {
			// Log request completion
			const endTime = Date.now()
			const duration = endTime - startTime
			const services = c.get('services')

			if (services?.logger) {
				services.logger.logRequestEnd(
					c.req.method,
					c.req.path,
					c.res.status,
					{
						requestId: c.get('requestId'),
						userId: c.get('session')?.session.userId,
						sessionId: c.get('session')?.session.id,
						organizationId: c.get('session')?.session.activeOrganizationId || undefined,
					},
					{
						duration,
						...metadata,
					}
				)
			}
		}
	}
}

/**
 * Error recovery middleware for graceful degradation
 */
export function createErrorRecoveryMiddleware(): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		try {
			await next()
		} catch (error) {
			const services = c.get('services')
			const logger = services?.logger || LoggerFactory.createLogger()

			// Log the error for monitoring
			logger.error('Request failed, attempting recovery', error as Error, {
				requestId: c.get('requestId'),
				endpoint: c.req.path,
				method: c.req.method,
			})

			// Check if we can provide a degraded response
			const path = c.req.path
			const method = c.req.method

			// Health check endpoints should always respond
			if (path.includes('/health') || path.includes('/ready')) {
				return c.json(
					{
						status: 'degraded',
						error: 'Service experiencing issues',
						timestamp: new Date().toISOString(),
					},
					503
				)
			}

			// Metrics endpoints can return cached data
			if (path.includes('/metrics')) {
				return c.json(
					{
						status: 'degraded',
						message: 'Metrics temporarily unavailable',
						timestamp: new Date().toISOString(),
					},
					503
				)
			}

			// For API endpoints, check if we have cached responses
			if (path.startsWith('/api/') && method === 'GET') {
				// Try to return cached response if available
				const cacheKey = `${method}:${path}`
				// This would integrate with your caching layer
				// For now, return a degraded response
				return c.json(
					{
						error: {
							code: 'SERVICE_DEGRADED',
							message: 'Service temporarily degraded, please try again later',
							requestId: c.get('requestId'),
							timestamp: new Date().toISOString(),
						},
					},
					503
				)
			}

			// Re-throw the error if no recovery is possible
			throw error
		}
	}
}

/**
 * Rate limiting error handler
 */
export function createRateLimitErrorHandler(): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		try {
			await next()
		} catch (error) {
			// Handle rate limiting errors specifically
			if (error instanceof Error && error.message.includes('rate limit')) {
				const services = c.get('services')
				if (services?.logger) {
					services.logger.warn('Rate limit exceeded', {
						requestId: c.get('requestId'),
						endpoint: c.req.path,
						method: c.req.method,
						ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
						userAgent: c.req.header('user-agent'),
					})
				}

				return c.json(
					{
						error: {
							code: 'RATE_LIMITED',
							message: 'Rate limit exceeded. Please try again later.',
							requestId: c.get('requestId'),
							retryAfter: 60, // seconds
						},
					},
					429
				)
			}

			throw error
		}
	}
}

/**
 * Timeout handling middleware
 */
export function createTimeoutMiddleware(timeoutMs: number = 30000): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Request timeout after ${timeoutMs}ms`))
			}, timeoutMs)
		})

		try {
			await Promise.race([next(), timeoutPromise])
		} catch (error) {
			if (error instanceof Error && error.message.includes('timeout')) {
				const services = c.get('services')
				if (services?.logger) {
					services.logger.warn('Request timeout', {
						requestId: c.get('requestId'),
						endpoint: c.req.path,
						method: c.req.method,
						timeout: timeoutMs,
					})
				}

				return c.json(
					{
						error: {
							code: 'TIMEOUT',
							message: 'Request timed out',
							requestId: c.get('requestId'),
							timeout: timeoutMs,
						},
					},
					408
				)
			}

			throw error
		}
	}
}

/**
 * Combine all error handling middleware
 */
export function createComprehensiveErrorHandling(
	options: {
		enableRecovery?: boolean
		enableRateLimit?: boolean
		timeoutMs?: number
	} = {}
): MiddlewareHandler<HonoEnv>[] {
	const middleware: MiddlewareHandler<HonoEnv>[] = []

	// Context enrichment (should be first)
	middleware.push(createContextEnrichmentMiddleware())

	// Timeout handling
	if (options.timeoutMs) {
		middleware.push(createTimeoutMiddleware(options.timeoutMs))
	}

	// Rate limit error handling
	if (options.enableRateLimit) {
		middleware.push(createRateLimitErrorHandler())
	}

	// Error recovery
	if (options.enableRecovery) {
		middleware.push(createErrorRecoveryMiddleware())
	}

	// Global error handler (should be last)
	middleware.push(createGlobalErrorHandler())

	return middleware
}
