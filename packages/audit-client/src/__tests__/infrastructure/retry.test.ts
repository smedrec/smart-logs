import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	CircuitBreakerOpenError,
	CircuitBreakerState,
	HttpError,
	RetryExhaustedError,
	RetryManager,
} from '../../infrastructure/retry'

import type { RetryConfig } from '../../core/config'
import type { CircuitBreakerConfig, RetryContext } from '../../infrastructure/retry'

describe('RetryManager', () => {
	let retryManager: RetryManager
	let mockOperation: vi.MockedFunction<() => Promise<string>>
	let context: RetryContext

	const defaultConfig: RetryConfig = {
		enabled: true,
		maxAttempts: 3,
		initialDelayMs: 100,
		maxDelayMs: 1000,
		backoffMultiplier: 2,
		retryableStatusCodes: [408, 429, 500, 502, 503, 504],
		retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
	}

	const circuitBreakerConfig: CircuitBreakerConfig = {
		enabled: true,
		failureThreshold: 3,
		recoveryTimeoutMs: 1000,
		monitoringWindowMs: 5000,
		minimumRequestThreshold: 2,
	}

	beforeEach(() => {
		retryManager = new RetryManager(defaultConfig, circuitBreakerConfig)
		mockOperation = vi.fn()
		context = {
			endpoint: '/test',
			requestId: 'test-123',
			method: 'GET',
		}

		// Mock setTimeout to make tests faster
		vi.useFakeTimers()

		// Reset circuit breakers between tests
		retryManager.resetAllCircuitBreakers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	describe('Basic Retry Functionality', () => {
		it('should succeed on first attempt', async () => {
			mockOperation.mockResolvedValueOnce('success')

			const result = await retryManager.execute(mockOperation, context)

			expect(result).toBe('success')
			expect(mockOperation).toHaveBeenCalledTimes(1)
		})

		it('should retry on retryable HTTP errors', async () => {
			const httpError = new HttpError(500, 'Internal Server Error')
			mockOperation
				.mockRejectedValueOnce(httpError)
				.mockRejectedValueOnce(httpError)
				.mockResolvedValueOnce('success')

			const promise = retryManager.execute(mockOperation, context)

			// Fast-forward through delays
			await vi.runAllTimersAsync()

			const result = await promise
			expect(result).toBe('success')
			expect(mockOperation).toHaveBeenCalledTimes(3)
		})

		it('should not retry on non-retryable HTTP errors', async () => {
			const httpError = new HttpError(400, 'Bad Request')
			mockOperation.mockRejectedValueOnce(httpError)

			await expect(retryManager.execute(mockOperation, context)).rejects.toThrow(
				RetryExhaustedError
			)
			expect(mockOperation).toHaveBeenCalledTimes(1)
		})

		it('should retry on network errors', async () => {
			const networkError = new Error('ECONNRESET: Connection reset by peer')
			mockOperation.mockRejectedValueOnce(networkError).mockResolvedValueOnce('success')

			const promise = retryManager.execute(mockOperation, context)
			await vi.runAllTimersAsync()

			const result = await promise
			expect(result).toBe('success')
			expect(mockOperation).toHaveBeenCalledTimes(2)
		})

		it('should exhaust retries and throw RetryExhaustedError', async () => {
			const httpError = new HttpError(500, 'Internal Server Error')
			mockOperation.mockRejectedValue(httpError)

			const promise = retryManager.execute(mockOperation, context)
			await vi.runAllTimersAsync()

			await expect(promise).rejects.toThrow(RetryExhaustedError)
			expect(mockOperation).toHaveBeenCalledTimes(3)
		})
	})

	describe('Exponential Backoff with Jitter', () => {
		it('should apply exponential backoff delays', async () => {
			const httpError = new HttpError(500, 'Internal Server Error')
			mockOperation.mockRejectedValue(httpError)

			const startTime = Date.now()
			const promise = retryManager.execute(mockOperation, context)

			// Manually advance timers to check delay progression
			await vi.advanceTimersByTimeAsync(50) // First delay should be ~100ms with jitter
			await vi.advanceTimersByTimeAsync(150) // Second delay should be ~200ms with jitter
			await vi.advanceTimersByTimeAsync(300) // Third delay should be ~400ms with jitter

			await expect(promise).rejects.toThrow(RetryExhaustedError)
		})

		it('should respect maximum delay', async () => {
			const configWithLowMax: RetryConfig = {
				...defaultConfig,
				maxDelayMs: 150,
				maxAttempts: 5,
			}
			retryManager = new RetryManager(configWithLowMax)

			const httpError = new HttpError(500, 'Internal Server Error')
			mockOperation.mockRejectedValue(httpError)

			const promise = retryManager.execute(mockOperation, context)
			await vi.runAllTimersAsync()

			await expect(promise).rejects.toThrow(RetryExhaustedError)
			expect(mockOperation).toHaveBeenCalledTimes(5)
		})
	})

	describe('Circuit Breaker Pattern', () => {
		it('should open circuit breaker after threshold failures', async () => {
			const httpError = new HttpError(500, 'Internal Server Error')

			// First request - should fail and record failure
			mockOperation.mockRejectedValue(httpError)
			const promise1 = retryManager.execute(mockOperation, context)
			await vi.runAllTimersAsync()
			await expect(promise1).rejects.toThrow(RetryExhaustedError)

			// Second request - should fail and record failure
			mockOperation.mockRejectedValue(httpError)
			const promise2 = retryManager.execute(mockOperation, context)
			await vi.runAllTimersAsync()
			await expect(promise2).rejects.toThrow(RetryExhaustedError)

			// Fourth request - should be blocked by circuit breaker
			await expect(retryManager.execute(mockOperation, context)).rejects.toThrow(
				CircuitBreakerOpenError
			)

			// Verify circuit breaker stats
			const stats = retryManager.getCircuitBreakerStats('/test:GET')
			expect(stats).toBeTruthy()
			expect(stats!.state).toBe(CircuitBreakerState.OPEN)
		})

		it('should transition to half-open after recovery timeout', async () => {
			const httpError = new HttpError(500, 'Internal Server Error')

			// Trigger circuit breaker to open
			for (let i = 0; i < 2; i++) {
				mockOperation.mockRejectedValue(httpError)
				const promise = retryManager.execute(mockOperation, context)
				await vi.runAllTimersAsync()
				await expect(promise).rejects.toThrow(RetryExhaustedError)
			}

			// Verify circuit is open
			await expect(retryManager.execute(mockOperation, context)).rejects.toThrow(
				CircuitBreakerOpenError
			)

			// Fast-forward past recovery timeout
			await vi.advanceTimersByTimeAsync(1001)

			// Next request should transition to half-open and succeed
			mockOperation.mockResolvedValueOnce('success')
			const result = await retryManager.execute(mockOperation, context)

			expect(result).toBe('success')
			const stats = retryManager.getCircuitBreakerStats('/test:GET')
			expect(stats!.state).toBe(CircuitBreakerState.CLOSED)
		})

		it('should reset circuit breaker manually', async () => {
			const httpError = new HttpError(500, 'Internal Server Error')

			// Trigger circuit breaker to open
			for (let i = 0; i < 2; i++) {
				mockOperation.mockRejectedValue(httpError)
				const promise = retryManager.execute(mockOperation, context)
				await vi.runAllTimersAsync()
				await expect(promise).rejects.toThrow(RetryExhaustedError)
			}

			// Verify circuit is open
			await expect(retryManager.execute(mockOperation, context)).rejects.toThrow(
				CircuitBreakerOpenError
			)

			// Reset circuit breaker
			retryManager.resetCircuitBreaker('/test:GET')

			// Should work normally now
			mockOperation.mockResolvedValueOnce('success')
			const result = await retryManager.execute(mockOperation, context)
			expect(result).toBe('success')
		})
	})

	describe('Configuration Management', () => {
		it('should respect disabled retry configuration', async () => {
			const disabledConfig: RetryConfig = { ...defaultConfig, enabled: false }
			retryManager = new RetryManager(disabledConfig)

			const httpError = new HttpError(500, 'Internal Server Error')
			mockOperation.mockRejectedValueOnce(httpError)

			await expect(retryManager.execute(mockOperation, context)).rejects.toThrow(httpError)
			expect(mockOperation).toHaveBeenCalledTimes(1)
		})

		it('should update configuration dynamically', async () => {
			retryManager.updateConfig({ maxAttempts: 5 })

			const httpError = new HttpError(500, 'Internal Server Error')
			mockOperation.mockRejectedValue(httpError)

			const promise = retryManager.execute(mockOperation, context)
			await vi.runAllTimersAsync()

			await expect(promise).rejects.toThrow(RetryExhaustedError)
			expect(mockOperation).toHaveBeenCalledTimes(5)
		})

		it('should get current configuration', () => {
			const config = retryManager.getConfig()
			expect(config).toEqual(defaultConfig)
		})
	})

	describe('Parallel Execution', () => {
		it('should execute multiple operations in parallel', async () => {
			const operations = [
				vi.fn().mockResolvedValue('result1'),
				vi.fn().mockResolvedValue('result2'),
				vi.fn().mockRejectedValue(new HttpError(500, 'Error')),
			]

			const contexts = [
				{ endpoint: '/test1', requestId: 'req1' },
				{ endpoint: '/test2', requestId: 'req2' },
				{ endpoint: '/test3', requestId: 'req3' },
			]

			const promise = retryManager.executeAll(operations, contexts)
			await vi.runAllTimersAsync()
			const results = await promise

			expect(results).toHaveLength(3)
			expect(results[0].success).toBe(true)
			expect(results[0].data).toBe('result1')
			expect(results[1].success).toBe(true)
			expect(results[1].data).toBe('result2')
			expect(results[2].success).toBe(false)
			expect(results[2].error).toBeInstanceOf(RetryExhaustedError)
		})
	})

	describe('Error Classification', () => {
		it('should identify network errors correctly', async () => {
			const networkErrors = [
				new Error('ECONNRESET'),
				new Error('ECONNREFUSED'),
				new Error('ETIMEDOUT'),
				new Error('ENOTFOUND'),
			]

			for (const error of networkErrors) {
				// Reset circuit breaker for each test
				retryManager.resetAllCircuitBreakers()
				mockOperation.mockClear()

				mockOperation.mockRejectedValueOnce(error).mockResolvedValueOnce('success')

				const promise = retryManager.execute(mockOperation, context)
				await vi.runAllTimersAsync()

				const result = await promise
				expect(result).toBe('success')
			}
		})

		it('should identify timeout errors correctly', async () => {
			const timeoutErrors = [
				new Error('Request timeout'),
				new Error('ETIMEDOUT'),
				Object.assign(new Error('Timeout'), { name: 'TimeoutError' }),
			]

			for (const error of timeoutErrors) {
				mockOperation.mockRejectedValueOnce(error).mockResolvedValueOnce('success')

				const promise = retryManager.execute(mockOperation, context)
				await vi.runAllTimersAsync()

				const result = await promise
				expect(result).toBe('success')
			}
		})

		it('should not retry validation errors', async () => {
			const validationErrors = [
				new HttpError(400, 'Bad Request'),
				new HttpError(401, 'Unauthorized'),
				new HttpError(403, 'Forbidden'),
				new HttpError(404, 'Not Found'),
			]

			for (const error of validationErrors) {
				// Reset circuit breaker for each test
				retryManager.resetAllCircuitBreakers()
				mockOperation.mockClear()

				mockOperation.mockRejectedValueOnce(error)

				await expect(retryManager.execute(mockOperation, context)).rejects.toThrow(
					RetryExhaustedError
				)
				expect(mockOperation).toHaveBeenCalledTimes(1)
			}
		})
	})

	describe('Static Factory Methods', () => {
		it('should create retry manager with custom config', () => {
			const customConfig: RetryConfig = {
				enabled: true,
				maxAttempts: 5,
				initialDelayMs: 500,
				maxDelayMs: 5000,
				backoffMultiplier: 3,
				retryableStatusCodes: [500],
				retryableErrors: ['TIMEOUT'],
			}

			const manager = RetryManager.create(customConfig)
			expect(manager.getConfig()).toEqual(customConfig)
		})

		it('should create retry manager with default config', () => {
			const manager = RetryManager.createDefault()
			const config = manager.getConfig()

			expect(config.enabled).toBe(true)
			expect(config.maxAttempts).toBe(3)
			expect(config.initialDelayMs).toBe(1000)
			expect(config.maxDelayMs).toBe(30000)
			expect(config.backoffMultiplier).toBe(2)
		})
	})

	describe('Circuit Breaker Statistics', () => {
		it('should provide circuit breaker statistics', async () => {
			const httpError = new HttpError(500, 'Internal Server Error')

			// Generate some failures
			mockOperation.mockRejectedValue(httpError)
			const promise1 = retryManager.execute(mockOperation, context)
			await vi.runAllTimersAsync()
			await expect(promise1).rejects.toThrow(RetryExhaustedError)

			// Check stats
			const stats = retryManager.getCircuitBreakerStats('/test:GET')
			expect(stats).toBeTruthy()
			expect(stats!.failureCount).toBeGreaterThan(0)
			expect(stats!.totalRequests).toBeGreaterThan(0)
		})

		it('should get all circuit breaker statistics', async () => {
			const httpError = new HttpError(500, 'Internal Server Error')

			// Generate failures for different endpoints
			const contexts = [
				{ endpoint: '/test1', requestId: 'req1' },
				{ endpoint: '/test2', requestId: 'req2' },
			]

			for (const ctx of contexts) {
				mockOperation.mockRejectedValue(httpError)
				const promise = retryManager.execute(mockOperation, ctx)
				await vi.runAllTimersAsync()
				await expect(promise).rejects.toThrow(RetryExhaustedError)
			}

			const allStats = retryManager.getCircuitBreakerStats()
			expect(allStats).toBeInstanceOf(Map)
			expect((allStats as Map<string, any>).size).toBe(2)
		})
	})

	describe('Error Details', () => {
		it('should provide detailed error information in RetryExhaustedError', async () => {
			const originalError = new HttpError(
				500,
				'Internal Server Error',
				{ detail: 'test' },
				'req-123'
			)
			mockOperation.mockRejectedValue(originalError)

			const promise = retryManager.execute(mockOperation, context)
			await vi.runAllTimersAsync()

			try {
				await promise
				expect.fail('Should have thrown RetryExhaustedError')
			} catch (error) {
				expect(error).toBeInstanceOf(RetryExhaustedError)
				const retryError = error as RetryExhaustedError
				expect(retryError.originalError).toBe(originalError)
				expect(retryError.context.endpoint).toBe('/test')
				expect(retryError.attempts).toBe(3)
			}
		})

		it('should provide detailed error information in CircuitBreakerOpenError', async () => {
			const httpError = new HttpError(500, 'Internal Server Error')

			// Trigger circuit breaker to open
			for (let i = 0; i < 2; i++) {
				mockOperation.mockRejectedValue(httpError)
				const promise = retryManager.execute(mockOperation, context)
				await vi.runAllTimersAsync()
				await expect(promise).rejects.toThrow(RetryExhaustedError)
			}

			try {
				await retryManager.execute(mockOperation, context)
				expect.fail('Should have thrown CircuitBreakerOpenError')
			} catch (error) {
				expect(error).toBeInstanceOf(CircuitBreakerOpenError)
				const cbError = error as CircuitBreakerOpenError
				expect(cbError.nextRetryTime).toBeGreaterThan(Date.now())
				expect(cbError.stats.state).toBe(CircuitBreakerState.OPEN)
			}
		})
	})
})
