/**
 * Unit tests for EnhancedTransportWrapper
 * Addresses requirement 10.1, 10.3: Test fallback mechanisms and enhanced transport features
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LogLevel } from '../../types/logger.js'
import { createEnhancedTransport, EnhancedTransportWrapper } from '../enhanced-transport-wrapper.js'
import { defaultErrorHandlerConfig, ErrorHandler } from '../error-handler.js'

import type { CircuitBreaker, RetryManager } from '../../types/batch.js'
import type { LogEntry } from '../../types/log-entry.js'
import type { LogTransport } from '../../types/transport.js'

// Mock transport implementation
class MockTransport implements LogTransport {
	public sendCalls: LogEntry[][] = []
	public flushCalls = 0
	public closeCalls = 0
	public shouldFail = false
	public isHealthyValue = true
	public failureCount = 0
	public sendDelay = 0

	constructor(public readonly name: string) {}

	async send(entries: LogEntry[]): Promise<void> {
		this.sendCalls.push(entries)

		if (this.sendDelay > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.sendDelay))
		}

		if (this.shouldFail) {
			this.failureCount++
			throw new Error(`Mock transport ${this.name} failed (attempt ${this.failureCount})`)
		}
	}

	async flush(): Promise<void> {
		this.flushCalls++
		if (this.shouldFail) {
			throw new Error(`Mock transport ${this.name} flush failed`)
		}
	}

	async close(): Promise<void> {
		this.closeCalls++
		if (this.shouldFail) {
			throw new Error(`Mock transport ${this.name} close failed`)
		}
	}

	isHealthy(): boolean {
		return this.isHealthyValue
	}

	reset(): void {
		this.sendCalls = []
		this.flushCalls = 0
		this.closeCalls = 0
		this.shouldFail = false
		this.isHealthyValue = true
		this.failureCount = 0
		this.sendDelay = 0
	}
}

// Mock RetryManager
class MockRetryManager implements RetryManager {
	public executeWithRetryCalls: Array<{ operation: Function; config: any }> = []

	async executeWithRetry<T>(operation: () => Promise<T>, config: any): Promise<T> {
		this.executeWithRetryCalls.push({ operation, config })
		return await operation()
	}

	reset(): void {
		this.executeWithRetryCalls = []
	}
}

// Mock CircuitBreaker
class MockCircuitBreaker implements CircuitBreaker {
	public canExecuteValue = true
	public onSuccessCalls = 0
	public onFailureCalls = 0

	canExecute(): boolean {
		return this.canExecuteValue
	}

	onSuccess(): void {
		this.onSuccessCalls++
	}

	onFailure(): void {
		this.onFailureCalls++
	}

	reset(): void {
		this.canExecuteValue = true
		this.onSuccessCalls = 0
		this.onFailureCalls = 0
	}
}

describe('EnhancedTransportWrapper', () => {
	let baseTransport: MockTransport
	let enhancedTransport: EnhancedTransportWrapper
	let errorHandler: ErrorHandler
	let retryManager: MockRetryManager
	let circuitBreaker: MockCircuitBreaker
	let mockLogEntry: LogEntry

	beforeEach(() => {
		baseTransport = new MockTransport('test-transport')
		errorHandler = new ErrorHandler(defaultErrorHandlerConfig)
		retryManager = new MockRetryManager()
		circuitBreaker = new MockCircuitBreaker()

		const config = {
			enableHealthMonitoring: false, // Disable for simpler testing
			enableRetryPolicies: true,
			enableErrorRateLimiting: true,
			enableFallback: false,
			maxErrorsPerMinute: 10,
		}

		enhancedTransport = new EnhancedTransportWrapper(
			baseTransport,
			config,
			errorHandler,
			retryManager,
			circuitBreaker
		)

		mockLogEntry = {
			id: 'test-id',
			timestamp: new Date(),
			level: LogLevel.INFO,
			message: 'Test message',
			correlationId: 'test-correlation',
			fields: {},
			metadata: {
				service: 'test-service',
				environment: 'test',
				hostname: 'test-host',
				pid: 12345,
			},
			source: 'test',
			version: '1.0.0',
		}
	})

	afterEach(() => {
		baseTransport.reset()
		retryManager.reset()
		circuitBreaker.reset()
	})

	describe('basic functionality', () => {
		it('should have correct name', () => {
			expect(enhancedTransport.name).toBe('enhanced_test-transport')
		})

		it('should send logs successfully when base transport works', async () => {
			await enhancedTransport.send([mockLogEntry])

			expect(baseTransport.sendCalls).toHaveLength(1)
			expect(baseTransport.sendCalls[0]).toEqual([mockLogEntry])
			expect(circuitBreaker.onSuccessCalls).toBe(1)
		})

		it('should flush base transport', async () => {
			await enhancedTransport.flush()

			expect(baseTransport.flushCalls).toBe(1)
		})

		it('should close base transport', async () => {
			await enhancedTransport.close()

			expect(baseTransport.closeCalls).toBe(1)
		})

		it('should report health status', () => {
			expect(enhancedTransport.isHealthy()).toBe(true)

			baseTransport.isHealthyValue = false
			expect(enhancedTransport.isHealthy()).toBe(false)
		})
	})

	describe('circuit breaker integration', () => {
		it('should check circuit breaker before sending', async () => {
			circuitBreaker.canExecuteValue = false

			await expect(enhancedTransport.send([mockLogEntry])).rejects.toThrow(
				'Circuit breaker is open'
			)
			expect(baseTransport.sendCalls).toHaveLength(0)
		})

		it('should call onSuccess when send succeeds', async () => {
			await enhancedTransport.send([mockLogEntry])

			expect(circuitBreaker.onSuccessCalls).toBe(1)
			expect(circuitBreaker.onFailureCalls).toBe(0)
		})

		it('should call onFailure when send fails', async () => {
			baseTransport.shouldFail = true

			await expect(enhancedTransport.send([mockLogEntry])).rejects.toThrow()
			expect(circuitBreaker.onFailureCalls).toBe(1)
		})

		it('should not report healthy when circuit breaker is open', () => {
			circuitBreaker.canExecuteValue = false

			expect(enhancedTransport.isHealthy()).toBe(false)
		})
	})

	describe('retry logic', () => {
		it('should retry failed operations', async () => {
			// Make transport fail twice with network errors (retryable), then succeed
			let attempts = 0
			baseTransport.send = vi.fn().mockImplementation(async () => {
				attempts++
				if (attempts <= 2) {
					throw new Error(`Network error: ECONNREFUSED attempt ${attempts}`)
				}
			})

			await enhancedTransport.send([mockLogEntry])

			expect(attempts).toBe(3) // 2 failures + 1 success
		})

		it('should stop retrying non-retryable errors', async () => {
			// Configuration errors are not retryable
			baseTransport.send = vi.fn().mockRejectedValue(new Error('Invalid configuration'))

			await expect(enhancedTransport.send([mockLogEntry])).rejects.toThrow('Invalid configuration')
			expect(baseTransport.send).toHaveBeenCalledTimes(1) // No retries
		})

		it('should respect maximum retry attempts', async () => {
			// Use network error which is retryable
			baseTransport.send = vi.fn().mockRejectedValue(new Error('Network error: ECONNREFUSED'))

			await expect(enhancedTransport.send([mockLogEntry])).rejects.toThrow()

			// Should have tried multiple times (exact number depends on policy)
			expect(baseTransport.send).toHaveBeenCalledTimes(3) // Default policy has 3 max attempts
		})

		it('should implement retry delay', async () => {
			const startTime = Date.now()
			// Use network error which is retryable
			baseTransport.send = vi.fn().mockRejectedValue(new Error('Network error: ECONNREFUSED'))

			await expect(enhancedTransport.send([mockLogEntry])).rejects.toThrow()

			const duration = Date.now() - startTime
			// Should have taken some time due to retry delays (default policy has 1000ms initial delay)
			expect(duration).toBeGreaterThan(500) // At least 500ms for delays
		})
	})

	describe('error handling', () => {
		it('should handle flush errors gracefully for non-critical errors', async () => {
			baseTransport.shouldFail = true

			// Should not throw for non-critical flush errors
			await expect(enhancedTransport.flush()).resolves.toBeUndefined()
		})

		it('should handle close errors gracefully', async () => {
			baseTransport.shouldFail = true

			// Should not throw for close errors
			await expect(enhancedTransport.close()).resolves.toBeUndefined()
		})

		it('should not send when shutting down', async () => {
			await enhancedTransport.close()

			await expect(enhancedTransport.send([mockLogEntry])).rejects.toThrow('shutting down')
			expect(baseTransport.sendCalls).toHaveLength(0)
		})
	})

	describe('error rate limiting', () => {
		it('should track error rates', async () => {
			baseTransport.shouldFail = true

			// Generate several errors
			for (let i = 0; i < 5; i++) {
				try {
					await enhancedTransport.send([mockLogEntry])
				} catch {
					// Expected to fail
				}
			}

			const errorRates = enhancedTransport.getErrorRates()
			expect(errorRates.size).toBeGreaterThan(0)
		})
	})

	describe('detailed health status', () => {
		it('should provide detailed health status', () => {
			const status = enhancedTransport.getDetailedHealthStatus()

			expect(status.name).toBe('enhanced_test-transport')
			expect(status.baseTransport).toBe('test-transport')
			expect(status.isHealthy).toBe(true)
			expect(status.isShuttingDown).toBe(false)
		})

		it('should reflect shutdown status', async () => {
			await enhancedTransport.close()

			const status = enhancedTransport.getDetailedHealthStatus()
			expect(status.isShuttingDown).toBe(true)
		})
	})

	describe('factory function', () => {
		it('should create enhanced transport with default config', () => {
			const enhanced = createEnhancedTransport(baseTransport, {}, errorHandler)

			expect(enhanced).toBeInstanceOf(EnhancedTransportWrapper)
			expect(enhanced.name).toBe('enhanced_test-transport')
		})

		it('should create enhanced transport with custom config', () => {
			const config = {
				enableHealthMonitoring: false,
				enableRetryPolicies: false,
				enableErrorRateLimiting: false,
				enableFallback: false,
			}

			const enhanced = createEnhancedTransport(baseTransport, config, errorHandler)

			expect(enhanced).toBeInstanceOf(EnhancedTransportWrapper)
		})

		it('should work without optional dependencies', () => {
			const enhanced = createEnhancedTransport(baseTransport, {}, errorHandler)

			// Should work even without retry manager and circuit breaker
			expect(enhanced).toBeInstanceOf(EnhancedTransportWrapper)
		})
	})

	describe('integration scenarios', () => {
		it('should handle mixed success and failure scenarios', async () => {
			let attempts = 0
			baseTransport.send = vi.fn().mockImplementation(async () => {
				attempts++
				if (attempts === 1) {
					throw new Error('Network error') // Retryable
				}
				if (attempts === 2) {
					throw new Error('Timeout error') // Retryable
				}
				// Third attempt succeeds
			})

			await enhancedTransport.send([mockLogEntry])

			expect(attempts).toBe(3)
			expect(circuitBreaker.onSuccessCalls).toBe(1)
			expect(circuitBreaker.onFailureCalls).toBe(0) // Success on final attempt
		})

		it('should handle circuit breaker opening during retries', async () => {
			let attempts = 0
			baseTransport.send = vi.fn().mockImplementation(async () => {
				attempts++
				if (attempts >= 2) {
					// Simulate circuit breaker opening
					circuitBreaker.canExecuteValue = false
				}
				throw new Error('Persistent failure')
			})

			await expect(enhancedTransport.send([mockLogEntry])).rejects.toThrow()
			expect(circuitBreaker.onFailureCalls).toBeGreaterThan(0)
		})

		it('should handle rate limiting during retries', async () => {
			// Create transport with very low rate limit
			const lowLimitConfig = {
				enableHealthMonitoring: false,
				enableRetryPolicies: true,
				enableErrorRateLimiting: true,
				enableFallback: false,
				maxErrorsPerMinute: 1, // Very low limit
			}

			const rateLimitedTransport = new EnhancedTransportWrapper(
				baseTransport,
				lowLimitConfig,
				errorHandler,
				retryManager,
				circuitBreaker
			)

			baseTransport.shouldFail = true

			// First error should be processed
			try {
				await rateLimitedTransport.send([mockLogEntry])
			} catch {
				// Expected
			}

			// Subsequent errors should be rate limited (fewer retries)
			const startCalls = baseTransport.sendCalls.length
			try {
				await rateLimitedTransport.send([mockLogEntry])
			} catch {
				// Expected
			}

			// Should have made fewer calls due to rate limiting
			const endCalls = baseTransport.sendCalls.length
			expect(endCalls - startCalls).toBeLessThanOrEqual(1)
		})
	})
})
