import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DefaultCircuitBreaker } from '../circuit-breaker.js'

import type { CircuitBreakerConfig } from '../../types/batch.js'

describe('DefaultCircuitBreaker', () => {
	let circuitBreaker: DefaultCircuitBreaker
	let mockHealthCheck: vi.MockedFunction<() => Promise<boolean>>

	beforeEach(() => {
		mockHealthCheck = vi.fn().mockResolvedValue(true)
	})

	afterEach(() => {
		if (circuitBreaker) {
			circuitBreaker.destroy()
		}
		vi.clearAllMocks()
	})

	describe('State Transitions', () => {
		it('should start in closed state', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 3,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			expect(circuitBreaker.getState()).toBe('closed')
			expect(circuitBreaker.canExecute()).toBe(true)
		})

		it('should transition to open after failure threshold', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 2,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// First failure
			circuitBreaker.onFailure()
			expect(circuitBreaker.getState()).toBe('closed')
			expect(circuitBreaker.canExecute()).toBe(true)

			// Second failure - should open
			circuitBreaker.onFailure()
			expect(circuitBreaker.getState()).toBe('open')
			expect(circuitBreaker.canExecute()).toBe(false)
		})

		it('should transition to half-open after reset timeout', async () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 50, // Short timeout for testing
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// Trigger failure to open circuit
			circuitBreaker.onFailure()
			expect(circuitBreaker.getState()).toBe('open')

			// Wait for reset timeout
			await new Promise((resolve) => setTimeout(resolve, 60))

			// Should allow execution and transition to half-open
			expect(circuitBreaker.canExecute()).toBe(true)
			expect(circuitBreaker.getState()).toBe('half-open')
		})

		it('should transition from half-open to closed on success', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// Open the circuit
			circuitBreaker.onFailure()
			expect(circuitBreaker.getState()).toBe('open')

			// Manually transition to half-open (simulating timeout)
			circuitBreaker['transitionToHalfOpen']()
			expect(circuitBreaker.getState()).toBe('half-open')

			// Success should close the circuit
			circuitBreaker.onSuccess()
			expect(circuitBreaker.getState()).toBe('closed')
		})

		it('should transition from half-open to open on failure', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// Open the circuit
			circuitBreaker.onFailure()

			// Manually transition to half-open
			circuitBreaker['transitionToHalfOpen']()
			expect(circuitBreaker.getState()).toBe('half-open')

			// Failure should open the circuit again
			circuitBreaker.onFailure()
			expect(circuitBreaker.getState()).toBe('open')
		})
	})

	describe('Execution Control', () => {
		it('should allow execution in closed state', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 3,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			expect(circuitBreaker.canExecute()).toBe(true)
		})

		it('should block execution in open state', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			circuitBreaker.onFailure()
			expect(circuitBreaker.canExecute()).toBe(false)
		})

		it('should allow one execution in half-open state', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// Open and then transition to half-open
			circuitBreaker.onFailure()
			circuitBreaker['transitionToHalfOpen']()

			expect(circuitBreaker.canExecute()).toBe(true)
		})
	})

	describe('Metrics Tracking', () => {
		it('should track request metrics', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 3,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// Execute some operations
			circuitBreaker.canExecute()
			circuitBreaker.onSuccess()

			circuitBreaker.canExecute()
			circuitBreaker.onFailure()

			const metrics = circuitBreaker.getMetrics()

			expect(metrics.totalRequests).toBe(2)
			expect(metrics.successfulRequests).toBe(1)
			expect(metrics.failedRequests).toBe(1)
		})

		it('should calculate failure rate correctly', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 5,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// 2 successes, 3 failures = 60% failure rate
			circuitBreaker.canExecute()
			circuitBreaker.onSuccess()
			circuitBreaker.canExecute()
			circuitBreaker.onSuccess()
			circuitBreaker.canExecute()
			circuitBreaker.onFailure()
			circuitBreaker.canExecute()
			circuitBreaker.onFailure()
			circuitBreaker.canExecute()
			circuitBreaker.onFailure()

			expect(circuitBreaker.getFailureRate()).toBe(60)
		})

		it('should handle zero requests for failure rate', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 3,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			expect(circuitBreaker.getFailureRate()).toBe(0)
		})
	})

	describe('Health Monitoring', () => {
		it('should report healthy in closed state with low failure rate', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 5,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// Low failure rate (25% - 1 failure out of 4 requests)
			circuitBreaker.canExecute()
			circuitBreaker.onSuccess()
			circuitBreaker.canExecute()
			circuitBreaker.onSuccess()
			circuitBreaker.canExecute()
			circuitBreaker.onSuccess()
			circuitBreaker.canExecute()
			circuitBreaker.onFailure()

			expect(circuitBreaker.isHealthy()).toBe(true)
		})

		it('should report unhealthy with high failure rate', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 5,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// High failure rate (75%)
			circuitBreaker.canExecute()
			circuitBreaker.onSuccess()
			circuitBreaker.canExecute()
			circuitBreaker.onFailure()
			circuitBreaker.canExecute()
			circuitBreaker.onFailure()
			circuitBreaker.canExecute()
			circuitBreaker.onFailure()

			expect(circuitBreaker.isHealthy()).toBe(false)
		})

		it('should report unhealthy in open state', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			circuitBreaker.onFailure()
			expect(circuitBreaker.isHealthy()).toBe(false)
		})
	})

	describe('Health Check Integration', () => {
		it('should use health check to transition from open to half-open', async () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 10000, // Long timeout
				monitoringPeriodMs: 50, // Short monitoring period for testing
			}

			mockHealthCheck.mockResolvedValue(true)
			circuitBreaker = new DefaultCircuitBreaker(config, mockHealthCheck)

			// Open the circuit
			circuitBreaker.onFailure()
			expect(circuitBreaker.getState()).toBe('open')

			// Wait for health check to run
			await new Promise((resolve) => setTimeout(resolve, 100))

			expect(circuitBreaker.getState()).toBe('half-open')
		})

		it('should trigger failure on unhealthy service in closed state', async () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 50,
			}

			mockHealthCheck.mockResolvedValue(false)
			circuitBreaker = new DefaultCircuitBreaker(config, mockHealthCheck)

			expect(circuitBreaker.getState()).toBe('closed')

			// Wait for health check to run
			await new Promise((resolve) => setTimeout(resolve, 100))

			expect(circuitBreaker.getState()).toBe('open')
		})

		it('should handle health check errors', async () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 50,
			}

			mockHealthCheck.mockRejectedValue(new Error('Health check failed'))
			circuitBreaker = new DefaultCircuitBreaker(config, mockHealthCheck)

			expect(circuitBreaker.getState()).toBe('closed')

			// Wait for health check to run
			await new Promise((resolve) => setTimeout(resolve, 100))

			expect(circuitBreaker.getState()).toBe('open')
		})
	})

	describe('Manual Control', () => {
		it('should reset to closed state', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// Open the circuit
			circuitBreaker.onFailure()
			expect(circuitBreaker.getState()).toBe('open')

			// Reset should close it
			circuitBreaker.reset()
			expect(circuitBreaker.getState()).toBe('closed')
		})

		it('should force open state', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 5,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			expect(circuitBreaker.getState()).toBe('closed')

			circuitBreaker.forceOpen()
			expect(circuitBreaker.getState()).toBe('open')
		})
	})

	describe('Factory Methods', () => {
		it('should create circuit breaker with defaults', () => {
			circuitBreaker = DefaultCircuitBreaker.create()

			expect(circuitBreaker.getState()).toBe('closed')
			expect(circuitBreaker.isHealthy()).toBe(true)
		})

		it('should create circuit breaker with overrides', () => {
			circuitBreaker = DefaultCircuitBreaker.create({
				failureThreshold: 10,
				resetTimeoutMs: 5000,
			})

			// Test that overrides work by requiring more failures
			for (let i = 0; i < 9; i++) {
				circuitBreaker.onFailure()
			}
			expect(circuitBreaker.getState()).toBe('closed')

			circuitBreaker.onFailure() // 10th failure
			expect(circuitBreaker.getState()).toBe('open')
		})

		it('should create circuit breaker with health check', () => {
			circuitBreaker = DefaultCircuitBreaker.create({}, mockHealthCheck)

			expect(circuitBreaker.getState()).toBe('closed')
		})
	})

	describe('Resource Cleanup', () => {
		it('should cleanup health check timer on destroy', async () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 50,
			}

			circuitBreaker = new DefaultCircuitBreaker(config, mockHealthCheck)

			// Verify health check is running
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockHealthCheck).toHaveBeenCalled()

			// Destroy and verify no more calls
			mockHealthCheck.mockClear()
			circuitBreaker.destroy()

			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockHealthCheck).not.toHaveBeenCalled()
		})

		it('should handle destroy without health check', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// Should not throw
			expect(() => circuitBreaker.destroy()).not.toThrow()
		})
	})

	describe('Edge Cases', () => {
		it('should handle success in closed state', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 3,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			// Add some failures
			circuitBreaker.onFailure()
			circuitBreaker.onFailure()

			// Success should reset failure count
			circuitBreaker.onSuccess()

			// Should still be closed and require full threshold again
			circuitBreaker.onFailure()
			expect(circuitBreaker.getState()).toBe('closed')
		})

		it('should handle success in open state gracefully', () => {
			const config: CircuitBreakerConfig = {
				failureThreshold: 1,
				resetTimeoutMs: 1000,
				monitoringPeriodMs: 500,
			}

			circuitBreaker = new DefaultCircuitBreaker(config)

			circuitBreaker.onFailure()
			expect(circuitBreaker.getState()).toBe('open')

			// This shouldn't normally happen, but should be handled gracefully
			expect(() => circuitBreaker.onSuccess()).not.toThrow()
			expect(circuitBreaker.getState()).toBe('open') // Should remain open
		})
	})
})
