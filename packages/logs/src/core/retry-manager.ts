import type { CircuitBreaker, RetryConfig, RetryManager } from '../types/batch.js'

/**
 * RetryManager implementation with exponential backoff and jitter
 * Addresses requirements 2.4, 9.1, 9.4
 */
export class DefaultRetryManager implements RetryManager {
	constructor(private readonly circuitBreaker?: CircuitBreaker) {}

	/**
	 * Execute an operation with retry logic and exponential backoff
	 */
	async executeWithRetry<T>(operation: () => Promise<T>, config: RetryConfig): Promise<T> {
		let lastError: Error | undefined
		let attempt = 0

		while (attempt <= config.maxAttempts) {
			// Check circuit breaker before attempting operation
			if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
				throw new Error('Circuit breaker is open, operation not allowed')
			}

			try {
				const result = await operation()

				// Notify circuit breaker of success
				if (this.circuitBreaker) {
					this.circuitBreaker.onSuccess()
				}

				return result
			} catch (error) {
				lastError = error as Error
				attempt++

				// Notify circuit breaker of failure
				if (this.circuitBreaker) {
					this.circuitBreaker.onFailure()
				}

				// If this was the last attempt, don't wait
				if (attempt > config.maxAttempts) {
					break
				}

				// Check if error is retryable
				if (!this.isRetryableError(error)) {
					throw new Error(`Non-retryable error after ${attempt} attempts: ${lastError.message}`, {
						cause: lastError,
					})
				}

				// Calculate delay with exponential backoff and jitter
				const delay = this.calculateBackoffDelay(attempt - 1, config)
				await this.sleep(delay)
			}
		}

		// All retries exhausted - lastError should be defined here
		if (!lastError) {
			throw new Error(`Operation failed after ${config.maxAttempts + 1} attempts: Unknown error`)
		}

		throw new Error(
			`Operation failed after ${config.maxAttempts + 1} attempts: ${lastError.message}`,
			{ cause: lastError }
		)
	}

	/**
	 * Calculate exponential backoff delay with jitter
	 */
	private calculateBackoffDelay(attempt: number, config: RetryConfig): number {
		// Calculate base delay with exponential backoff
		const baseDelay = Math.min(
			config.initialDelayMs * Math.pow(config.multiplier, attempt),
			config.maxDelayMs
		)

		// Add jitter to prevent thundering herd (±25% of base delay)
		const jitterRange = baseDelay * 0.25
		const jitter = (Math.random() - 0.5) * 2 * jitterRange

		// Ensure the final delay doesn't exceed maxDelayMs
		return Math.max(0, Math.min(Math.floor(baseDelay + jitter), config.maxDelayMs))
	}

	/**
	 * Determine if an error is retryable
	 */
	private isRetryableError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			// For non-Error objects, default to retryable to be safe
			return true
		}

		const message = error.message.toLowerCase()
		const name = error.name.toLowerCase()

		// Network-related errors that are typically retryable
		const retryablePatterns = [
			// Network connectivity issues
			'network',
			'timeout',
			'connection',
			'socket',
			'econnreset',
			'econnrefused',
			'enotfound',
			'etimedout',

			// HTTP status codes that are retryable (5xx server errors)
			'500',
			'502',
			'503',
			'504',
			'507',
			'508',
			'510',
			'511',

			// Rate limiting (429 Too Many Requests)
			'429',
			'rate limit',
			'too many requests',

			// Temporary service unavailability
			'service unavailable',
			'temporarily unavailable',
			'server overloaded',

			// DNS resolution issues
			'dns',
			'resolution failed',
		]

		// Non-retryable error patterns (client errors, authentication, etc.)
		const nonRetryablePatterns = [
			'400', // Bad Request
			'401', // Unauthorized
			'403', // Forbidden
			'404', // Not Found
			'405', // Method Not Allowed
			'406', // Not Acceptable
			'409', // Conflict
			'410', // Gone
			'422', // Unprocessable Entity
			'unauthorized',
			'forbidden',
			'not found',
			'bad request',
			'invalid',
			'malformed',
		]

		// Check for non-retryable patterns first
		for (const pattern of nonRetryablePatterns) {
			if (message.includes(pattern) || name.includes(pattern)) {
				return false
			}
		}

		// Check for retryable patterns
		for (const pattern of retryablePatterns) {
			if (message.includes(pattern) || name.includes(pattern)) {
				return true
			}
		}

		// Special handling for specific error types
		if (error.name === 'AbortError' || error.name === 'TimeoutError') {
			return true
		}

		// Check for HTTP status codes in error properties
		if ('status' in error || 'statusCode' in error) {
			const status = (error as any).status || (error as any).statusCode
			if (typeof status === 'number') {
				// Retry on 5xx server errors and 429 rate limiting
				return status >= 500 || status === 429
			}
		}

		// Default to not retryable for unknown errors to avoid infinite loops
		return false
	}

	/**
	 * Sleep for the specified number of milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Create a retry configuration with sensible defaults
	 */
	static createConfig(overrides: Partial<RetryConfig> = {}): RetryConfig {
		return {
			maxAttempts: 3,
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			multiplier: 2,
			...overrides,
		}
	}

	/**
	 * Create a retry manager with circuit breaker integration
	 */
	static withCircuitBreaker(circuitBreaker: CircuitBreaker): DefaultRetryManager {
		return new DefaultRetryManager(circuitBreaker)
	}
}
