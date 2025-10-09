/**
 * Enhanced transport wrapper with integrated error handling, health monitoring, and retry logic
 * Addresses requirements 5.4, 9.1, 9.2: Transport reliability and error handling
 */
import { TransportHealthMonitor } from './transport-health-monitor.js'
import {
	TransportErrorRateLimiter,
	TransportRetryPolicyManager,
	transportRetryPolicyManager,
} from './transport-retry-policies.js'

import type { CircuitBreaker, RetryManager } from '../types/batch.js'
import type { CategorizedError, ErrorContext, ErrorHandler } from '../types/error.js'
import type { LogEntry } from '../types/log-entry.js'
import type { LogTransport } from '../types/transport.js'
import type { FallbackConfig, HealthCheckConfig } from './transport-health-monitor.js'

export interface EnhancedTransportConfig {
	enableHealthMonitoring: boolean
	enableRetryPolicies: boolean
	enableErrorRateLimiting: boolean
	enableFallback: boolean
	healthCheckConfig?: Partial<HealthCheckConfig>
	fallbackConfig?: Partial<FallbackConfig>
	maxErrorsPerMinute?: number
}

export interface TransportOperationResult {
	success: boolean
	transportUsed: string
	attempts: number
	duration: number
	error?: Error
	fallbackUsed?: boolean
}

/**
 * Enhanced transport wrapper that adds error handling, health monitoring, and retry logic
 */
export class EnhancedTransportWrapper implements LogTransport {
	public readonly name: string
	private healthMonitor?: TransportHealthMonitor
	private retryPolicyManager: TransportRetryPolicyManager
	private errorRateLimiter?: TransportErrorRateLimiter
	private isShuttingDown = false

	constructor(
		private baseTransport: LogTransport,
		private config: EnhancedTransportConfig,
		private errorHandler: ErrorHandler,
		private retryManager?: RetryManager,
		private circuitBreaker?: CircuitBreaker
	) {
		this.name = `enhanced_${baseTransport.name}`
		this.retryPolicyManager = transportRetryPolicyManager

		this.initializeComponents()
	}

	/**
	 * Send log entries with enhanced error handling and retry logic
	 */
	async send(entries: LogEntry[]): Promise<void> {
		if (this.isShuttingDown) {
			throw new Error('Transport is shutting down')
		}

		const startTime = Date.now()
		let attempts = 0
		let lastError: Error | undefined

		try {
			// Check circuit breaker if available
			if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
				throw new Error(`Circuit breaker is open for transport ${this.baseTransport.name}`)
			}

			// Use health monitor with fallback if available
			if (this.healthMonitor && this.config.enableFallback) {
				const result = await this.healthMonitor.sendWithFailover(this.baseTransport.name, entries)
				if (!result.success && result.error) {
					throw result.error
				}
				return
			}

			// Direct send with retry logic
			const policy = this.retryPolicyManager.getPolicy(this.baseTransport.name)
			const maxAttempts = policy?.retryConfig.maxAttempts || 3

			while (attempts < maxAttempts) {
				attempts++

				try {
					await this.baseTransport.send(entries)

					// Record success
					if (this.healthMonitor) {
						this.healthMonitor.recordSuccess(this.baseTransport.name, Date.now() - startTime)
					}
					if (this.circuitBreaker) {
						this.circuitBreaker.onSuccess()
					}

					return
				} catch (error) {
					lastError = error as Error
					const categorizedError = this.categorizeAndHandleError(lastError, attempts)

					// Check if error should be rate limited
					if (
						this.errorRateLimiter &&
						!this.errorRateLimiter.shouldProcessError(this.baseTransport.name, categorizedError)
					) {
						// Skip retry for rate-limited errors (except critical ones)
						if (categorizedError.severity !== 'critical') {
							break
						}
					}

					// Check if error is retryable
					if (!this.retryPolicyManager.isRetryable(this.baseTransport.name, categorizedError)) {
						break
					}

					// Check if we should circuit break
					if (
						this.retryPolicyManager.shouldCircuitBreak(this.baseTransport.name, categorizedError)
					) {
						if (this.circuitBreaker) {
							this.circuitBreaker.onFailure()
						}
						break
					}

					// If this is not the last attempt, wait before retrying
					if (attempts < maxAttempts) {
						const delay = this.calculateRetryDelay(categorizedError, attempts)
						await this.sleep(delay)
					}
				}
			}

			// All retries failed
			if (lastError) {
				// Record failure
				if (this.healthMonitor) {
					this.healthMonitor.recordFailure(this.baseTransport.name, lastError)
				}
				if (this.circuitBreaker) {
					this.circuitBreaker.onFailure()
				}

				throw lastError
			}
		} catch (error) {
			// Final error handling
			const finalError = error as Error
			this.categorizeAndHandleError(finalError, attempts)
			throw finalError
		}
	}

	/**
	 * Flush the underlying transport
	 */
	async flush(): Promise<void> {
		try {
			await this.baseTransport.flush()
		} catch (error) {
			const categorizedError = this.categorizeAndHandleError(error as Error, 1)
			if (categorizedError.severity === 'critical') {
				throw error
			}
			// Non-critical flush errors are logged but don't fail the operation
		}
	}

	/**
	 * Close the transport and cleanup resources
	 */
	async close(): Promise<void> {
		this.isShuttingDown = true

		try {
			// Stop health monitoring
			if (this.healthMonitor) {
				this.healthMonitor.stopMonitoring()
			}

			// Close underlying transport
			await this.baseTransport.close()
		} catch (error) {
			// Log close errors but don't throw
			this.categorizeAndHandleError(error as Error, 1)
		}
	}

	/**
	 * Check if the transport is healthy
	 */
	isHealthy(): boolean {
		if (this.isShuttingDown) {
			return false
		}

		// Check circuit breaker if available
		if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
			return false
		}

		// Check health monitor if available
		if (this.healthMonitor) {
			const status = this.healthMonitor.getTransportHealth(this.baseTransport.name)
			return status?.isHealthy ?? false
		}

		// Fall back to base transport health check
		return this.baseTransport.isHealthy()
	}

	/**
	 * Get detailed health status
	 */
	getDetailedHealthStatus(): any {
		const baseHealth = {
			name: this.name,
			baseTransport: this.baseTransport.name,
			isHealthy: this.isHealthy(),
			isShuttingDown: this.isShuttingDown,
		}

		if (this.healthMonitor) {
			const status = this.healthMonitor.getTransportHealth(this.baseTransport.name)
			return {
				...baseHealth,
				healthMonitor: status,
			}
		}

		return baseHealth
	}

	/**
	 * Get error rates for this transport
	 */
	getErrorRates(): Map<string, number> {
		if (this.errorRateLimiter) {
			return this.errorRateLimiter.getAllErrorRates()
		}
		return new Map()
	}

	/**
	 * Initialize components based on configuration
	 */
	private initializeComponents(): void {
		// Initialize health monitor
		if (this.config.enableHealthMonitoring) {
			const healthConfig = {
				checkIntervalMs: 30000,
				failureThreshold: 3,
				recoveryThreshold: 1,
				timeoutMs: 10000,
				enableAutoRecovery: true,
				...this.config.healthCheckConfig,
			}

			const fallbackConfig = {
				enableFallback: this.config.enableFallback,
				fallbackChain: ['console'],
				maxFallbackDepth: 1,
				...this.config.fallbackConfig,
			}

			this.healthMonitor = new TransportHealthMonitor(
				healthConfig,
				fallbackConfig,
				this.errorHandler
			)

			this.healthMonitor.registerTransport(this.baseTransport)
			this.healthMonitor.startMonitoring()
		}

		// Initialize error rate limiter
		if (this.config.enableErrorRateLimiting) {
			this.errorRateLimiter = new TransportErrorRateLimiter(this.config.maxErrorsPerMinute || 100)
		}
	}

	/**
	 * Categorize and handle an error
	 */
	private categorizeAndHandleError(error: Error, attempts: number): CategorizedError {
		const context: ErrorContext = {
			operation: 'transport_send',
			transportName: this.baseTransport.name,
			metadata: {
				attempts,
				enhancedWrapper: true,
			},
			stackTrace: error.stack,
		}

		const categorizedError = this.errorHandler.categorizeError(error, context)

		// Handle the error asynchronously (don't block the main operation)
		this.errorHandler.handleError(categorizedError).catch((handlerError) => {
			console.error('Error handler failed:', handlerError)
		})

		return categorizedError
	}

	/**
	 * Calculate retry delay based on error type and attempt number
	 */
	private calculateRetryDelay(error: CategorizedError, attempt: number): number {
		const policy = this.retryPolicyManager.getPolicy(this.baseTransport.name)
		if (!policy) {
			return 1000 * attempt // Simple linear backoff
		}

		const baseDelay =
			policy.retryConfig.initialDelayMs * Math.pow(policy.retryConfig.multiplier, attempt - 1)
		const multiplier = this.retryPolicyManager.getBackoffMultiplier(this.baseTransport.name, error)
		const jitter = Math.random() * (policy.retryConfig.jitterMs || 0)

		return Math.min(baseDelay * multiplier + jitter, policy.retryConfig.maxDelayMs)
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
}

/**
 * Factory function to create enhanced transport wrappers
 */
export function createEnhancedTransport(
	baseTransport: LogTransport,
	config: Partial<EnhancedTransportConfig>,
	errorHandler: ErrorHandler,
	retryManager?: RetryManager,
	circuitBreaker?: CircuitBreaker
): EnhancedTransportWrapper {
	const fullConfig: EnhancedTransportConfig = {
		enableHealthMonitoring: true,
		enableRetryPolicies: true,
		enableErrorRateLimiting: true,
		enableFallback: true,
		maxErrorsPerMinute: 100,
		...config,
	}

	return new EnhancedTransportWrapper(
		baseTransport,
		fullConfig,
		errorHandler,
		retryManager,
		circuitBreaker
	)
}
