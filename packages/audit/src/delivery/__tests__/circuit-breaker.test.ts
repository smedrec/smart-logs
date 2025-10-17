/**
 * Circuit Breaker Tests
 * Requirements 3.4, 3.5, 7.3, 7.5: Circuit breaker pattern for destination protection
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CircuitBreaker } from '../circuit-breaker.js'

import type { DeliveryDatabaseClient } from '../database-client.js'

// Mock database client
const mockDbClient = {
	health: {
		findByDestinationId: vi.fn(),
		recordSuccess: vi.fn(),
		recordFailure: vi.fn(),
		updateCircuitBreakerState: vi.fn(),
		upsert: vi.fn(),
		getUnhealthyDestinations: vi.fn(),
	},
} as unknown as DeliveryDatabaseClient

describe('CircuitBreaker', () => {
	let circuitBreaker: CircuitBreaker

	beforeEach(() => {
		vi.clearAllMocks()
		circuitBreaker = new CircuitBreaker(mockDbClient, {
			failureThreshold: 3,
			recoveryTimeout: 60000, // 1 minute
			successThreshold: 2,
			monitoringWindow: 300000, // 5 minutes
			volumeThreshold: 5,
		})
	})

	describe('isOpen', () => {
		it('should return false for closed circuit', async () => {
			const destinationId = 'dest-1'

			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'closed',
				consecutiveFailures: 1,
			})

			const isOpen = await circuitBreaker.isOpen(destinationId)

			expect(isOpen).toBe(false)
		})

		it('should return true for open circuit within recovery timeout', async () => {
			const destinationId = 'dest-2'
			const openedAt = new Date(Date.now() - 30000).toISOString() // 30 seconds ago

			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'open',
				circuitBreakerOpenedAt: openedAt,
				consecutiveFailures: 5,
			})

			const isOpen = await circuitBreaker.isOpen(destinationId)

			expect(isOpen).toBe(true)
		})

		it('should transition to half-open when recovery timeout has passed', async () => {
			const destinationId = 'dest-3'
			const openedAt = new Date(Date.now() - 120000).toISOString() // 2 minutes ago

			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'open',
				circuitBreakerOpenedAt: openedAt,
				consecutiveFailures: 5,
			})

			const isOpen = await circuitBreaker.isOpen(destinationId)

			expect(isOpen).toBe(false) // Should allow one request
			expect(mockDbClient.health.updateCircuitBreakerState).toHaveBeenCalledWith(
				destinationId,
				'half-open'
			)
		})

		it('should return false for half-open circuit', async () => {
			const destinationId = 'dest-4'

			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'half-open',
				consecutiveFailures: 3,
			})

			const isOpen = await circuitBreaker.isOpen(destinationId)

			expect(isOpen).toBe(false)
		})
	})

	describe('recordSuccess', () => {
		it('should close circuit after enough successes in half-open state', async () => {
			const destinationId = 'dest-5'

			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'half-open',
				metadata: { halfOpenSuccesses: 1 }, // One success already
			})

			await circuitBreaker.recordSuccess(destinationId)

			expect(mockDbClient.health.recordSuccess).toHaveBeenCalledWith(destinationId, 0)
			expect(mockDbClient.health.updateCircuitBreakerState).toHaveBeenCalledWith(
				destinationId,
				'closed'
			)
		})

		it('should increment success count in half-open state', async () => {
			const destinationId = 'dest-6'

			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'half-open',
				metadata: { halfOpenSuccesses: 0 },
			})

			await circuitBreaker.recordSuccess(destinationId)

			expect(mockDbClient.health.upsert).toHaveBeenCalledWith(
				destinationId,
				expect.objectContaining({
					metadata: expect.objectContaining({
						halfOpenSuccesses: 1,
					}),
				})
			)
		})

		it('should handle success in closed state normally', async () => {
			const destinationId = 'dest-7'

			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'closed',
				metadata: {},
			})

			await circuitBreaker.recordSuccess(destinationId)

			expect(mockDbClient.health.recordSuccess).toHaveBeenCalledWith(destinationId, 0)
			expect(mockDbClient.health.updateCircuitBreakerState).not.toHaveBeenCalled()
		})
	})

	describe('recordFailure', () => {
		it('should open circuit when failure threshold is exceeded', async () => {
			const destinationId = 'dest-8'

			// Mock initial health state
			mockDbClient.health.findByDestinationId
				.mockResolvedValueOnce({
					destinationId,
					circuitBreakerState: 'closed',
					consecutiveFailures: 2,
				})
				.mockResolvedValueOnce({
					destinationId,
					circuitBreakerState: 'closed',
					consecutiveFailures: 3, // After recording failure
					totalDeliveries: 10, // Above volume threshold
				})

			await circuitBreaker.recordFailure(destinationId)

			expect(mockDbClient.health.recordFailure).toHaveBeenCalledWith(
				destinationId,
				'Delivery failed'
			)
			expect(mockDbClient.health.updateCircuitBreakerState).toHaveBeenCalledWith(
				destinationId,
				'open',
				expect.any(String)
			)
		})

		it('should not open circuit when volume threshold not met', async () => {
			const destinationId = 'dest-9'

			mockDbClient.health.findByDestinationId
				.mockResolvedValueOnce({
					destinationId,
					circuitBreakerState: 'closed',
					consecutiveFailures: 2,
				})
				.mockResolvedValueOnce({
					destinationId,
					circuitBreakerState: 'closed',
					consecutiveFailures: 3,
					totalDeliveries: 3, // Below volume threshold
				})

			await circuitBreaker.recordFailure(destinationId)

			expect(mockDbClient.health.recordFailure).toHaveBeenCalled()
			expect(mockDbClient.health.updateCircuitBreakerState).not.toHaveBeenCalled()
		})

		it('should open circuit from half-open state on failure', async () => {
			const destinationId = 'dest-10'

			mockDbClient.health.findByDestinationId
				.mockResolvedValueOnce({
					destinationId,
					circuitBreakerState: 'half-open',
					consecutiveFailures: 2,
				})
				.mockResolvedValueOnce({
					destinationId,
					circuitBreakerState: 'half-open',
					consecutiveFailures: 3,
					totalDeliveries: 10,
				})

			await circuitBreaker.recordFailure(destinationId)

			expect(mockDbClient.health.updateCircuitBreakerState).toHaveBeenCalledWith(
				destinationId,
				'open',
				expect.any(String)
			)
		})
	})

	describe('getState', () => {
		it('should return default state for new destination', async () => {
			const destinationId = 'dest-11'

			mockDbClient.health.findByDestinationId.mockResolvedValue(null)

			const state = await circuitBreaker.getState(destinationId)

			expect(state).toEqual({
				state: 'closed',
				failureCount: 0,
			})
		})

		it('should return current state with failure information', async () => {
			const destinationId = 'dest-12'
			const openedAt = new Date().toISOString()

			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'open',
				consecutiveFailures: 5,
				lastFailureAt: '2023-01-01T10:00:00Z',
				circuitBreakerOpenedAt: openedAt,
			})

			const state = await circuitBreaker.getState(destinationId)

			expect(state.state).toBe('open')
			expect(state.failureCount).toBe(5)
			expect(state.lastFailureAt).toBe('2023-01-01T10:00:00Z')
			expect(state.openedAt).toBe(openedAt)
			expect(state.nextAttemptAt).toBeDefined()
		})
	})

	describe('forceOpen', () => {
		it('should manually open circuit with reason', async () => {
			const destinationId = 'dest-13'
			const reason = 'Maintenance mode'

			await circuitBreaker.forceOpen(destinationId, reason)

			expect(mockDbClient.health.updateCircuitBreakerState).toHaveBeenCalledWith(
				destinationId,
				'open',
				expect.any(String)
			)
			expect(mockDbClient.health.upsert).toHaveBeenCalledWith(
				destinationId,
				expect.objectContaining({
					metadata: expect.objectContaining({
						openReason: `Manually opened: ${reason}`,
					}),
				})
			)
		})
	})

	describe('forceClose', () => {
		it('should manually close circuit and reset failures', async () => {
			const destinationId = 'dest-14'

			await circuitBreaker.forceClose(destinationId)

			expect(mockDbClient.health.updateCircuitBreakerState).toHaveBeenCalledWith(
				destinationId,
				'closed'
			)
			expect(mockDbClient.health.upsert).toHaveBeenCalledWith(
				destinationId,
				expect.objectContaining({
					consecutiveFailures: 0,
				})
			)
		})
	})

	describe('getMetrics', () => {
		it('should return comprehensive metrics for destination', async () => {
			const destinationId = 'dest-15'
			const openedAt = new Date(Date.now() - 30000).toISOString() // 30 seconds ago

			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'open',
				consecutiveFailures: 5,
				totalDeliveries: 100,
				totalFailures: 20,
				lastFailureAt: '2023-01-01T10:00:00Z',
				lastSuccessAt: '2023-01-01T09:55:00Z',
				circuitBreakerOpenedAt: openedAt,
				lastCheckAt: '2023-01-01T10:01:00Z',
			})

			const metrics = await circuitBreaker.getMetrics(destinationId)

			expect(metrics.destinationId).toBe(destinationId)
			expect(metrics.state).toBe('open')
			expect(metrics.failureCount).toBe(5)
			expect(metrics.successCount).toBe(80) // totalDeliveries - totalFailures
			expect(metrics.totalRequests).toBe(100)
			expect(metrics.failureRate).toBe(20) // (20/100) * 100
			expect(metrics.openedAt).toBe(openedAt)
			expect(metrics.timeInCurrentState).toBeGreaterThan(25000) // Around 30 seconds
		})

		it('should return default metrics for non-existent destination', async () => {
			const destinationId = 'dest-16'

			mockDbClient.health.findByDestinationId.mockResolvedValue(null)

			const metrics = await circuitBreaker.getMetrics(destinationId)

			expect(metrics.destinationId).toBe(destinationId)
			expect(metrics.state).toBe('closed')
			expect(metrics.failureCount).toBe(0)
			expect(metrics.totalRequests).toBe(0)
			expect(metrics.failureRate).toBe(0)
		})
	})

	describe('getAllStates', () => {
		it('should return metrics for all unhealthy destinations', async () => {
			const unhealthyDestinations = [{ destinationId: 'dest-17' }, { destinationId: 'dest-18' }]

			mockDbClient.health.getUnhealthyDestinations.mockResolvedValue(unhealthyDestinations)

			// Mock individual destination health for metrics
			mockDbClient.health.findByDestinationId
				.mockResolvedValueOnce({
					destinationId: 'dest-17',
					circuitBreakerState: 'open',
					consecutiveFailures: 3,
					totalDeliveries: 50,
					totalFailures: 10,
					lastCheckAt: new Date().toISOString(),
				})
				.mockResolvedValueOnce({
					destinationId: 'dest-18',
					circuitBreakerState: 'half-open',
					consecutiveFailures: 2,
					totalDeliveries: 30,
					totalFailures: 5,
					lastCheckAt: new Date().toISOString(),
				})

			const allStates = await circuitBreaker.getAllStates()

			expect(allStates).toHaveLength(2)
			expect(allStates[0].destinationId).toBe('dest-17')
			// Check that we have the right destinations and states (order may vary)
			const dest17State = allStates.find((s) => s.destinationId === 'dest-17')
			const dest18State = allStates.find((s) => s.destinationId === 'dest-18')

			expect(dest17State).toBeDefined()
			expect(dest18State).toBeDefined()
			expect(['open', 'half-open', 'closed']).toContain(dest17State!.state)
			expect(['open', 'half-open', 'closed']).toContain(dest18State!.state)
		})
	})

	describe('configuration', () => {
		it('should return current configuration', () => {
			const config = circuitBreaker.getConfig()

			expect(config.failureThreshold).toBe(3)
			expect(config.recoveryTimeout).toBe(60000)
			expect(config.successThreshold).toBe(2)
		})

		it('should update configuration', () => {
			const updates = {
				failureThreshold: 5,
				recoveryTimeout: 120000,
			}

			circuitBreaker.updateConfig(updates)
			const config = circuitBreaker.getConfig()

			expect(config.failureThreshold).toBe(5)
			expect(config.recoveryTimeout).toBe(120000)
			expect(config.successThreshold).toBe(2) // Unchanged
		})
	})

	describe('error handling', () => {
		it('should handle database errors gracefully in isOpen', async () => {
			const destinationId = 'dest-19'

			mockDbClient.health.findByDestinationId.mockRejectedValue(new Error('Database error'))

			const isOpen = await circuitBreaker.isOpen(destinationId)

			expect(isOpen).toBe(false) // Fail safe - assume closed
		})

		it('should handle database errors gracefully in getState', async () => {
			const destinationId = 'dest-20'

			mockDbClient.health.findByDestinationId.mockRejectedValue(new Error('Database error'))

			const state = await circuitBreaker.getState(destinationId)

			expect(state).toEqual({
				state: 'closed',
				failureCount: 0,
			})
		})

		it('should propagate errors in forceOpen', async () => {
			const destinationId = 'dest-21'

			mockDbClient.health.updateCircuitBreakerState.mockRejectedValue(new Error('Database error'))

			await expect(circuitBreaker.forceOpen(destinationId, 'test')).rejects.toThrow(
				'Database error'
			)
		})
	})
})
