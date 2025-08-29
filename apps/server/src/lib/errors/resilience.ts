/**
 * @fileoverview Resilience and Error Handling System
 *
 * Provides comprehensive error handling and resilience patterns:
 * - Circuit breaker pattern for external service calls
 * - Retry mechanisms with exponential backoff
 * - Graceful degradation for service failures
 * - Unified error handling across all API types
 *
 * Requirements: 1.5, 2.3, 3.5, 6.3
 */

import { TRPCError } from '@trpc/server'
import { GraphQLError } from 'graphql'
import { HTTPException } from 'hono/http-exception'

import type { Context } from 'hono'
import type { StructuredLogger } from '../services/logging'

/**
 * Circuit breaker states
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
	failureThreshold: number
	recoveryTimeout: number
	monitoringPeriod: number
	halfOpenMaxCalls: number
	name: string
}

/**
 * Retry configuration
 */
export interface RetryConfig {
	maxRetries: number
	baseDelay: number
	maxDelay: number
	backoffMultiplier: number
	jitter: boolean
	retryableErrors: string[]
}

/**
 * Error context for logging and tracking
 */
export interface ErrorContext {
	requestId?: string
	userId?: string
	sessionId?: string
	organizationId?: string
	service?: string
	operation?: string
	metadata?: Record<string, any>
}

/**
 * Service health status
 */
export interface ServiceHealth {
	name: string
	status: 'healthy' | 'degraded' | 'unhealthy'
	lastCheck: Date
	errorRate: number
	responseTime: number
	circuitBreakerState: CircuitBreakerState
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
	private state: CircuitBreakerState = 'CLOSED'
	private failureCount = 0
	private successCount = 0
	private lastFailureTime?: number
	private halfOpenCalls = 0
	private readonly metrics: {
		totalCalls: number
		successfulCalls: number
		failedCalls: number
		timeouts: number
		circuitBreakerTrips: number
	} = {
		totalCalls: 0,
		successfulCalls: 0,
		failedCalls: 0,
		timeouts: 0,
		circuitBreakerTrips: 0,
	}

	constructor(
		private readonly config: CircuitBreakerConfig,
		private readonly logger?: StructuredLogger
	) {}

	/**
	 * Execute operation with circuit breaker protection
	 */
	async execute<T>(operation: () => Promise<T>): Promise<T> {
		this.metrics.totalCalls++

		if (this.state === 'OPEN') {
			if (this.shouldAttemptReset()) {
				this.state = 'HALF_OPEN'
				this.halfOpenCalls = 0
				this.logger?.info('Circuit breaker transitioning to HALF_OPEN', {
					circuitBreaker: this.config.name,
					state: this.state,
				})
			} else {
				this.metrics.circuitBreakerTrips++
				throw new CircuitBreakerOpenError(
					`Circuit breaker is OPEN for service: ${this.config.name}`
				)
			}
		}

		if (this.state === 'HALF_OPEN') {
			if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
				this.metrics.circuitBreakerTrips++
				throw new CircuitBreakerOpenError(
					`Circuit breaker HALF_OPEN max calls exceeded for service: ${this.config.name}`
				)
			}
			this.halfOpenCalls++
		}

		try {
			const result = await operation()
			this.onSuccess()
			return result
		} catch (error) {
			this.onFailure(error)
			throw error
		}
	}

	/**
	 * Get current circuit breaker status
	 */
	getStatus(): ServiceHealth {
		const now = new Date()
		const errorRate =
			this.metrics.totalCalls > 0 ? this.metrics.failedCalls / this.metrics.totalCalls : 0

		return {
			name: this.config.name,
			status:
				this.state === 'CLOSED' ? 'healthy' : this.state === 'HALF_OPEN' ? 'degraded' : 'unhealthy',
			lastCheck: now,
			errorRate,
			responseTime: 0, // Would be calculated from actual response times
			circuitBreakerState: this.state,
		}
	}

	/**
	 * Get circuit breaker metrics
	 */
	getMetrics() {
		return {
			...this.metrics,
			state: this.state,
			failureCount: this.failureCount,
			successCount: this.successCount,
			config: this.config,
		}
	}

	/**
	 * Reset circuit breaker to closed state
	 */
	reset(): void {
		this.state = 'CLOSED'
		this.failureCount = 0
		this.successCount = 0
		this.halfOpenCalls = 0
		this.lastFailureTime = undefined
		this.logger?.info('Circuit breaker reset', {
			circuitBreaker: this.config.name,
			state: this.state,
		})
	}

	private onSuccess(): void {
		this.successCount++
		this.metrics.successfulCalls++

		if (this.state === 'HALF_OPEN') {
			// If we've had enough successful calls in HALF_OPEN, close the circuit
			if (this.successCount >= this.config.halfOpenMaxCalls) {
				this.state = 'CLOSED'
				this.failureCount = 0
				this.successCount = 0
				this.halfOpenCalls = 0
				this.logger?.info('Circuit breaker closed after successful recovery', {
					circuitBreaker: this.config.name,
					state: this.state,
				})
			}
		} else if (this.state === 'CLOSED') {
			// Reset failure count on success
			this.failureCount = 0
		}
	}

	private onFailure(error: any): void {
		this.failureCount++
		this.metrics.failedCalls++
		this.lastFailureTime = Date.now()

		if (error instanceof TimeoutError) {
			this.metrics.timeouts++
		}

		this.logger?.warn('Circuit breaker recorded failure', {
			circuitBreaker: this.config.name,
			state: this.state,
			failureCount: this.failureCount,
			error: error.message,
		})

		if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
			this.state = 'OPEN'
			this.metrics.circuitBreakerTrips++
			this.logger?.error('Circuit breaker opened due to failures', {
				circuitBreaker: this.config.name,
				state: this.state,
				failureCount: this.failureCount,
				threshold: this.config.failureThreshold,
			})
		} else if (this.state === 'HALF_OPEN') {
			// Any failure in HALF_OPEN state should open the circuit
			this.state = 'OPEN'
			this.metrics.circuitBreakerTrips++
			this.logger?.error('Circuit breaker opened from HALF_OPEN due to failure', {
				circuitBreaker: this.config.name,
				state: this.state,
			})
		}
	}

	private shouldAttemptReset(): boolean {
		return (
			this.lastFailureTime !== undefined &&
			Date.now() - this.lastFailureTime >= this.config.recoveryTimeout
		)
	}
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryHandler {
	constructor(
		private readonly config: RetryConfig,
		private readonly logger?: StructuredLogger
	) {}

	/**
	 * Execute operation with retry logic
	 */
	async execute<T>(operation: () => Promise<T>, context?: ErrorContext): Promise<T> {
		let lastError: Error
		let attempt = 0

		while (attempt <= this.config.maxRetries) {
			try {
				if (attempt > 0) {
					this.logger?.info('Retrying operation', {
						attempt,
						maxRetries: this.config.maxRetries,
						...context,
					})
				}

				return await operation()
			} catch (error) {
				lastError = error as Error
				attempt++

				// Check if error is retryable
				if (!this.isRetryableError(error)) {
					this.logger?.warn('Non-retryable error encountered', {
						error: lastError.message,
						attempt,
						...context,
					})
					throw error
				}

				// Don't retry if we've exceeded max attempts
				if (attempt > this.config.maxRetries) {
					this.logger?.error('Max retry attempts exceeded', {
						error: lastError.message,
						attempts: attempt,
						maxRetries: this.config.maxRetries,
						...context,
					})
					break
				}

				// Calculate delay with exponential backoff
				const delay = this.calculateDelay(attempt)

				this.logger?.warn('Operation failed, retrying after delay', {
					error: lastError.message,
					attempt,
					delay,
					...context,
				})

				await this.sleep(delay)
			}
		}

		throw lastError!
	}

	private isRetryableError(error: any): boolean {
		if (error instanceof CircuitBreakerOpenError) {
			return false // Don't retry circuit breaker errors
		}

		if (error instanceof TimeoutError) {
			return true // Timeouts are retryable
		}

		// Check against configured retryable error patterns
		const errorMessage = error.message || error.toString()
		return this.config.retryableErrors.some((pattern) =>
			errorMessage.toLowerCase().includes(pattern.toLowerCase())
		)
	}

	private calculateDelay(attempt: number): number {
		let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)
		delay = Math.min(delay, this.config.maxDelay)

		// Add jitter if enabled
		if (this.config.jitter) {
			delay = delay * (0.5 + Math.random() * 0.5)
		}

		return Math.floor(delay)
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
}

/**
 * Service degradation handler
 */
export class ServiceDegradationHandler {
	private readonly serviceHealth = new Map<string, ServiceHealth>()
	private readonly fallbackHandlers = new Map<string, () => any>()

	constructor(private readonly logger?: StructuredLogger) {}

	/**
	 * Register a fallback handler for a service
	 */
	registerFallback(serviceName: string, fallbackHandler: () => any): void {
		this.fallbackHandlers.set(serviceName, fallbackHandler)
	}

	/**
	 * Update service health status
	 */
	updateServiceHealth(health: ServiceHealth): void {
		this.serviceHealth.set(health.name, health)

		if (health.status === 'unhealthy') {
			this.logger?.warn('Service marked as unhealthy', {
				service: health.name,
				status: health.status,
				errorRate: health.errorRate,
			})
		}
	}

	/**
	 * Execute operation with graceful degradation
	 */
	async executeWithDegradation<T>(
		serviceName: string,
		operation: () => Promise<T>,
		context?: ErrorContext
	): Promise<T> {
		const health = this.serviceHealth.get(serviceName)

		// If service is unhealthy, try fallback first
		if (health?.status === 'unhealthy') {
			const fallback = this.fallbackHandlers.get(serviceName)
			if (fallback) {
				this.logger?.info('Using fallback for unhealthy service', {
					service: serviceName,
					...context,
				})
				return fallback()
			}
		}

		try {
			return await operation()
		} catch (error) {
			// Try fallback on error
			const fallback = this.fallbackHandlers.get(serviceName)
			if (fallback) {
				this.logger?.warn('Primary operation failed, using fallback', {
					service: serviceName,
					error: (error as Error).message,
					...context,
				})
				return fallback()
			}
			throw error
		}
	}

	/**
	 * Get all service health statuses
	 */
	getAllServiceHealth(): ServiceHealth[] {
		return Array.from(this.serviceHealth.values())
	}

	/**
	 * Get specific service health
	 */
	getServiceHealth(serviceName: string): ServiceHealth | undefined {
		return this.serviceHealth.get(serviceName)
	}
}

/**
 * Custom error types
 */
export class CircuitBreakerOpenError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'CircuitBreakerOpenError'
	}
}

export class TimeoutError extends Error {
	constructor(
		message: string,
		public readonly timeoutMs: number
	) {
		super(message)
		this.name = 'TimeoutError'
	}
}

export class ServiceDegradedError extends Error {
	constructor(
		message: string,
		public readonly serviceName: string
	) {
		super(message)
		this.name = 'ServiceDegradedError'
	}
}

/**
 * Timeout wrapper for operations
 */
export function withTimeout<T>(
	operation: () => Promise<T>,
	timeoutMs: number,
	errorMessage?: string
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(
				new TimeoutError(errorMessage || `Operation timed out after ${timeoutMs}ms`, timeoutMs)
			)
		}, timeoutMs)

		operation()
			.then(resolve)
			.catch(reject)
			.finally(() => clearTimeout(timer))
	})
}

/**
 * Default configurations
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
	failureThreshold: 5,
	recoveryTimeout: 60000, // 1 minute
	monitoringPeriod: 10000, // 10 seconds
	halfOpenMaxCalls: 3,
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelay: 1000, // 1 second
	maxDelay: 30000, // 30 seconds
	backoffMultiplier: 2,
	jitter: true,
	retryableErrors: [
		'timeout',
		'connection',
		'network',
		'temporary',
		'unavailable',
		'ECONNRESET',
		'ENOTFOUND',
		'ECONNREFUSED',
	],
}
