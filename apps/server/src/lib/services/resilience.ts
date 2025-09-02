/**
 * @fileoverview Resilience Service
 *
 * Manages circuit breakers, retry handlers, and service degradation
 * for external service calls and critical operations.
 *
 * Requirements: 1.5, 2.3, 3.5, 6.3
 */

import {
	CircuitBreaker,
	DEFAULT_CIRCUIT_BREAKER_CONFIG,
	DEFAULT_RETRY_CONFIG,
	RetryHandler,
	ServiceDegradationHandler,
	withTimeout,
} from '../errors/resilience'

import type {
	CircuitBreakerConfig,
	ErrorContext,
	RetryConfig,
	ServiceHealth,
} from '../errors/resilience'
import type { StructuredLogger } from './logging'

/**
 * Service configuration for resilience patterns
 */
export interface ServiceResilienceConfig {
	circuitBreaker?: Partial<CircuitBreakerConfig> | false
	retry?: Partial<RetryConfig> | false
	timeout?: number
	enableFallback?: boolean
}

/**
 * Resilience service for managing circuit breakers and retry logic
 */
export class ResilienceService {
	private readonly circuitBreakers = new Map<string, CircuitBreaker>()
	private readonly retryHandlers = new Map<string, RetryHandler>()
	private readonly degradationHandler: ServiceDegradationHandler
	private readonly serviceConfigs = new Map<string, ServiceResilienceConfig>()

	constructor(private readonly logger: StructuredLogger) {
		this.degradationHandler = new ServiceDegradationHandler(logger)
	}

	/**
	 * Register a service with resilience configuration
	 */
	registerService(serviceName: string, config: ServiceResilienceConfig = {}): void {
		this.serviceConfigs.set(serviceName, config)

		// Create circuit breaker if configured
		if (config.circuitBreaker !== false) {
			const cbConfig: CircuitBreakerConfig = {
				...DEFAULT_CIRCUIT_BREAKER_CONFIG,
				...config.circuitBreaker,
				name: serviceName,
			}
			this.circuitBreakers.set(serviceName, new CircuitBreaker(cbConfig, this.logger))
		}

		// Create retry handler if configured
		if (config.retry !== false) {
			const retryConfig: RetryConfig = {
				...DEFAULT_RETRY_CONFIG,
				...config.retry,
			}
			this.retryHandlers.set(serviceName, new RetryHandler(retryConfig, this.logger))
		}

		this.logger.info('Service registered with resilience patterns', {
			service: serviceName,
			hasCircuitBreaker: !!config.circuitBreaker,
			hasRetry: !!config.retry,
			timeout: config.timeout,
			enableFallback: config.enableFallback,
		})
	}

	/**
	 * Register a fallback handler for a service
	 */
	registerFallback(serviceName: string, fallbackHandler: () => any): void {
		this.degradationHandler.registerFallback(serviceName, fallbackHandler)
		this.logger.info('Fallback handler registered', { service: serviceName })
	}

	/**
	 * Execute operation with full resilience protection
	 */
	async executeWithResilience<T>(
		serviceName: string,
		operation: () => Promise<T>,
		context?: ErrorContext
	): Promise<T> {
		const config = this.serviceConfigs.get(serviceName)
		if (!config) {
			throw new Error(`Service ${serviceName} not registered`)
		}

		const circuitBreaker = this.circuitBreakers.get(serviceName)
		const retryHandler = this.retryHandlers.get(serviceName)

		// Wrap operation with timeout if configured
		let wrappedOperation = operation
		if (config.timeout) {
			wrappedOperation = () =>
				withTimeout(
					operation,
					config.timeout!,
					`${serviceName} operation timed out after ${config.timeout}ms`
				)
		}

		// Wrap with circuit breaker if available
		if (circuitBreaker) {
			const cbOperation = wrappedOperation
			wrappedOperation = () => circuitBreaker.execute(cbOperation)
		}

		// Wrap with retry logic if available
		if (retryHandler) {
			const retryOperation = wrappedOperation
			wrappedOperation = () => retryHandler.execute(retryOperation, context)
		}

		// Execute with graceful degradation
		if (config.enableFallback) {
			return this.degradationHandler.executeWithDegradation(serviceName, wrappedOperation, context)
		}

		return wrappedOperation()
	}

	/**
	 * Execute database operation with resilience
	 */
	async executeDatabaseOperation<T>(
		operation: () => Promise<T>,
		context?: ErrorContext
	): Promise<T> {
		return this.executeWithResilience('database', operation, context)
	}

	/**
	 * Execute Redis operation with resilience
	 */
	async executeRedisOperation<T>(operation: () => Promise<T>, context?: ErrorContext): Promise<T> {
		return this.executeWithResilience('redis', operation, context)
	}

	/**
	 * Execute external API call with resilience
	 */
	async executeExternalAPICall<T>(
		serviceName: string,
		operation: () => Promise<T>,
		context?: ErrorContext
	): Promise<T> {
		return this.executeWithResilience(`external_${serviceName}`, operation, context)
	}

	/**
	 * Get health status for all services
	 */
	getAllServiceHealth(): ServiceHealth[] {
		const healthStatuses: ServiceHealth[] = []

		// Get circuit breaker health
		for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
			healthStatuses.push(circuitBreaker.getStatus())
		}

		// Get degradation handler health
		healthStatuses.push(...this.degradationHandler.getAllServiceHealth())

		return healthStatuses
	}

	/**
	 * Get health status for specific service
	 */
	getServiceHealth(serviceName: string): ServiceHealth | undefined {
		const circuitBreaker = this.circuitBreakers.get(serviceName)
		if (circuitBreaker) {
			return circuitBreaker.getStatus()
		}

		return this.degradationHandler.getServiceHealth(serviceName)
	}

	/**
	 * Get metrics for all circuit breakers
	 */
	getCircuitBreakerMetrics(): Record<string, any> {
		const metrics: Record<string, any> = {}

		for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
			metrics[serviceName] = circuitBreaker.getMetrics()
		}

		return metrics
	}

	/**
	 * Reset circuit breaker for a service
	 */
	resetCircuitBreaker(serviceName: string): boolean {
		const circuitBreaker = this.circuitBreakers.get(serviceName)
		if (circuitBreaker) {
			circuitBreaker.reset()
			this.logger.info('Circuit breaker reset', { service: serviceName })
			return true
		}
		return false
	}

	/**
	 * Reset all circuit breakers
	 */
	resetAllCircuitBreakers(): void {
		for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
			circuitBreaker.reset()
		}
		this.logger.info('All circuit breakers reset')
	}

	/**
	 * Update service health status
	 */
	updateServiceHealth(health: ServiceHealth): void {
		this.degradationHandler.updateServiceHealth(health)
	}

	/**
	 * Initialize default services with resilience patterns
	 */
	initializeDefaultServices(): void {
		// Database service
		this.registerService('database', {
			circuitBreaker: {
				failureThreshold: 5,
				recoveryTimeout: 30000, // 30 seconds
				halfOpenMaxCalls: 2,
			},
			retry: {
				maxRetries: 2,
				baseDelay: 1000,
				maxDelay: 5000,
				retryableErrors: ['connection', 'timeout', 'ECONNRESET'],
			},
			timeout: 10000, // 10 seconds
			enableFallback: false, // Database operations shouldn't have fallbacks
		})

		// Redis service
		this.registerService('redis', {
			circuitBreaker: {
				failureThreshold: 3,
				recoveryTimeout: 15000, // 15 seconds
				halfOpenMaxCalls: 2,
			},
			retry: {
				maxRetries: 3,
				baseDelay: 500,
				maxDelay: 2000,
				retryableErrors: ['connection', 'timeout', 'ECONNRESET'],
			},
			timeout: 5000, // 5 seconds
			enableFallback: true, // Redis can have fallbacks (e.g., skip caching)
		})

		// External API services
		this.registerService('external_smtp', {
			circuitBreaker: {
				failureThreshold: 3,
				recoveryTimeout: 60000, // 1 minute
				halfOpenMaxCalls: 1,
			},
			retry: {
				maxRetries: 3,
				baseDelay: 2000,
				maxDelay: 10000,
				retryableErrors: ['timeout', 'network', '5'],
			},
			timeout: 30000, // 30 seconds
			enableFallback: true,
		})

		this.registerService('external_webhook', {
			circuitBreaker: {
				failureThreshold: 5,
				recoveryTimeout: 30000, // 30 seconds
				halfOpenMaxCalls: 2,
			},
			retry: {
				maxRetries: 3,
				baseDelay: 1000,
				maxDelay: 8000,
				retryableErrors: ['timeout', 'network', '5'],
			},
			timeout: 15000, // 15 seconds
			enableFallback: true,
		})

		// Register fallback handlers
		this.registerFallback('redis', () => {
			this.logger.warn('Using Redis fallback - operations will proceed without caching')
			return null // Skip caching operations
		})

		this.registerFallback('external_smtp', () => {
			this.logger.warn('SMTP service unavailable - email will be queued for later delivery')
			return { queued: true, message: 'Email queued for later delivery' }
		})

		this.registerFallback('external_webhook', () => {
			this.logger.warn('Webhook service unavailable - webhook will be queued for later delivery')
			return { queued: true, message: 'Webhook queued for later delivery' }
		})

		this.logger.info('Default resilience services initialized')
	}
}

/**
 * Create resilience service with default configuration
 */
export function createResilienceService(logger: StructuredLogger): ResilienceService {
	const service = new ResilienceService(logger)
	service.initializeDefaultServices()
	return service
}
