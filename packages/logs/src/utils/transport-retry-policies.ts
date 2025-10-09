/**
 * Transport-specific retry policies and error handling
 * Addresses requirements 9.1, 9.2: Error-specific retry policies for different transport types
 */
import { ErrorCategory } from '../types/error.js'

import type { RetryConfig } from '../types/batch.js'
import type { CategorizedError } from '../types/error.js'

export interface TransportRetryPolicy {
	transportName: string
	retryConfig: RetryConfig
	isRetryable: (error: CategorizedError) => boolean
	shouldCircuitBreak: (error: CategorizedError) => boolean
	getBackoffMultiplier: (error: CategorizedError) => number
}

export class TransportRetryPolicyManager {
	private policies = new Map<string, TransportRetryPolicy>()

	constructor() {
		// Register default policies for each transport type
		this.registerDefaultPolicies()
	}

	/**
	 * Register a retry policy for a transport
	 */
	registerPolicy(policy: TransportRetryPolicy): void {
		this.policies.set(policy.transportName, policy)
	}

	/**
	 * Get retry policy for a transport
	 */
	getPolicy(transportName: string): TransportRetryPolicy | undefined {
		return this.policies.get(transportName) || this.policies.get('default')
	}

	/**
	 * Check if an error is retryable for a specific transport
	 */
	isRetryable(transportName: string, error: CategorizedError): boolean {
		const policy = this.getPolicy(transportName)
		return policy ? policy.isRetryable(error) : false
	}

	/**
	 * Check if an error should trigger circuit breaker for a transport
	 */
	shouldCircuitBreak(transportName: string, error: CategorizedError): boolean {
		const policy = this.getPolicy(transportName)
		return policy ? policy.shouldCircuitBreak(error) : false
	}

	/**
	 * Get backoff multiplier for a transport and error
	 */
	getBackoffMultiplier(transportName: string, error: CategorizedError): number {
		const policy = this.getPolicy(transportName)
		return policy ? policy.getBackoffMultiplier(error) : 1
	}

	/**
	 * Register default retry policies for all transport types
	 */
	private registerDefaultPolicies(): void {
		// Console transport policy
		this.registerPolicy({
			transportName: 'console',
			retryConfig: {
				maxAttempts: 2, // Console failures are usually immediate
				initialDelayMs: 100,
				maxDelayMs: 1000,
				multiplier: 1.5,
				jitterMs: 50,
			},
			isRetryable: (error) => {
				// Console errors are rarely retryable except for resource issues
				return error.category === ErrorCategory.RESOURCE
			},
			shouldCircuitBreak: () => false, // Console doesn't need circuit breaking
			getBackoffMultiplier: () => 1,
		})

		// File transport policy
		this.registerPolicy({
			transportName: 'file',
			retryConfig: {
				maxAttempts: 5,
				initialDelayMs: 500,
				maxDelayMs: 10000,
				multiplier: 2,
				jitterMs: 200,
			},
			isRetryable: (error) => {
				// File operations can retry on resource and network (for remote filesystems) errors
				return (
					error.category === ErrorCategory.RESOURCE ||
					error.category === ErrorCategory.NETWORK ||
					error.category === ErrorCategory.TIMEOUT
				)
			},
			shouldCircuitBreak: (error) => {
				// Circuit break on persistent configuration or validation errors
				return (
					error.category === ErrorCategory.CONFIGURATION ||
					error.category === ErrorCategory.VALIDATION
				)
			},
			getBackoffMultiplier: (error) => {
				// Longer backoff for resource errors (disk full, etc.)
				return error.category === ErrorCategory.RESOURCE ? 2 : 1
			},
		})

		// OTLP transport policy
		this.registerPolicy({
			transportName: 'otlp',
			retryConfig: {
				maxAttempts: 5,
				initialDelayMs: 1000,
				maxDelayMs: 30000,
				multiplier: 2,
				jitterMs: 500,
			},
			isRetryable: (error) => {
				// OTLP can retry network, timeout, and rate limit errors
				return (
					error.category === ErrorCategory.NETWORK ||
					error.category === ErrorCategory.TIMEOUT ||
					error.category === ErrorCategory.RATE_LIMIT ||
					error.category === ErrorCategory.TRANSPORT
				)
			},
			shouldCircuitBreak: (error) => {
				// Circuit break on authentication or configuration errors
				return (
					error.category === ErrorCategory.AUTHENTICATION ||
					error.category === ErrorCategory.CONFIGURATION ||
					error.category === ErrorCategory.VALIDATION
				)
			},
			getBackoffMultiplier: (error) => {
				// Aggressive backoff for rate limiting
				if (error.category === ErrorCategory.RATE_LIMIT) return 3
				// Moderate backoff for network issues
				if (error.category === ErrorCategory.NETWORK) return 2
				return 1
			},
		})

		// Redis transport policy
		this.registerPolicy({
			transportName: 'redis',
			retryConfig: {
				maxAttempts: 7, // Redis can handle more retries due to clustering
				initialDelayMs: 500,
				maxDelayMs: 15000,
				multiplier: 1.8,
				jitterMs: 300,
			},
			isRetryable: (error) => {
				// Redis can retry most errors except validation and serialization
				return (
					error.category !== ErrorCategory.VALIDATION &&
					error.category !== ErrorCategory.SERIALIZATION &&
					error.category !== ErrorCategory.CONFIGURATION
				)
			},
			shouldCircuitBreak: (error) => {
				// Circuit break on authentication or persistent configuration errors
				return (
					error.category === ErrorCategory.AUTHENTICATION ||
					(error.category === ErrorCategory.CONFIGURATION && error.severity === 'critical')
				)
			},
			getBackoffMultiplier: (error) => {
				// Redis cluster failover can take time
				if (error.category === ErrorCategory.NETWORK) return 2.5
				if (error.category === ErrorCategory.TIMEOUT) return 2
				return 1
			},
		})

		// Default policy for unknown transports
		this.registerPolicy({
			transportName: 'default',
			retryConfig: {
				maxAttempts: 3,
				initialDelayMs: 1000,
				maxDelayMs: 10000,
				multiplier: 2,
				jitterMs: 200,
			},
			isRetryable: (error) => {
				// Conservative retry policy for unknown transports
				return error.category === ErrorCategory.NETWORK || error.category === ErrorCategory.TIMEOUT
			},
			shouldCircuitBreak: (error) => {
				// Circuit break on critical errors
				return error.severity === 'critical'
			},
			getBackoffMultiplier: () => 1,
		})
	}
}

/**
 * Error rate limiter to prevent error spam
 */
export class TransportErrorRateLimiter {
	private errorCounts = new Map<string, { count: number; windowStart: number }>()
	private readonly windowMs = 60 * 1000 // 1 minute window

	constructor(private maxErrorsPerMinute: number = 100) {}

	/**
	 * Check if error should be processed or rate limited
	 */
	shouldProcessError(transportName: string, error: CategorizedError): boolean {
		const key = `${transportName}_${error.category}`
		const now = Date.now()

		const errorCount = this.errorCounts.get(key)
		if (!errorCount || now - errorCount.windowStart > this.windowMs) {
			// New window or first error
			this.errorCounts.set(key, { count: 1, windowStart: now })
			return true
		}

		errorCount.count++

		// Allow critical errors through regardless of rate limit
		if (error.severity === 'critical') {
			return true
		}

		return errorCount.count <= this.maxErrorsPerMinute
	}

	/**
	 * Get current error rate for a transport and category
	 */
	getErrorRate(transportName: string, category: ErrorCategory): number {
		const key = `${transportName}_${category}`
		const errorCount = this.errorCounts.get(key)

		if (!errorCount) {
			return 0
		}

		const now = Date.now()
		if (now - errorCount.windowStart > this.windowMs) {
			return 0
		}

		return errorCount.count
	}

	/**
	 * Reset error counts for a transport
	 */
	resetErrorCounts(transportName: string): void {
		const keysToDelete = Array.from(this.errorCounts.keys()).filter((key) =>
			key.startsWith(`${transportName}_`)
		)

		for (const key of keysToDelete) {
			this.errorCounts.delete(key)
		}
	}

	/**
	 * Get all current error rates
	 */
	getAllErrorRates(): Map<string, number> {
		const rates = new Map<string, number>()
		const now = Date.now()

		for (const [key, errorCount] of this.errorCounts.entries()) {
			if (now - errorCount.windowStart <= this.windowMs) {
				rates.set(key, errorCount.count)
			}
		}

		return rates
	}
}

/**
 * Global instance of retry policy manager
 */
export const transportRetryPolicyManager = new TransportRetryPolicyManager()
