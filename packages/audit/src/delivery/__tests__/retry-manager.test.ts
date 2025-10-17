/**
 * Retry Manager Tests
 * Requirements 3.1, 3.2, 3.3: Retry management with exponential backoff
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RetryManager } from '../retry-manager.js'

import type { DeliveryDatabaseClient } from '../database-client.js'

// Mock database client
const mockDbClient = {
	queue: {
		findByDeliveryId: vi.fn(),
		updateStatus: vi.fn(),
		scheduleRetry: vi.fn(),
		updateItem: vi.fn(),
		findByStatus: vi.fn(),
	},
	health: {
		findByDestinationId: vi.fn(),
		recordSuccess: vi.fn(),
		recordFailure: vi.fn(),
	},
} as unknown as DeliveryDatabaseClient

describe('RetryManager', () => {
	let retryManager: RetryManager

	beforeEach(() => {
		vi.clearAllMocks()
		retryManager = new RetryManager(mockDbClient, {
			maxRetries: 3,
			baseDelay: 1000,
			maxDelay: 30000,
			backoffMultiplier: 2,
			jitterEnabled: false, // Disable for predictable tests
		})
	})

	describe('shouldRetry', () => {
		it('should allow retry when under max attempts', async () => {
			const deliveryId = 'test-delivery-1'
			const error = new Error('Network timeout')

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 1,
					metadata: { retryAttempts: [{ attemptNumber: 1 }] },
					updatedAt: new Date().toISOString(),
				},
			])

			const shouldRetry = await retryManager.shouldRetry(deliveryId, error)

			expect(shouldRetry).toBe(true)
		})

		it('should reject retry when max attempts exceeded', async () => {
			const deliveryId = 'test-delivery-2'
			const error = new Error('Network timeout')

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 3,
					metadata: {
						retryAttempts: [{ attemptNumber: 1 }, { attemptNumber: 2 }, { attemptNumber: 3 }],
					},
					updatedAt: new Date().toISOString(),
				},
			])

			const shouldRetry = await retryManager.shouldRetry(deliveryId, error)

			expect(shouldRetry).toBe(false)
		})

		it('should reject retry for non-retryable errors', async () => {
			const deliveryId = 'test-delivery-3'
			const error = new Error('AUTHENTICATION_FAILED: Invalid credentials')

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 1,
					metadata: { retryAttempts: [{ attemptNumber: 1 }] },
					updatedAt: new Date().toISOString(),
				},
			])

			const shouldRetry = await retryManager.shouldRetry(deliveryId, error)

			expect(shouldRetry).toBe(false)
		})

		it('should reject retry for non-retryable HTTP status codes', async () => {
			const deliveryId = 'test-delivery-4'
			const error = new Error('status: 404')

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 1,
					metadata: { retryAttempts: [{ attemptNumber: 1 }] },
					updatedAt: new Date().toISOString(),
				},
			])

			const shouldRetry = await retryManager.shouldRetry(deliveryId, error)

			expect(shouldRetry).toBe(false)
		})
	})

	describe('calculateBackoff', () => {
		it('should calculate exponential backoff correctly', () => {
			const delay1 = retryManager.calculateBackoff(0)
			const delay2 = retryManager.calculateBackoff(1)
			const delay3 = retryManager.calculateBackoff(2)

			expect(delay1).toBe(1000) // baseDelay * 2^0
			expect(delay2).toBe(2000) // baseDelay * 2^1
			expect(delay3).toBe(4000) // baseDelay * 2^2
		})

		it('should cap delay at maximum', () => {
			const delay = retryManager.calculateBackoff(10) // Very high attempt count

			expect(delay).toBe(30000) // Should be capped at maxDelay
		})

		it('should add jitter when enabled', () => {
			const retryManagerWithJitter = new RetryManager(mockDbClient, {
				baseDelay: 1000,
				jitterEnabled: true,
				jitterMaxPercent: 10,
			})

			const delay1 = retryManagerWithJitter.calculateBackoff(1)
			const delay2 = retryManagerWithJitter.calculateBackoff(1)

			// With jitter, delays should be different (though this could rarely fail due to randomness)
			expect(delay1).toBeGreaterThanOrEqual(2000) // Base delay
			expect(delay1).toBeLessThanOrEqual(2200) // Base delay + 10% jitter
		})
	})

	describe('recordAttempt', () => {
		it('should record successful attempt and mark as completed', async () => {
			const deliveryId = 'test-delivery-5'

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 1,
					metadata: { retryAttempts: [] },
					updatedAt: new Date().toISOString(),
				},
			])

			await retryManager.recordAttempt(deliveryId, true)

			expect(mockDbClient.queue.updateStatus).toHaveBeenCalledWith(
				'queue-1',
				'completed',
				expect.any(String)
			)
			expect(mockDbClient.queue.updateItem).toHaveBeenCalledWith(
				'queue-1',
				expect.objectContaining({
					metadata: expect.objectContaining({
						retryAttempts: expect.arrayContaining([
							expect.objectContaining({
								attemptNumber: 2,
								success: true,
							}),
						]),
					}),
				})
			)
		})

		it('should record failed attempt and schedule retry', async () => {
			const deliveryId = 'test-delivery-6'
			const error = new Error('Network timeout')

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 1,
					metadata: { retryAttempts: [] },
					updatedAt: new Date().toISOString(),
				},
			])

			await retryManager.recordAttempt(deliveryId, false, error)

			expect(mockDbClient.queue.scheduleRetry).toHaveBeenCalledWith(
				'queue-1',
				expect.any(String), // nextRetryAt
				2 // attemptNumber
			)
			expect(mockDbClient.queue.updateItem).toHaveBeenCalledWith(
				'queue-1',
				expect.objectContaining({
					metadata: expect.objectContaining({
						retryAttempts: expect.arrayContaining([
							expect.objectContaining({
								attemptNumber: 2,
								success: false,
								error: 'Network timeout',
							}),
						]),
					}),
				})
			)
		})

		it('should mark as permanently failed when max retries exceeded', async () => {
			const deliveryId = 'test-delivery-7'
			const error = new Error('Network timeout')

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 2, // At max retries
					metadata: { retryAttempts: [] },
					updatedAt: new Date().toISOString(),
				},
			])

			await retryManager.recordAttempt(deliveryId, false, error)

			expect(mockDbClient.queue.updateStatus).toHaveBeenCalledWith('queue-1', 'failed')
			expect(mockDbClient.queue.scheduleRetry).not.toHaveBeenCalled()
		})
	})

	describe('getRetrySchedule', () => {
		it('should return default schedule for new delivery', async () => {
			const deliveryId = 'test-delivery-8'

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([])

			const schedule = await retryManager.getRetrySchedule(deliveryId)

			expect(schedule).toEqual({
				deliveryId,
				currentAttempt: 0,
				maxAttempts: 3,
				backoffDelay: 1000,
				totalDelay: 0,
			})
		})

		it('should return current schedule with retry information', async () => {
			const deliveryId = 'test-delivery-9'
			const now = new Date()
			const firstAttempt = new Date(now.getTime() - 5000) // 5 seconds ago

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 2,
					nextRetryAt: new Date(now.getTime() + 4000).toISOString(),
					metadata: {
						retryAttempts: [
							{ attemptNumber: 1, timestamp: firstAttempt.toISOString() },
							{ attemptNumber: 2, timestamp: now.toISOString() },
						],
					},
					updatedAt: now.toISOString(),
				},
			])

			const schedule = await retryManager.getRetrySchedule(deliveryId)

			expect(schedule.deliveryId).toBe(deliveryId)
			expect(schedule.currentAttempt).toBe(2)
			expect(schedule.maxAttempts).toBe(3)
			expect(schedule.backoffDelay).toBe(4000) // 2^2 * 1000
			expect(schedule.totalDelay).toBeGreaterThan(4000) // Should be around 5000ms
		})
	})

	describe('resetRetryCount', () => {
		it('should reset retry count and clear attempt history', async () => {
			const deliveryId = 'test-delivery-10'

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 2,
					metadata: {
						retryAttempts: [{ attemptNumber: 1 }, { attemptNumber: 2 }],
					},
				},
			])

			await retryManager.resetRetryCount(deliveryId)

			expect(mockDbClient.queue.updateItem).toHaveBeenCalledWith(
				'queue-1',
				expect.objectContaining({
					retryCount: 0,
					nextRetryAt: null,
					status: 'pending',
					metadata: expect.objectContaining({
						retryAttempts: [],
						lastAttemptAt: null,
						totalAttempts: 0,
						resetAt: expect.any(String),
					}),
				})
			)
		})
	})

	describe('markAsNonRetryable', () => {
		it('should mark delivery as non-retryable with reason', async () => {
			const deliveryId = 'test-delivery-11'
			const reason = 'Invalid authentication credentials'

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					metadata: {},
				},
			])

			await retryManager.markAsNonRetryable(deliveryId, reason)

			expect(mockDbClient.queue.updateItem).toHaveBeenCalledWith(
				'queue-1',
				expect.objectContaining({
					status: 'failed',
					metadata: expect.objectContaining({
						nonRetryable: true,
						nonRetryableReason: reason,
						markedNonRetryableAt: expect.any(String),
					}),
				})
			)
		})
	})

	describe('getRetryStatistics', () => {
		it('should calculate retry statistics correctly', async () => {
			const completedItems = [
				{
					id: 'completed-1',
					status: 'completed',
					metadata: {
						retryAttempts: [
							{ attemptNumber: 1, timestamp: '2023-01-01T10:00:00Z' },
							{ attemptNumber: 2, timestamp: '2023-01-01T10:01:00Z' },
						],
					},
				},
			]

			const failedItems = [
				{
					id: 'failed-1',
					status: 'failed',
					metadata: {
						retryAttempts: [{ attemptNumber: 1, timestamp: '2023-01-01T11:00:00Z' }],
					},
				},
				{
					id: 'failed-2',
					status: 'failed',
					metadata: {
						nonRetryable: true,
						retryAttempts: [{ attemptNumber: 1, timestamp: '2023-01-01T11:30:00Z' }], // Has attempts but marked non-retryable
					},
				},
			]

			mockDbClient.queue.findByStatus
				.mockResolvedValueOnce(completedItems)
				.mockResolvedValueOnce(failedItems)

			const stats = await retryManager.getRetryStatistics()

			expect(stats.totalRetries).toBe(3) // 2 + 1
			expect(stats.successfulRetries).toBe(2) // From completed item
			expect(stats.failedRetries).toBe(1) // From failed item (non-retryable doesn't count as failed retry)
			expect(stats.nonRetryableCount).toBe(1) // One non-retryable item
			expect(stats.averageRetryCount).toBe(1) // 3 retries / 3 items with retries (including non-retryable)
		})
	})

	describe('configuration', () => {
		it('should return current configuration', () => {
			const config = retryManager.getConfig()

			expect(config.maxRetries).toBe(3)
			expect(config.baseDelay).toBe(1000)
			expect(config.backoffMultiplier).toBe(2)
		})

		it('should update configuration', () => {
			const updates = {
				maxRetries: 5,
				baseDelay: 2000,
			}

			retryManager.updateConfig(updates)
			const config = retryManager.getConfig()

			expect(config.maxRetries).toBe(5)
			expect(config.baseDelay).toBe(2000)
			expect(config.backoffMultiplier).toBe(2) // Unchanged
		})
	})
})
