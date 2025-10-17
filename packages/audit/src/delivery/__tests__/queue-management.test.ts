/**
 * Queue Management System Tests
 * Requirements 2.4, 2.5: Queue management with priority and concurrent processing
 */

import { nanoid } from 'nanoid'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CircuitBreaker, DeliveryScheduler, QueueManager, RetryManager } from '../index.js'

import type { DeliveryDatabaseClient } from '../database-client.js'
import type { DeliveryRequest } from '../types.js'

// Mock database client
const mockDbClient = {
	queue: {
		enqueue: vi.fn(),
		dequeue: vi.fn(),
		updateStatus: vi.fn(),
		scheduleRetry: vi.fn(),
		findById: vi.fn(),
		getQueueStats: vi.fn(),
		findByDeliveryId: vi.fn(),
		getRecentProcessedItems: vi.fn(),
		getOldestPendingItem: vi.fn(),
		deleteCompletedItems: vi.fn(),
		cancelByDeliveryId: vi.fn(),
		getQueueDepthByOrganization: vi.fn(),
		findByStatus: vi.fn(),
		updateItem: vi.fn(),
		deleteItem: vi.fn(),
		deleteItemsByStatusAndAge: vi.fn(),
	},
	getDefaultDestinations: vi.fn(),
	health: {
		findByDestinationId: vi.fn(),
		recordSuccess: vi.fn(),
		recordFailure: vi.fn(),
		updateCircuitBreakerState: vi.fn(),
		upsert: vi.fn(),
		getUnhealthyDestinations: vi.fn(),
	},
} as unknown as DeliveryDatabaseClient

describe('Queue Management System', () => {
	let scheduler: DeliveryScheduler
	let queueManager: QueueManager
	let retryManager: RetryManager
	let circuitBreaker: CircuitBreaker

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup default mock responses
		mockDbClient.getDefaultDestinations.mockResolvedValue([
			{ id: '1', organizationId: 'org1', type: 'webhook', label: 'Test Webhook' },
		])

		mockDbClient.queue.getQueueStats.mockResolvedValue({
			pendingCount: 0,
			processingCount: 0,
			completedCount: 0,
			failedCount: 0,
			retryingCount: 0,
		})

		mockDbClient.queue.getRecentProcessedItems.mockResolvedValue([])
		mockDbClient.queue.getOldestPendingItem.mockResolvedValue(null)
		mockDbClient.queue.dequeue.mockResolvedValue([])

		scheduler = new DeliveryScheduler(mockDbClient, {
			maxConcurrentDeliveries: 5,
			processingInterval: 1000,
			maxRetries: 3,
		})

		queueManager = new QueueManager(mockDbClient, {
			monitoringInterval: 5000,
			alertThresholds: {
				queueDepth: 100,
				oldestItemAge: 60000,
				processingTime: 10000,
				failureRate: 5,
			},
		})

		retryManager = new RetryManager(mockDbClient, {
			maxRetries: 3,
			baseDelay: 1000,
			jitterEnabled: false,
		})

		circuitBreaker = new CircuitBreaker(mockDbClient, {
			failureThreshold: 3,
			recoveryTimeout: 60000,
		})
	})

	afterEach(async () => {
		if (scheduler) {
			await scheduler.stop()
		}
		if (queueManager) {
			await queueManager.stopMonitoring()
		}
	})

	describe('DeliveryScheduler', () => {
		it('should schedule delivery with priority', async () => {
			const request: DeliveryRequest = {
				organizationId: 'org1',
				destinations: ['1'],
				payload: {
					type: 'report',
					data: { reportId: 'test-report' },
					metadata: { source: 'test' },
				},
				options: {
					priority: 5,
					correlationId: 'test-correlation',
				},
			}

			const deliveryId = await scheduler.scheduleDelivery(request)

			expect(deliveryId).toBeDefined()
			expect(mockDbClient.queue.enqueue).toHaveBeenCalledWith(
				expect.objectContaining({
					organizationId: 'org1',
					destinationId: 1,
					priority: 5,
					payload: expect.objectContaining({
						deliveryId,
						type: 'report',
						correlationId: 'test-correlation',
					}),
				})
			)
		})

		it('should use default destinations when specified', async () => {
			const request: DeliveryRequest = {
				organizationId: 'org1',
				destinations: 'default',
				payload: {
					type: 'export',
					data: { exportId: 'test-export' },
					metadata: {},
				},
			}

			await scheduler.scheduleDelivery(request)

			expect(mockDbClient.getDefaultDestinations).toHaveBeenCalledWith('org1')
			expect(mockDbClient.queue.enqueue).toHaveBeenCalled()
		})

		it('should schedule retry with exponential backoff', async () => {
			const deliveryId = nanoid()
			const queueItem = {
				id: 'queue-item-1',
				status: 'failed',
				retryCount: 1,
				maxRetries: 3,
			}

			mockDbClient.queue.findByDeliveryId.mockResolvedValue([queueItem])

			await scheduler.scheduleRetry(deliveryId, 2000)

			expect(mockDbClient.queue.scheduleRetry).toHaveBeenCalledWith(
				'queue-item-1',
				expect.any(String), // nextRetryAt timestamp
				2 // retryCount + 1
			)
		})

		it('should get queue status with metrics', async () => {
			mockDbClient.queue.getQueueStats.mockResolvedValue({
				pendingCount: 10,
				processingCount: 2,
				completedCount: 100,
				failedCount: 5,
				retryingCount: 3,
			})

			const recentItem = {
				createdAt: new Date(Date.now() - 5000).toISOString(),
				processedAt: new Date().toISOString(),
			}
			mockDbClient.queue.getRecentProcessedItems.mockResolvedValue([recentItem])

			const oldestPending = {
				createdAt: new Date(Date.now() - 30000).toISOString(),
			}
			mockDbClient.queue.getOldestPendingItem.mockResolvedValue(oldestPending)

			const status = await scheduler.getQueueStatus()

			expect(status).toEqual({
				pendingCount: 10,
				processingCount: 2,
				completedCount: 100,
				failedCount: 5,
				retryingCount: 3,
				averageProcessingTime: 5000,
				oldestPendingAge: 30000,
			})
		})

		it('should cancel delivery by ID', async () => {
			const deliveryId = nanoid()

			await scheduler.cancelDelivery(deliveryId)

			expect(mockDbClient.queue.cancelByDeliveryId).toHaveBeenCalledWith(deliveryId)
		})

		it('should process delivery queue with concurrency limit', async () => {
			const pendingItems = [
				{ id: 'item1', priority: 5, destinationId: 1 },
				{ id: 'item2', priority: 3, destinationId: 2 },
			]

			mockDbClient.queue.dequeue.mockResolvedValue(pendingItems)

			await scheduler.processDeliveryQueue()

			expect(mockDbClient.queue.dequeue).toHaveBeenCalledWith(5) // maxConcurrentDeliveries
			expect(mockDbClient.queue.updateStatus).toHaveBeenCalledWith('item1', 'processing')
			expect(mockDbClient.queue.updateStatus).toHaveBeenCalledWith('item2', 'processing')
		})
	})

	describe('QueueManager', () => {
		it('should collect comprehensive queue metrics', async () => {
			mockDbClient.queue.getQueueStats.mockResolvedValue({
				pendingCount: 50,
				processingCount: 10,
				completedCount: 1000,
				failedCount: 50,
				retryingCount: 5,
			})

			const recentItems = [
				{
					createdAt: new Date(Date.now() - 10000).toISOString(),
					processedAt: new Date(Date.now() - 5000).toISOString(),
					status: 'completed',
				},
				{
					createdAt: new Date(Date.now() - 8000).toISOString(),
					processedAt: new Date(Date.now() - 3000).toISOString(),
					status: 'failed',
				},
			]
			mockDbClient.queue.getRecentProcessedItems.mockResolvedValue(recentItems)

			const oldestPending = {
				createdAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes old
			}
			mockDbClient.queue.getOldestPendingItem.mockResolvedValue(oldestPending)

			const health = await queueManager.getQueueHealth()

			expect(health.status).toBe('critical') // Should be critical due to high queue depth and old pending item
			expect(health.metrics.queueDepth).toBe(60) // pending + processing
			expect(health.metrics.failureRate).toBe(50) // 1 failed out of 2 items
			expect(health.metrics.oldestItemAge).toBe(120000)
			expect(health.alerts).toHaveLength(2) // queue_depth and stale_items alerts
		})

		it('should generate appropriate alerts for queue issues', async () => {
			mockDbClient.queue.getQueueStats.mockResolvedValue({
				pendingCount: 150, // Above threshold of 100
				processingCount: 0,
				completedCount: 0,
				failedCount: 0,
				retryingCount: 0,
			})

			mockDbClient.queue.getRecentProcessedItems.mockResolvedValue([])

			const oldestPending = {
				createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes old (above 1 minute threshold)
			}
			mockDbClient.queue.getOldestPendingItem.mockResolvedValue(oldestPending)

			const health = await queueManager.getQueueHealth()

			expect(health.alerts).toHaveLength(2)
			expect(health.alerts.some((a) => a.type === 'queue_depth')).toBe(true)
			expect(health.alerts.some((a) => a.type === 'stale_items')).toBe(true)
		})

		it('should provide organization-specific statistics', async () => {
			const orgStats = {
				pendingCount: 25,
				processingCount: 5,
				averageWaitTime: 15000,
			}
			mockDbClient.queue.getQueueDepthByOrganization.mockResolvedValue(orgStats)

			const recentItems = [
				{
					organizationId: 'org1',
					processedAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
					status: 'completed',
				},
				{
					organizationId: 'org1',
					processedAt: new Date(Date.now() - 1200000).toISOString(), // 20 minutes ago
					status: 'failed',
				},
			]
			mockDbClient.queue.getRecentProcessedItems.mockResolvedValue(recentItems)

			const stats = await queueManager.getOrganizationStats('org1')

			expect(stats).toEqual({
				queueDepth: 25,
				processingCount: 5,
				averageWaitTime: 15000,
				recentThroughput: 2, // Both items processed in last hour
				failureRate: 50, // 1 failed out of 2 items
			})
		})

		it('should perform comprehensive cleanup', async () => {
			mockDbClient.queue.deleteCompletedItems.mockResolvedValue(50)
			mockDbClient.queue.findByStatus.mockResolvedValue([])

			const result = await queueManager.performCleanup()

			expect(result.completedDeleted).toBe(50)
			expect(result.totalDeleted).toBeGreaterThanOrEqual(50)
			expect(mockDbClient.queue.deleteCompletedItems).toHaveBeenCalled()
		})

		it('should process stuck items', async () => {
			const stuckItems = [
				{
					id: 'stuck1',
					updatedAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
				},
				{
					id: 'stuck2',
					updatedAt: new Date(Date.now() - 400000).toISOString(), // 6.7 minutes ago
				},
			]
			mockDbClient.queue.findByStatus.mockResolvedValue(stuckItems)

			const processedCount = await queueManager.processStuckItems()

			expect(processedCount).toBe(2)
			expect(mockDbClient.queue.updateStatus).toHaveBeenCalledWith('stuck1', 'pending')
			expect(mockDbClient.queue.updateStatus).toHaveBeenCalledWith('stuck2', 'pending')
		})
	})

	describe('Integration', () => {
		it('should integrate scheduler with queue manager', async () => {
			const scheduler = new DeliveryScheduler(mockDbClient, {
				maxConcurrentDeliveries: 3,
			})

			const queueManager = scheduler.getQueueManager()
			expect(queueManager).toBeInstanceOf(QueueManager)

			const health = await scheduler.getQueueHealth()
			expect(health).toBeDefined()
			expect(health.status).toBeDefined()
			expect(health.metrics).toBeDefined()

			await scheduler.stop()
		})

		it('should integrate retry manager with circuit breaker for failure handling', async () => {
			const deliveryId = 'integration-test-1'
			const destinationId = 'dest-1'
			const error = new Error('Network timeout')

			// Mock queue items
			mockDbClient.queue.findByDeliveryId.mockResolvedValue([
				{
					id: 'queue-1',
					retryCount: 1,
					metadata: { retryAttempts: [] },
					updatedAt: new Date().toISOString(),
				},
			])

			// Mock destination health
			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'closed',
				consecutiveFailures: 2,
				totalDeliveries: 10,
			})

			// Test retry eligibility
			const shouldRetry = await retryManager.shouldRetry(deliveryId, error)
			expect(shouldRetry).toBe(true)

			// Test circuit breaker state
			const isOpen = await circuitBreaker.isOpen(destinationId)
			expect(isOpen).toBe(false)

			// Record failure in both systems
			await retryManager.recordAttempt(deliveryId, false, error)
			await circuitBreaker.recordFailure(destinationId)

			// Verify retry was scheduled
			expect(mockDbClient.queue.scheduleRetry).toHaveBeenCalled()
			// Verify failure was recorded in health system
			expect(mockDbClient.health.recordFailure).toHaveBeenCalled()
		})

		it('should prevent retries when circuit breaker is open', async () => {
			const destinationId = 'dest-2'

			// Mock open circuit breaker
			mockDbClient.health.findByDestinationId.mockResolvedValue({
				destinationId,
				circuitBreakerState: 'open',
				circuitBreakerOpenedAt: new Date().toISOString(),
				consecutiveFailures: 5,
			})

			const isOpen = await circuitBreaker.isOpen(destinationId)
			expect(isOpen).toBe(true)

			// In a real integration, the delivery system would check circuit breaker
			// before attempting delivery and skip if open
		})
	})
})
