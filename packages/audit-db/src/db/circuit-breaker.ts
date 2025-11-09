import { StructuredLogger } from '@repo/logs'

import { CircuitBreakerConfig, CircuitBreakerState, ICircuitBreaker } from './interfaces.js'

import type { LoggingConfig } from '@repo/logs'

/**
 * Circuit breaker implementation for database operations
 * Implements fault tolerance patterns following the design document specifications
 */

export interface CircuitBreakerMetrics {
	totalRequests: number
	successfulRequests: number
	failedRequests: number
	timeouts: number
	circuitBreakerOpens: number
	lastFailureTime?: Date
	lastSuccessTime?: Date
}

export interface CircuitBreakerStatus {
	state: CircuitBreakerState
	failureCount: number
	successCount: number
	nextAttemptTime?: Date
	metrics: CircuitBreakerMetrics
}

/**
 * Circuit breaker implementation with exponential backoff and jitter
 */
export class CircuitBreaker implements ICircuitBreaker {
	private state: CircuitBreakerState = CircuitBreakerState.CLOSED
	private failureCount = 0
	private successCount = 0
	private nextAttemptTime: Date | null = null
	private metrics: CircuitBreakerMetrics
	private readonly logger: StructuredLogger

	constructor(
		private readonly name: string,
		private readonly config: CircuitBreakerConfig,
		loggerConfig: LoggingConfig
	) {
		// Initialize Structured Logger
		this.logger = new StructuredLogger({
			...loggerConfig,
			service: `@repo/audit-db - CircuitBreaker[${name}]`,
		})

		this.metrics = {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			timeouts: 0,
			circuitBreakerOpens: 0,
		}
	}

	/**
	 * Execute operation with circuit breaker protection
	 */
	async execute<T>(operation: () => Promise<T>): Promise<T> {
		this.metrics.totalRequests++

		// Check circuit breaker state
		if (this.state === CircuitBreakerState.OPEN) {
			if (this.shouldAttemptReset()) {
				this.state = CircuitBreakerState.HALF_OPEN
				this.logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`)
			} else {
				const error = new CircuitBreakerOpenError(
					`Circuit breaker ${this.name} is OPEN. Next attempt at ${this.nextAttemptTime?.toISOString()}`
				)
				this.logger.warn(error.message)
				throw error
			}
		}

		const startTime = Date.now()
		let timeoutId: NodeJS.Timeout | null = null

		try {
			// Create timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					this.metrics.timeouts++
					reject(new Error(`Operation timed out after ${this.config.timeoutMs}ms`))
				}, this.config.timeoutMs)
			})

			// Race between operation and timeout
			const result = await Promise.race([operation(), timeoutPromise])

			// Clear timeout on success
			if (timeoutId) {
				clearTimeout(timeoutId)
			}

			this.onSuccess()
			return result
		} catch (error) {
			// Clear timeout on failure
			if (timeoutId) {
				clearTimeout(timeoutId)
			}

			this.onFailure(error as Error)
			throw error
		} finally {
			const duration = Date.now() - startTime
			this.logger.debug(`Circuit breaker ${this.name} operation completed in ${duration}ms`)
		}
	}

	/**
	 * Get current circuit breaker state
	 */
	getState(): CircuitBreakerState {
		return this.state
	}

	/**
	 * Reset circuit breaker to closed state
	 */
	reset(): void {
		this.state = CircuitBreakerState.CLOSED
		this.failureCount = 0
		this.successCount = 0
		this.nextAttemptTime = null
		this.logger.info(`Circuit breaker ${this.name} manually reset to CLOSED`)
	}

	/**
	 * Get comprehensive circuit breaker status
	 */
	getStatus(): CircuitBreakerStatus {
		return {
			state: this.state,
			failureCount: this.failureCount,
			successCount: this.successCount,
			nextAttemptTime: this.nextAttemptTime || undefined,
			metrics: { ...this.metrics },
		}
	}

	/**
	 * Handle successful operation
	 */
	private onSuccess(): void {
		this.metrics.successfulRequests++
		this.metrics.lastSuccessTime = new Date()

		if (this.state === CircuitBreakerState.HALF_OPEN) {
			this.successCount++
			// Consider the circuit successful after a few successful requests
			if (this.successCount >= 3) {
				this.state = CircuitBreakerState.CLOSED
				this.failureCount = 0
				this.successCount = 0
				this.nextAttemptTime = null
				this.logger.info(`Circuit breaker ${this.name} reset to CLOSED after successful requests`)
			}
		} else if (this.state === CircuitBreakerState.CLOSED) {
			// Reset failure count on success in closed state
			this.failureCount = 0
		}
	}

	/**
	 * Handle failed operation
	 */
	private onFailure(error: Error): void {
		this.metrics.failedRequests++
		this.metrics.lastFailureTime = new Date()

		this.failureCount++
		this.successCount = 0

		this.logger.warn(
			`Circuit breaker ${this.name} failure ${this.failureCount}/${this.config.failureThreshold}`,
			{ error: { message: error.message, stack: error.stack } }
		)

		if (this.state === CircuitBreakerState.HALF_OPEN) {
			// Any failure in half-open state opens the circuit
			this.openCircuit()
		} else if (
			this.state === CircuitBreakerState.CLOSED &&
			this.failureCount >= this.config.failureThreshold
		) {
			// Too many failures in closed state opens the circuit
			this.openCircuit()
		}
	}

	/**
	 * Open the circuit breaker
	 */
	private openCircuit(): void {
		this.state = CircuitBreakerState.OPEN
		this.metrics.circuitBreakerOpens++

		// Calculate next attempt time with exponential backoff and jitter
		const backoffMs = this.calculateBackoff()
		this.nextAttemptTime = new Date(Date.now() + backoffMs)

		this.logger.error(
			`Circuit breaker ${this.name} OPENED. Next attempt at ${this.nextAttemptTime.toISOString()}`
		)
	}

	/**
	 * Check if we should attempt to reset from open state
	 */
	private shouldAttemptReset(): boolean {
		return this.nextAttemptTime !== null && Date.now() >= this.nextAttemptTime.getTime()
	}

	/**
	 * Calculate backoff time with exponential backoff and jitter
	 */
	private calculateBackoff(): number {
		// Base timeout from config
		let backoff = this.config.resetTimeoutMs

		// Exponential backoff based on number of opens
		const exponentialFactor = Math.min(Math.pow(2, this.metrics.circuitBreakerOpens), 16)
		backoff = backoff * exponentialFactor

		// Add jitter (±25% random variation)
		const jitter = 0.25
		const jitterAmount = backoff * jitter * (Math.random() * 2 - 1)
		backoff = backoff + jitterAmount

		// Cap maximum backoff at 5 minutes
		return Math.min(backoff, 5 * 60 * 1000)
	}
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
	private static instance: CircuitBreakerRegistry
	private circuitBreakers = new Map<string, CircuitBreaker>()
	private readonly logger: StructuredLogger

	private constructor(loggerConfig: LoggingConfig) {
		this.logger = new StructuredLogger({
			...loggerConfig,
			service: '@repo/audit-db - CircuitBreakerRegistry',
		})
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(loggerConfig: LoggingConfig): CircuitBreakerRegistry {
		if (!CircuitBreakerRegistry.instance) {
			CircuitBreakerRegistry.instance = new CircuitBreakerRegistry(loggerConfig)
		}
		return CircuitBreakerRegistry.instance
	}

	/**
	 * Get or create circuit breaker
	 */
	getCircuitBreaker(
		name: string,
		config: CircuitBreakerConfig,
		loggerConfig: LoggingConfig
	): CircuitBreaker {
		if (!this.circuitBreakers.has(name)) {
			const circuitBreaker = new CircuitBreaker(name, config, loggerConfig)
			this.circuitBreakers.set(name, circuitBreaker)
			this.logger.info(`Created circuit breaker: ${name}`)
		}
		return this.circuitBreakers.get(name)!
	}

	/**
	 * Get all circuit breaker statuses
	 */
	getAllStatuses(): Record<string, CircuitBreakerStatus> {
		const statuses: Record<string, CircuitBreakerStatus> = {}
		for (const [name, breaker] of this.circuitBreakers) {
			statuses[name] = breaker.getStatus()
		}
		return statuses
	}

	/**
	 * Reset all circuit breakers
	 */
	resetAll(): void {
		for (const [name, breaker] of this.circuitBreakers) {
			breaker.reset()
			this.logger.info(`Reset circuit breaker: ${name}`)
		}
	}

	/**
	 * Remove circuit breaker from registry
	 */
	remove(name: string): boolean {
		return this.circuitBreakers.delete(name)
	}
}

/**
 * Custom error for circuit breaker open state
 */
export class CircuitBreakerOpenError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'CircuitBreakerOpenError'
	}
}

/**
 * Utility function to create circuit breaker with default configurations
 */
export function createCircuitBreaker(
	name: string,
	config?: Partial<CircuitBreakerConfig>,
	loggerConfig?: LoggingConfig
): CircuitBreaker {
	const defaultConfig: CircuitBreakerConfig = {
		failureThreshold: 5,
		timeoutMs: 30000,
		resetTimeoutMs: 60000,
	}

	const defaultLoggerConfig: LoggingConfig = {
		service: `@repo/audit-db - CircuitBreaker[${name}]`,
		environment: 'development',
		console: {
			name: 'console',
			enabled: true,
			format: 'pretty',
			colorize: true,
			level: 'info',
		},
		level: 'info',
		version: '0-1.0',
		shutdownTimeoutMs: 0,
		enableCorrelationIds: false,
		enableRequestTracking: false,
		enableDebugMode: false,
		prettyPrint: false,
	}

	const finalConfig = { ...defaultConfig, ...config }
	const finalLoggerConfig = { ...defaultLoggerConfig, ...loggerConfig }
	const registry = CircuitBreakerRegistry.getInstance(finalLoggerConfig)
	return registry.getCircuitBreaker(name, finalConfig, finalLoggerConfig)
}

/**
 * Pre-configured circuit breakers for common database operations
 */
export const DatabaseCircuitBreakers = {
	/**
	 * Circuit breaker for master database operations
	 */
	master: createCircuitBreaker('master-database', {
		failureThreshold: 5,
		timeoutMs: 30000,
		resetTimeoutMs: 30000,
	}),

	/**
	 * Circuit breaker for read replica operations
	 */
	replica: createCircuitBreaker('read-replica', {
		failureThreshold: 3,
		timeoutMs: 15000,
		resetTimeoutMs: 15000,
	}),

	/**
	 * Circuit breaker for Redis cache operations
	 */
	cache: createCircuitBreaker('redis-cache', {
		failureThreshold: 10,
		timeoutMs: 5000,
		resetTimeoutMs: 5000,
	}),

	/**
	 * Circuit breaker for partition operations
	 */
	partition: createCircuitBreaker('partition-operations', {
		failureThreshold: 2,
		timeoutMs: 60000,
		resetTimeoutMs: 60000,
	}),
}
