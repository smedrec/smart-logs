import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DefaultRetryManager } from '../retry-manager.js'

import type { CircuitBreaker, RetryConfig } from '../../types/batch.js'

describe('DefaultRetryManager', () => {
	let retryManager: DefaultRetryManager
	let mockCircuitBreaker: CircuitBreaker

	beforeEach(() => {
		mockCircuitBreaker = {
			canExecute: vi.fn().mockReturnValue(true),
			onSuccess: vi.fn(),
			onFailure: vi.fn(),
			getState: vi.fn().mockReturnValue('closed'),
		}
		retryManager = new DefaultRetryManager(mockCircuitBreaker)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('Successful Operations', () => {
		it('should execute operation successfully on first attempt', async () => {
			const mockOperation = vi.fn().mockResolvedValue('success')
			const config: RetryConfig = {
				maxAttempts: 3,
				initialDelayMs: 100,
				maxDelayMs: 1000,
				multiplier: 2,
			}

			const result = await retryManager.executeWithRetry(mockOperation, config)

			expect(result).toBe('success')
			expect(mockOperation).toHaveBeenCalledTimes(1)
			expect(mockCircuitBreaker.onSuccess).toHaveBeenCalledTimes(1)
			expect(mockCircuitBreaker.onFailure).not.toHaveBeenCalled()
		})

		it('should notify circuit breaker of success', async () => {
			const mockOperation = vi.fn().mockResolvedValue('success')
			const config = DefaultRetryManager.createConfig()

			await retryManager.executeWithRetry(mockOperation, config)

			expect(mockCircuitBreaker.onSuccess).toHaveBeenCalledTimes(1)
		})
	})

	describe('Retry Logic', () => {
		it('should retry on retryable errors', async () => {
			const mockOperation = vi
				.fn()
				.mockRejectedValueOnce(new Error('network timeout'))
				.mockRejectedValueOnce(new Error('connection refused'))
				.mockResolvedValue('success')

			const config: RetryConfig = {
				maxAttempts: 3,
				initialDelayMs: 10, // Short delay for testing
				maxDelayMs: 100,
				multiplier: 2,
			}

			const result = await retryManager.executeWithRetry(mockOperation, config)

			expect(result).toBe('success')
			expect(mockOperation).toHaveBeenCalledTimes(3)
			expect(mockCircuitBreaker.onFailure).toHaveBeenCalledTimes(2)
			expect(mockCircuitBreaker.onSuccess).toHaveBeenCalledTimes(1)
		})

		it('should not retry on non-retryable errors', async () => {
			const mockOperation = vi.fn().mockRejectedValue(new Error('401 unauthorized'))
			const config = DefaultRetryManager.createConfig()

			await expect(retryManager.executeWithRetry(mockOperation, config)).rejects.toThrow(
				'Non-retryable error'
			)

			expect(mockOperation).toHaveBeenCalledTimes(1)
		})

		it('should exhaust all retry attempts', async () => {
			const mockOperation = vi.fn().mockRejectedValue(new Error('500 server error'))
			const config: RetryConfig = {
				maxAttempts: 2,
				initialDelayMs: 10,
				maxDelayMs: 100,
				multiplier: 2,
			}

			await expect(retryManager.executeWithRetry(mockOperation, config)).rejects.toThrow(
				'Operation failed after 3 attempts'
			)

			expect(mockOperation).toHaveBeenCalledTimes(3) // Initial + 2 retries
		})
	})

	describe('Exponential Backoff', () => {
		it('should calculate correct backoff delays', async () => {
			const delays: number[] = []
			const originalSetTimeout = global.setTimeout

			// Mock setTimeout to capture delays
			global.setTimeout = vi.fn().mockImplementation((callback, delay) => {
				delays.push(delay)
				return originalSetTimeout(callback, 0) // Execute immediately for testing
			})

			const mockOperation = vi
				.fn()
				.mockRejectedValueOnce(new Error('timeout'))
				.mockRejectedValueOnce(new Error('timeout'))
				.mockResolvedValue('success')

			const config: RetryConfig = {
				maxAttempts: 3,
				initialDelayMs: 100,
				maxDelayMs: 1000,
				multiplier: 2,
			}

			await retryManager.executeWithRetry(mockOperation, config)

			// Should have 2 delays (for 2 retries)
			expect(delays).toHaveLength(2)

			// First delay should be around 100ms (with jitter)
			expect(delays[0]).toBeGreaterThanOrEqual(75)
			expect(delays[0]).toBeLessThanOrEqual(125)

			// Second delay should be around 200ms (with jitter)
			expect(delays[1]).toBeGreaterThanOrEqual(150)
			expect(delays[1]).toBeLessThanOrEqual(250)

			global.setTimeout = originalSetTimeout
		})

		it('should respect maximum delay', async () => {
			const delays: number[] = []
			const originalSetTimeout = global.setTimeout

			global.setTimeout = vi.fn().mockImplementation((callback, delay) => {
				delays.push(delay)
				return originalSetTimeout(callback, 0)
			})

			const mockOperation = vi
				.fn()
				.mockRejectedValueOnce(new Error('timeout'))
				.mockRejectedValueOnce(new Error('timeout'))
				.mockResolvedValue('success')

			const config: RetryConfig = {
				maxAttempts: 3,
				initialDelayMs: 1000,
				maxDelayMs: 1500, // Lower than what exponential would produce
				multiplier: 3,
			}

			await retryManager.executeWithRetry(mockOperation, config)

			// All delays should be capped at maxDelayMs
			delays.forEach((delay) => {
				expect(delay).toBeLessThanOrEqual(1500)
			})

			global.setTimeout = originalSetTimeout
		})
	})

	describe('Error Classification', () => {
		const retryableErrors = [
			'network error',
			'timeout',
			'connection reset',
			'ECONNRESET',
			'ECONNREFUSED',
			'ETIMEDOUT',
			'500 internal server error',
			'502 bad gateway',
			'503 service unavailable',
			'504 gateway timeout',
			'429 too many requests',
		]

		const nonRetryableErrors = [
			'400 bad request',
			'401 unauthorized',
			'403 forbidden',
			'404 not found',
			'422 unprocessable entity',
			'invalid input',
			'malformed request',
		]

		retryableErrors.forEach((errorMessage) => {
			it(`should retry on error: ${errorMessage}`, async () => {
				const mockOperation = vi
					.fn()
					.mockRejectedValueOnce(new Error(errorMessage))
					.mockResolvedValue('success')

				const config: RetryConfig = {
					maxAttempts: 1,
					initialDelayMs: 10,
					maxDelayMs: 100,
					multiplier: 2,
				}

				const result = await retryManager.executeWithRetry(mockOperation, config)
				expect(result).toBe('success')
				expect(mockOperation).toHaveBeenCalledTimes(2)
			})
		})

		nonRetryableErrors.forEach((errorMessage) => {
			it(`should not retry on error: ${errorMessage}`, async () => {
				const mockOperation = vi.fn().mockRejectedValue(new Error(errorMessage))
				const config = DefaultRetryManager.createConfig()

				await expect(retryManager.executeWithRetry(mockOperation, config)).rejects.toThrow(
					'Non-retryable error'
				)

				expect(mockOperation).toHaveBeenCalledTimes(1)
			})
		})

		it('should handle errors with status codes', async () => {
			const error = new Error('Server error') as any
			error.status = 503

			const mockOperation = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('success')

			const config: RetryConfig = {
				maxAttempts: 1,
				initialDelayMs: 10,
				maxDelayMs: 100,
				multiplier: 2,
			}

			const result = await retryManager.executeWithRetry(mockOperation, config)
			expect(result).toBe('success')
			expect(mockOperation).toHaveBeenCalledTimes(2)
		})
	})

	describe('Circuit Breaker Integration', () => {
		it('should check circuit breaker before execution', async () => {
			mockCircuitBreaker.canExecute = vi.fn().mockReturnValue(false)

			const mockOperation = vi.fn().mockResolvedValue('success')
			const config = DefaultRetryManager.createConfig()

			await expect(retryManager.executeWithRetry(mockOperation, config)).rejects.toThrow(
				'Circuit breaker is open'
			)

			expect(mockOperation).not.toHaveBeenCalled()
		})

		it('should work without circuit breaker', async () => {
			const retryManagerWithoutCB = new DefaultRetryManager()
			const mockOperation = vi.fn().mockResolvedValue('success')
			const config = DefaultRetryManager.createConfig()

			const result = await retryManagerWithoutCB.executeWithRetry(mockOperation, config)

			expect(result).toBe('success')
			expect(mockOperation).toHaveBeenCalledTimes(1)
		})
	})

	describe('Configuration Factory', () => {
		it('should create config with defaults', () => {
			const config = DefaultRetryManager.createConfig()

			expect(config).toEqual({
				maxAttempts: 3,
				initialDelayMs: 1000,
				maxDelayMs: 30000,
				multiplier: 2,
			})
		})

		it('should create config with overrides', () => {
			const config = DefaultRetryManager.createConfig({
				maxAttempts: 5,
				initialDelayMs: 500,
			})

			expect(config).toEqual({
				maxAttempts: 5,
				initialDelayMs: 500,
				maxDelayMs: 30000,
				multiplier: 2,
			})
		})

		it('should create retry manager with circuit breaker', () => {
			const manager = DefaultRetryManager.withCircuitBreaker(mockCircuitBreaker)
			expect(manager).toBeInstanceOf(DefaultRetryManager)
		})
	})

	describe('Edge Cases', () => {
		it('should handle non-Error objects', async () => {
			const mockOperation = vi.fn().mockRejectedValue('string error')
			const config: RetryConfig = {
				maxAttempts: 3,
				initialDelayMs: 10, // Short delay for testing
				maxDelayMs: 100,
				multiplier: 2,
			}

			await expect(retryManager.executeWithRetry(mockOperation, config)).rejects.toThrow(
				'Operation failed after 4 attempts'
			)

			expect(mockOperation).toHaveBeenCalledTimes(4) // Initial + 3 retries
		})

		it('should handle zero max attempts', async () => {
			const mockOperation = vi.fn().mockRejectedValue(new Error('test error'))
			const config: RetryConfig = {
				maxAttempts: 0,
				initialDelayMs: 100,
				maxDelayMs: 1000,
				multiplier: 2,
			}

			await expect(retryManager.executeWithRetry(mockOperation, config)).rejects.toThrow(
				'Operation failed after 1 attempts'
			)

			expect(mockOperation).toHaveBeenCalledTimes(1)
		})
	})
})
