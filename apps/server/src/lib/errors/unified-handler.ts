/**
 * @fileoverview Unified Error Handling System
 *
 * Provides consistent error handling across all API types:
 * - TRPC error handling with proper error codes
 * - REST API error responses with HTTP status codes
 * - GraphQL error formatting with extensions
 * - Structured error logging with context
 *
 * Requirements: 1.5, 2.3, 3.5, 6.3
 */

import { TRPCError } from '@trpc/server'
import { GraphQLError } from 'graphql'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { ApiError, ErrorSchema } from './http'
import { CircuitBreakerOpenError, ServiceDegradedError, TimeoutError } from './resilience'

import type { GraphQLFormattedError } from 'graphql'
import type { Context } from 'hono'
import type { HonoEnv } from '../hono/context'
import type { StructuredLogger } from '../services/logging'

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Error categories for classification
 */
export type ErrorCategory =
	| 'validation'
	| 'authentication'
	| 'authorization'
	| 'not_found'
	| 'conflict'
	| 'rate_limit'
	| 'timeout'
	| 'circuit_breaker'
	| 'service_degraded'
	| 'database'
	| 'external_service'
	| 'internal'
	| 'network'

/**
 * Enhanced error context
 */
export interface EnhancedErrorContext {
	requestId: string
	userId?: string
	sessionId?: string
	organizationId?: string
	endpoint: string
	method: string
	userAgent?: string
	ip?: string
	timestamp: string
	apiType: 'trpc' | 'rest' | 'graphql'
	operation?: string
	variables?: Record<string, any>
	metadata?: Record<string, any>
}

/**
 * Structured error information
 */
export interface StructuredError {
	id: string
	code: string
	message: string
	category: ErrorCategory
	severity: ErrorSeverity
	context: EnhancedErrorContext
	stack?: string
	cause?: any
	retryable: boolean
	userFacing: boolean
}

/**
 * Error classification rules
 */
export class ErrorClassifier {
	/**
	 * Classify error and determine appropriate handling
	 */
	static classify(error: any): {
		category: ErrorCategory
		severity: ErrorSeverity
		retryable: boolean
		userFacing: boolean
	} {
		// Circuit breaker errors
		if (error instanceof CircuitBreakerOpenError) {
			return {
				category: 'circuit_breaker',
				severity: 'high',
				retryable: false,
				userFacing: true,
			}
		}

		// Timeout errors
		if (error instanceof TimeoutError) {
			return {
				category: 'timeout',
				severity: 'medium',
				retryable: true,
				userFacing: true,
			}
		}

		// Service degradation errors
		if (error instanceof ServiceDegradedError) {
			return {
				category: 'service_degraded',
				severity: 'medium',
				retryable: true,
				userFacing: true,
			}
		}

		// TRPC errors
		if (error instanceof TRPCError) {
			return this.classifyTRPCError(error)
		}

		// HTTP exceptions
		if (error instanceof HTTPException || error instanceof ApiError) {
			return this.classifyHTTPError(error)
		}

		// GraphQL errors
		if (error instanceof GraphQLError) {
			return this.classifyGraphQLError(error)
		}

		// Database errors
		if (this.isDatabaseError(error)) {
			return {
				category: 'database',
				severity: 'high',
				retryable: false,
				userFacing: false,
			}
		}

		// Network errors
		if (this.isNetworkError(error)) {
			return {
				category: 'network',
				severity: 'medium',
				retryable: true,
				userFacing: false,
			}
		}

		// Validation errors
		if (this.isValidationError(error)) {
			return {
				category: 'validation',
				severity: 'low',
				retryable: false,
				userFacing: true,
			}
		}

		// Default to internal error
		return {
			category: 'internal',
			severity: 'critical',
			retryable: false,
			userFacing: false,
		}
	}

	private static classifyTRPCError(error: TRPCError): {
		category: ErrorCategory
		severity: ErrorSeverity
		retryable: boolean
		userFacing: boolean
	} {
		switch (error.code) {
			case 'BAD_REQUEST':
				return {
					category: 'validation',
					severity: 'low',
					retryable: false,
					userFacing: true,
				}
			case 'UNAUTHORIZED':
				return {
					category: 'authentication',
					severity: 'medium',
					retryable: false,
					userFacing: true,
				}
			case 'FORBIDDEN':
				return {
					category: 'authorization',
					severity: 'medium',
					retryable: false,
					userFacing: true,
				}
			case 'NOT_FOUND':
				return {
					category: 'not_found',
					severity: 'low',
					retryable: false,
					userFacing: true,
				}
			case 'CONFLICT':
				return {
					category: 'conflict',
					severity: 'medium',
					retryable: false,
					userFacing: true,
				}
			case 'TOO_MANY_REQUESTS':
				return {
					category: 'rate_limit',
					severity: 'medium',
					retryable: true,
					userFacing: true,
				}
			case 'TIMEOUT':
				return {
					category: 'timeout',
					severity: 'medium',
					retryable: true,
					userFacing: true,
				}
			case 'INTERNAL_SERVER_ERROR':
			default:
				return {
					category: 'internal',
					severity: 'critical',
					retryable: false,
					userFacing: false,
				}
		}
	}

	private static classifyHTTPError(error: HTTPException | ApiError): {
		category: ErrorCategory
		severity: ErrorSeverity
		retryable: boolean
		userFacing: boolean
	} {
		const status = error.status

		if (status >= 400 && status < 500) {
			switch (status) {
				case 400:
					return {
						category: 'validation',
						severity: 'low',
						retryable: false,
						userFacing: true,
					}
				case 401:
					return {
						category: 'authentication',
						severity: 'medium',
						retryable: false,
						userFacing: true,
					}
				case 403:
					return {
						category: 'authorization',
						severity: 'medium',
						retryable: false,
						userFacing: true,
					}
				case 404:
					return {
						category: 'not_found',
						severity: 'low',
						retryable: false,
						userFacing: true,
					}
				case 409:
					return {
						category: 'conflict',
						severity: 'medium',
						retryable: false,
						userFacing: true,
					}
				case 429:
					return {
						category: 'rate_limit',
						severity: 'medium',
						retryable: true,
						userFacing: true,
					}
				default:
					return {
						category: 'validation',
						severity: 'low',
						retryable: false,
						userFacing: true,
					}
			}
		}

		return {
			category: 'internal',
			severity: 'critical',
			retryable: false,
			userFacing: false,
		}
	}

	private static classifyGraphQLError(error: GraphQLError): {
		category: ErrorCategory
		severity: ErrorSeverity
		retryable: boolean
		userFacing: boolean
	} {
		const extensions = error.extensions || {}
		const code = extensions.code as string

		switch (code) {
			case 'UNAUTHENTICATED':
				return {
					category: 'authentication',
					severity: 'medium',
					retryable: false,
					userFacing: true,
				}
			case 'FORBIDDEN':
				return {
					category: 'authorization',
					severity: 'medium',
					retryable: false,
					userFacing: true,
				}
			case 'BAD_USER_INPUT':
				return {
					category: 'validation',
					severity: 'low',
					retryable: false,
					userFacing: true,
				}
			default:
				return {
					category: 'internal',
					severity: 'critical',
					retryable: false,
					userFacing: false,
				}
		}
	}

	private static isDatabaseError(error: any): boolean {
		const message = error.message?.toLowerCase() || ''
		const name = error.name?.toLowerCase() || ''

		return (
			name.includes('database') ||
			name.includes('postgres') ||
			name.includes('sql') ||
			message.includes('connection') ||
			message.includes('database') ||
			message.includes('constraint') ||
			error.code === 'ECONNREFUSED'
		)
	}

	private static isNetworkError(error: any): boolean {
		const message = error.message?.toLowerCase() || ''
		const code = error.code || ''

		return (
			code === 'ECONNRESET' ||
			code === 'ENOTFOUND' ||
			code === 'ECONNREFUSED' ||
			code === 'ETIMEDOUT' ||
			message.includes('network') ||
			message.includes('connection')
		)
	}

	private static isValidationError(error: any): boolean {
		return (
			error.name === 'ZodError' ||
			error.name === 'ValidationError' ||
			error.message?.includes('validation') ||
			error.message?.includes('invalid')
		)
	}
}

/**
 * Unified error handler for all API types
 */
export class UnifiedErrorHandler {
	constructor(private readonly logger: StructuredLogger) {}

	/**
	 * Handle TRPC errors
	 */
	handleTRPCError(error: any, context: EnhancedErrorContext): TRPCError {
		const structuredError = this.createStructuredError(error, context)
		this.logError(structuredError)

		// Convert to appropriate TRPC error
		if (error instanceof TRPCError) {
			return error
		}

		if (error instanceof CircuitBreakerOpenError) {
			return new TRPCError({
				code: 'SERVICE_UNAVAILABLE',
				message: 'Service temporarily unavailable',
				cause: error,
			})
		}

		if (error instanceof TimeoutError) {
			return new TRPCError({
				code: 'TIMEOUT',
				message: 'Request timed out',
				cause: error,
			})
		}

		if (error instanceof ServiceDegradedError) {
			return new TRPCError({
				code: 'SERVICE_UNAVAILABLE',
				message: 'Service is experiencing issues',
				cause: error,
			})
		}

		const classification = ErrorClassifier.classify(error)

		switch (classification.category) {
			case 'validation':
				return new TRPCError({
					code: 'BAD_REQUEST',
					message: structuredError.userFacing ? error.message : 'Invalid request',
					cause: error,
				})
			case 'authentication':
				return new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Authentication required',
					cause: error,
				})
			case 'authorization':
				return new TRPCError({
					code: 'FORBIDDEN',
					message: 'Access denied',
					cause: error,
				})
			case 'not_found':
				return new TRPCError({
					code: 'NOT_FOUND',
					message: 'Resource not found',
					cause: error,
				})
			case 'conflict':
				return new TRPCError({
					code: 'CONFLICT',
					message: 'Resource conflict',
					cause: error,
				})
			case 'rate_limit':
				return new TRPCError({
					code: 'TOO_MANY_REQUESTS',
					message: 'Rate limit exceeded',
					cause: error,
				})
			default:
				return new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'An unexpected error occurred',
					cause: error,
				})
		}
	}

	/**
	 * Handle REST API errors
	 */
	handleRESTError(error: any, context: EnhancedErrorContext, c: Context<HonoEnv>): Response {
		const structuredError = this.createStructuredError(error, context)
		this.logError(structuredError)

		// Handle known error types
		if (error instanceof ApiError || error instanceof HTTPException) {
			return c.json<z.infer<typeof ErrorSchema>>(
				{
					error: {
						code: (error as any).code || this.getErrorCodeFromStatus(error.status),
						docs: `${process.env.APP_PUBLIC_URL}/docs/api-reference/errors/code/${(error as any).code || this.getErrorCodeFromStatus(error.status)}`,
						message: error.message,
						requestId: context.requestId,
						details: (error as any).details,
					},
				},
				{ status: error.status }
			)
		}

		if (error instanceof CircuitBreakerOpenError) {
			return c.json<z.infer<typeof ErrorSchema>>(
				{
					error: {
						code: 'SERVICE_UNAVAILABLE',
						docs: `${process.env.APP_PUBLIC_URL}/docs/api-reference/errors/code/SERVICE_UNAVAILABLE`,
						message: 'Service temporarily unavailable',
						requestId: context.requestId,
					},
				},
				{ status: 503 }
			)
		}

		if (error instanceof TimeoutError) {
			return c.json<z.infer<typeof ErrorSchema>>(
				{
					error: {
						code: 'TIMEOUT',
						docs: `${process.env.APP_PUBLIC_URL}/docs/api-reference/errors/code/TIMEOUT`,
						message: 'Request timed out',
						requestId: context.requestId,
					},
				},
				{ status: 408 }
			)
		}

		const classification = ErrorClassifier.classify(error)
		const status = this.getStatusFromCategory(classification.category)
		const code = this.getErrorCodeFromStatus(status)

		return c.json<z.infer<typeof ErrorSchema>>(
			{
				error: {
					code,
					docs: `${process.env.APP_PUBLIC_URL}/docs/api-reference/errors/code/${code}`,
					message: structuredError.userFacing ? error.message : 'An error occurred',
					requestId: context.requestId,
				},
			},
			{ status }
		)
	}

	/**
	 * Handle GraphQL errors
	 */
	handleGraphQLError(error: any, context: EnhancedErrorContext): GraphQLFormattedError {
		const structuredError = this.createStructuredError(error, context)
		this.logError(structuredError)

		if (error instanceof GraphQLError) {
			return {
				message: error.message,
				locations: error.locations,
				path: error.path,
				extensions: {
					...error.extensions,
					requestId: context.requestId,
					timestamp: context.timestamp,
				},
			}
		}

		if (error instanceof CircuitBreakerOpenError) {
			return {
				message: 'Service temporarily unavailable',
				extensions: {
					code: 'SERVICE_UNAVAILABLE',
					requestId: context.requestId,
					timestamp: context.timestamp,
				},
			}
		}

		if (error instanceof TimeoutError) {
			return {
				message: 'Request timed out',
				extensions: {
					code: 'TIMEOUT',
					requestId: context.requestId,
					timestamp: context.timestamp,
				},
			}
		}

		const classification = ErrorClassifier.classify(error)

		return {
			message: structuredError.userFacing ? error.message : 'An error occurred',
			extensions: {
				code: this.getGraphQLCodeFromCategory(classification.category),
				category: classification.category,
				severity: classification.severity,
				retryable: classification.retryable,
				requestId: context.requestId,
				timestamp: context.timestamp,
			},
		}
	}

	/**
	 * Create structured error information
	 */
	private createStructuredError(error: any, context: EnhancedErrorContext): StructuredError {
		const classification = ErrorClassifier.classify(error)

		return {
			id: crypto.randomUUID(),
			code: error.code || error.name || 'UNKNOWN_ERROR',
			message: error.message || 'An unknown error occurred',
			category: classification.category,
			severity: classification.severity,
			context,
			stack: error.stack,
			cause: error.cause,
			retryable: classification.retryable,
			userFacing: classification.userFacing,
		}
	}

	/**
	 * Log structured error
	 */
	private logError(structuredError: StructuredError): void {
		const logLevel = this.getLogLevelFromSeverity(structuredError.severity)
		const logContext = {
			requestId: structuredError.context.requestId,
			userId: structuredError.context.userId,
			sessionId: structuredError.context.sessionId,
			organizationId: structuredError.context.organizationId,
			endpoint: structuredError.context.endpoint,
			method: structuredError.context.method,
			apiType: structuredError.context.apiType,
		}

		const metadata = {
			errorId: structuredError.id,
			errorCode: structuredError.code,
			category: structuredError.category,
			severity: structuredError.severity,
			retryable: structuredError.retryable,
			userFacing: structuredError.userFacing,
			operation: structuredError.context.operation,
			...structuredError.context.metadata,
		}

		switch (logLevel) {
			case 'error':
				this.logger.error(
					structuredError.message,
					structuredError.stack ? new Error(structuredError.message) : structuredError.message,
					metadata,
					logContext
				)
				break
			case 'warn':
				this.logger.warn(structuredError.message, metadata, logContext)
				break
			case 'info':
				this.logger.info(structuredError.message, metadata, logContext)
				break
			default:
				this.logger.debug(structuredError.message, metadata, logContext)
				break
		}
	}

	private getLogLevelFromSeverity(severity: ErrorSeverity): 'debug' | 'info' | 'warn' | 'error' {
		switch (severity) {
			case 'critical':
			case 'high':
				return 'error'
			case 'medium':
				return 'warn'
			case 'low':
				return 'info'
			default:
				return 'debug'
		}
	}

	private getStatusFromCategory(category: ErrorCategory): number {
		switch (category) {
			case 'validation':
				return 400
			case 'authentication':
				return 401
			case 'authorization':
				return 403
			case 'not_found':
				return 404
			case 'conflict':
				return 409
			case 'rate_limit':
				return 429
			case 'timeout':
				return 408
			case 'circuit_breaker':
			case 'service_degraded':
				return 503
			default:
				return 500
		}
	}

	private getErrorCodeFromStatus(status: number): string {
		switch (status) {
			case 400:
				return 'BAD_REQUEST'
			case 401:
				return 'UNAUTHORIZED'
			case 403:
				return 'FORBIDDEN'
			case 404:
				return 'NOT_FOUND'
			case 408:
				return 'TIMEOUT'
			case 409:
				return 'CONFLICT'
			case 429:
				return 'RATE_LIMITED'
			case 503:
				return 'SERVICE_UNAVAILABLE'
			default:
				return 'INTERNAL_SERVER_ERROR'
		}
	}

	private getGraphQLCodeFromCategory(category: ErrorCategory): string {
		switch (category) {
			case 'validation':
				return 'BAD_USER_INPUT'
			case 'authentication':
				return 'UNAUTHENTICATED'
			case 'authorization':
				return 'FORBIDDEN'
			case 'not_found':
				return 'NOT_FOUND'
			case 'timeout':
				return 'TIMEOUT'
			case 'circuit_breaker':
			case 'service_degraded':
				return 'SERVICE_UNAVAILABLE'
			default:
				return 'INTERNAL_ERROR'
		}
	}
}
