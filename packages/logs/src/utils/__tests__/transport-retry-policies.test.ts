/**
 * Unit tests for TransportRetryPolicyManager and TransportErrorRateLimiter
 * Addresses requirement 10.1, 10.3: Test retry policy application and error rate limiting
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorCategory, ErrorSeverity, RecoveryStrategy } from '../../types/error.js'
import {
	TransportErrorRateLimiter,
	TransportRetryPolicyManager,
	transportRetryPolicyManager,
} from '../transport-retry-policies.js'

import type { CategorizedError, ErrorContext } from '../../types/error.js'

describe('TransportRetryPolicyManager', () => {
	let policyManager: TransportRetryPolicyManager

	beforeEach(() => {
		policyManager = new TransportRetryPolicyManager()
	})

	describe('default policies', () => {
		it('should have default policies for all transport types', () => {
			expect(policyManager.getPolicy('console')).toBeDefined()
			expect(policyManager.getPolicy('file')).toBeDefined()
			expect(policyManager.getPolicy('otlp')).toBeDefined()
			expect(policyManager.getPolicy('redis')).toBeDefined()
			expect(policyManager.getPolicy('default')).toBeDefined()
		})

		it('should return default policy for unknown transport', () => {
			const policy = policyManager.getPolicy('unknown-transport')
			expect(policy).toBeDefined()
			expect(policy!.transportName).toBe('default')
		})
	})

	describe('console transport policy', () => {
		let consolePolicy: any

		beforeEach(() => {
			consolePolicy = policyManager.getPolicy('console')!
		})

		it('should have correct retry configuration', () => {
			expect(consolePolicy.retryConfig.maxAttempts).toBe(2)
			expect(consolePolicy.retryConfig.initialDelayMs).toBe(100)
			expect(consolePolicy.retryConfig.maxDelayMs).toBe(1000)
		})

		it('should only retry resource errors', () => {
			const resourceError = createCategorizedError(ErrorCategory.RESOURCE)
			const networkError = createCategorizedError(ErrorCategory.NETWORK)
			const configError = createCategorizedError(ErrorCategory.CONFIGURATION)

			expect(consolePolicy.isRetryable(resourceError)).toBe(true)
			expect(consolePolicy.isRetryable(networkError)).toBe(false)
			expect(consolePolicy.isRetryable(configError)).toBe(false)
		})

		it('should not use circuit breaker', () => {
			const error = createCategorizedError(ErrorCategory.NETWORK)
			expect(consolePolicy.shouldCircuitBreak(error)).toBe(false)
		})
	})

	describe('file transport policy', () => {
		let filePolicy: any

		beforeEach(() => {
			filePolicy = policyManager.getPolicy('file')!
		})

		it('should have correct retry configuration', () => {
			expect(filePolicy.retryConfig.maxAttempts).toBe(5)
			expect(filePolicy.retryConfig.initialDelayMs).toBe(500)
			expect(filePolicy.retryConfig.maxDelayMs).toBe(10000)
		})

		it('should retry resource, network, and timeout errors', () => {
			const resourceError = createCategorizedError(ErrorCategory.RESOURCE)
			const networkError = createCategorizedError(ErrorCategory.NETWORK)
			const timeoutError = createCategorizedError(ErrorCategory.TIMEOUT)
			const configError = createCategorizedError(ErrorCategory.CONFIGURATION)

			expect(filePolicy.isRetryable(resourceError)).toBe(true)
			expect(filePolicy.isRetryable(networkError)).toBe(true)
			expect(filePolicy.isRetryable(timeoutError)).toBe(true)
			expect(filePolicy.isRetryable(configError)).toBe(false)
		})

		it('should circuit break on configuration and validation errors', () => {
			const configError = createCategorizedError(ErrorCategory.CONFIGURATION)
			const validationError = createCategorizedError(ErrorCategory.VALIDATION)
			const networkError = createCategorizedError(ErrorCategory.NETWORK)

			expect(filePolicy.shouldCircuitBreak(configError)).toBe(true)
			expect(filePolicy.shouldCircuitBreak(validationError)).toBe(true)
			expect(filePolicy.shouldCircuitBreak(networkError)).toBe(false)
		})

		it('should use higher backoff multiplier for resource errors', () => {
			const resourceError = createCategorizedError(ErrorCategory.RESOURCE)
			const networkError = createCategorizedError(ErrorCategory.NETWORK)

			expect(filePolicy.getBackoffMultiplier(resourceError)).toBe(2)
			expect(filePolicy.getBackoffMultiplier(networkError)).toBe(1)
		})
	})

	describe('OTLP transport policy', () => {
		let otlpPolicy: any

		beforeEach(() => {
			otlpPolicy = policyManager.getPolicy('otlp')!
		})

		it('should have correct retry configuration', () => {
			expect(otlpPolicy.retryConfig.maxAttempts).toBe(5)
			expect(otlpPolicy.retryConfig.initialDelayMs).toBe(1000)
			expect(otlpPolicy.retryConfig.maxDelayMs).toBe(30000)
		})

		it('should retry network, timeout, rate limit, and transport errors', () => {
			const networkError = createCategorizedError(ErrorCategory.NETWORK)
			const timeoutError = createCategorizedError(ErrorCategory.TIMEOUT)
			const rateLimitError = createCategorizedError(ErrorCategory.RATE_LIMIT)
			const transportError = createCategorizedError(ErrorCategory.TRANSPORT)
			const authError = createCategorizedError(ErrorCategory.AUTHENTICATION)

			expect(otlpPolicy.isRetryable(networkError)).toBe(true)
			expect(otlpPolicy.isRetryable(timeoutError)).toBe(true)
			expect(otlpPolicy.isRetryable(rateLimitError)).toBe(true)
			expect(otlpPolicy.isRetryable(transportError)).toBe(true)
			expect(otlpPolicy.isRetryable(authError)).toBe(false)
		})

		it('should circuit break on authentication and configuration errors', () => {
			const authError = createCategorizedError(ErrorCategory.AUTHENTICATION)
			const configError = createCategorizedError(ErrorCategory.CONFIGURATION)
			const validationError = createCategorizedError(ErrorCategory.VALIDATION)
			const networkError = createCategorizedError(ErrorCategory.NETWORK)

			expect(otlpPolicy.shouldCircuitBreak(authError)).toBe(true)
			expect(otlpPolicy.shouldCircuitBreak(configError)).toBe(true)
			expect(otlpPolicy.shouldCircuitBreak(validationError)).toBe(true)
			expect(otlpPolicy.shouldCircuitBreak(networkError)).toBe(false)
		})

		it('should use different backoff multipliers for different error types', () => {
			const rateLimitError = createCategorizedError(ErrorCategory.RATE_LIMIT)
			const networkError = createCategorizedError(ErrorCategory.NETWORK)
			const timeoutError = createCategorizedError(ErrorCategory.TIMEOUT)

			expect(otlpPolicy.getBackoffMultiplier(rateLimitError)).toBe(3)
			expect(otlpPolicy.getBackoffMultiplier(networkError)).toBe(2)
			expect(otlpPolicy.getBackoffMultiplier(timeoutError)).toBe(1)
		})
	})

	describe('Redis transport policy', () => {
		let redisPolicy: any

		beforeEach(() => {
			redisPolicy = policyManager.getPolicy('redis')!
		})

		it('should have correct retry configuration', () => {
			expect(redisPolicy.retryConfig.maxAttempts).toBe(7)
			expect(redisPolicy.retryConfig.initialDelayMs).toBe(500)
			expect(redisPolicy.retryConfig.maxDelayMs).toBe(15000)
		})

		it('should retry most errors except validation, serialization, and configuration', () => {
			const networkError = createCategorizedError(ErrorCategory.NETWORK)
			const timeoutError = createCategorizedError(ErrorCategory.TIMEOUT)
			const validationError = createCategorizedError(ErrorCategory.VALIDATION)
			const serializationError = createCategorizedError(ErrorCategory.SERIALIZATION)
			const configError = createCategorizedError(ErrorCategory.CONFIGURATION)

			expect(redisPolicy.isRetryable(networkError)).toBe(true)
			expect(redisPolicy.isRetryable(timeoutError)).toBe(true)
			expect(redisPolicy.isRetryable(validationError)).toBe(false)
			expect(redisPolicy.isRetryable(serializationError)).toBe(false)
			expect(redisPolicy.isRetryable(configError)).toBe(false)
		})

		it('should circuit break on authentication and critical configuration errors', () => {
			const authError = createCategorizedError(ErrorCategory.AUTHENTICATION)
			const criticalConfigError = createCategorizedError(
				ErrorCategory.CONFIGURATION,
				ErrorSeverity.CRITICAL
			)
			const normalConfigError = createCategorizedError(
				ErrorCategory.CONFIGURATION,
				ErrorSeverity.MEDIUM
			)

			expect(redisPolicy.shouldCircuitBreak(authError)).toBe(true)
			expect(redisPolicy.shouldCircuitBreak(criticalConfigError)).toBe(true)
			expect(redisPolicy.shouldCircuitBreak(normalConfigError)).toBe(false)
		})

		it('should use higher backoff multipliers for network and timeout errors', () => {
			const networkError = createCategorizedError(ErrorCategory.NETWORK)
			const timeoutError = createCategorizedError(ErrorCategory.TIMEOUT)
			const resourceError = createCategorizedError(ErrorCategory.RESOURCE)

			expect(redisPolicy.getBackoffMultiplier(networkError)).toBe(2.5)
			expect(redisPolicy.getBackoffMultiplier(timeoutError)).toBe(2)
			expect(redisPolicy.getBackoffMultiplier(resourceError)).toBe(1)
		})
	})

	describe('policy manager methods', () => {
		it('should check if error is retryable for specific transport', () => {
			const networkError = createCategorizedError(ErrorCategory.NETWORK)

			expect(policyManager.isRetryable('otlp', networkError)).toBe(true)
			expect(policyManager.isRetryable('console', networkError)).toBe(false)
		})

		it('should check if error should trigger circuit breaker', () => {
			const authError = createCategorizedError(ErrorCategory.AUTHENTICATION)

			expect(policyManager.shouldCircuitBreak('otlp', authError)).toBe(true)
			expect(policyManager.shouldCircuitBreak('console', authError)).toBe(false)
		})

		it('should get backoff multiplier for transport and error', () => {
			const rateLimitError = createCategorizedError(ErrorCategory.RATE_LIMIT)

			expect(policyManager.getBackoffMultiplier('otlp', rateLimitError)).toBe(3)
			expect(policyManager.getBackoffMultiplier('console', rateLimitError)).toBe(1)
		})

		it('should handle unknown transport gracefully', () => {
			const networkError = createCategorizedError(ErrorCategory.NETWORK)

			expect(policyManager.isRetryable('unknown', networkError)).toBe(true) // Uses default policy
			expect(policyManager.shouldCircuitBreak('unknown', networkError)).toBe(false)
			expect(policyManager.getBackoffMultiplier('unknown', networkError)).toBe(1)
		})
	})

	describe('custom policy registration', () => {
		it('should allow registering custom policies', () => {
			const customPolicy = {
				transportName: 'custom',
				retryConfig: {
					maxAttempts: 10,
					initialDelayMs: 2000,
					maxDelayMs: 60000,
					multiplier: 3,
					jitterMs: 1000,
				},
				isRetryable: () => true,
				shouldCircuitBreak: () => false,
				getBackoffMultiplier: () => 2,
			}

			policyManager.registerPolicy(customPolicy)

			const retrievedPolicy = policyManager.getPolicy('custom')
			expect(retrievedPolicy).toBe(customPolicy)
		})
	})
})

describe('TransportErrorRateLimiter', () => {
	let rateLimiter: TransportErrorRateLimiter

	beforeEach(() => {
		rateLimiter = new TransportErrorRateLimiter(5) // 5 errors per minute
	})

	describe('error rate limiting', () => {
		it('should allow errors under the rate limit', () => {
			const error = createCategorizedError(ErrorCategory.NETWORK)

			for (let i = 0; i < 5; i++) {
				expect(rateLimiter.shouldProcessError('test-transport', error)).toBe(true)
			}
		})

		it('should block errors over the rate limit', () => {
			const error = createCategorizedError(ErrorCategory.NETWORK)

			// Fill up the rate limit
			for (let i = 0; i < 5; i++) {
				rateLimiter.shouldProcessError('test-transport', error)
			}

			// Next error should be blocked
			expect(rateLimiter.shouldProcessError('test-transport', error)).toBe(false)
		})

		it('should always allow critical errors', () => {
			const criticalError = createCategorizedError(ErrorCategory.NETWORK, ErrorSeverity.CRITICAL)

			// Fill up the rate limit with normal errors
			const normalError = createCategorizedError(ErrorCategory.NETWORK)
			for (let i = 0; i < 10; i++) {
				rateLimiter.shouldProcessError('test-transport', normalError)
			}

			// Critical error should still be allowed
			expect(rateLimiter.shouldProcessError('test-transport', criticalError)).toBe(true)
		})

		it('should track errors separately by transport and category', () => {
			const networkError = createCategorizedError(ErrorCategory.NETWORK)
			const timeoutError = createCategorizedError(ErrorCategory.TIMEOUT)

			// Fill up network errors for transport1
			for (let i = 0; i < 5; i++) {
				rateLimiter.shouldProcessError('transport1', networkError)
			}

			// Network errors for transport1 should be blocked
			expect(rateLimiter.shouldProcessError('transport1', networkError)).toBe(false)

			// But timeout errors for transport1 should still be allowed
			expect(rateLimiter.shouldProcessError('transport1', timeoutError)).toBe(true)

			// And network errors for transport2 should still be allowed
			expect(rateLimiter.shouldProcessError('transport2', networkError)).toBe(true)
		})

		it('should reset rate limit after time window', async () => {
			// Use a shorter window for testing
			const shortWindowLimiter = new TransportErrorRateLimiter(2)
			// Mock the window to be very short
			const originalWindowMs = (shortWindowLimiter as any).windowMs
			;(shortWindowLimiter as any).windowMs = 100 // 100ms window

			const error = createCategorizedError(ErrorCategory.NETWORK)

			// Fill up the rate limit
			expect(shortWindowLimiter.shouldProcessError('test-transport', error)).toBe(true)
			expect(shortWindowLimiter.shouldProcessError('test-transport', error)).toBe(true)
			expect(shortWindowLimiter.shouldProcessError('test-transport', error)).toBe(false)

			// Wait for window to expire
			await new Promise((resolve) => setTimeout(resolve, 150))

			// Should be allowed again
			expect(shortWindowLimiter.shouldProcessError('test-transport', error)).toBe(true)

			// Restore original window
			;(shortWindowLimiter as any).windowMs = originalWindowMs
		})
	})

	describe('error rate tracking', () => {
		it('should track error rates correctly', () => {
			const networkError = createCategorizedError(ErrorCategory.NETWORK)
			const timeoutError = createCategorizedError(ErrorCategory.TIMEOUT)

			// Generate some errors
			for (let i = 0; i < 3; i++) {
				rateLimiter.shouldProcessError('test-transport', networkError)
			}
			for (let i = 0; i < 2; i++) {
				rateLimiter.shouldProcessError('test-transport', timeoutError)
			}

			expect(rateLimiter.getErrorRate('test-transport', ErrorCategory.NETWORK)).toBe(3)
			expect(rateLimiter.getErrorRate('test-transport', ErrorCategory.TIMEOUT)).toBe(2)
			expect(rateLimiter.getErrorRate('test-transport', ErrorCategory.RESOURCE)).toBe(0)
		})

		it('should return all error rates', () => {
			const networkError = createCategorizedError(ErrorCategory.NETWORK)
			const timeoutError = createCategorizedError(ErrorCategory.TIMEOUT)

			rateLimiter.shouldProcessError('transport1', networkError)
			rateLimiter.shouldProcessError('transport1', timeoutError)
			rateLimiter.shouldProcessError('transport2', networkError)

			const allRates = rateLimiter.getAllErrorRates()
			expect(allRates.get('transport1_network')).toBe(1)
			expect(allRates.get('transport1_timeout')).toBe(1)
			expect(allRates.get('transport2_network')).toBe(1)
		})

		it('should reset error counts for specific transport', () => {
			const error = createCategorizedError(ErrorCategory.NETWORK)

			rateLimiter.shouldProcessError('transport1', error)
			rateLimiter.shouldProcessError('transport2', error)

			expect(rateLimiter.getErrorRate('transport1', ErrorCategory.NETWORK)).toBe(1)
			expect(rateLimiter.getErrorRate('transport2', ErrorCategory.NETWORK)).toBe(1)

			rateLimiter.resetErrorCounts('transport1')

			expect(rateLimiter.getErrorRate('transport1', ErrorCategory.NETWORK)).toBe(0)
			expect(rateLimiter.getErrorRate('transport2', ErrorCategory.NETWORK)).toBe(1)
		})
	})
})

// Helper function to create categorized errors for testing
function createCategorizedError(
	category: ErrorCategory,
	severity: ErrorSeverity = ErrorSeverity.MEDIUM
): CategorizedError {
	const context: ErrorContext = {
		operation: 'test_operation',
		transportName: 'test-transport',
	}

	return {
		originalError: new Error('Test error'),
		category,
		severity,
		context,
		timestamp: new Date(),
		isRetryable: true,
		recoveryStrategy: RecoveryStrategy.RETRY,
	}
}
