/**
 * Delivery Orchestration Tests
 * Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.2, 9.3, 9.4: Delivery orchestration and fanout system
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DeliveryService } from '../delivery-service.js'

import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'
import type { DeliveryDatabaseClient } from '../database-client.js'
import type { IDestinationManager } from '../destination-manager.js'
import type { HealthMonitor } from '../health-monitor.js'
import type { IDeliveryScheduler, IRetryManager } from '../interfaces.js'
import type {
	DeliveryDestination,
	DeliveryRequest,
	DeliveryResponse,
	DeliveryStatusResponse,
} from '../types.js'

// Mock dependencies
const mockEnhancedClient = {
	getDatabase: vi.fn(),
	getHealthStatus: vi.fn(),
} as unknown as EnhancedAuditDatabaseClient

const mockDbClient = {
	destinations: {
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		findById: vi.fn(),
		list: vi.fn(),
		incrementUsage: vi.fn(),
		setDisabled: vi.fn(),
	},
	logs: {
		create: vi.fn(),
		update: vi.fn(),
		findById: vi.fn(),
		findByDeliveryId: vi.fn(),
		list: vi.fn(),
		recordAttempt: vi.fn(),
		markDelivered: vi.fn(),
		markFailed: vi.fn(),
	},
	queue: {
		enqueue: vi.fn(),
		dequeue: vi.fn(),
		updateStatus: vi.fn(),
		scheduleRetry: vi.fn(),
		findById: vi.fn(),
		getQueueStats: vi.fn(),
		findByDeliveryId: vi.fn(),
		cancelByDeliveryId: vi.fn(),
	},
	health: {
		findByDestinationId: vi.fn(),
		upsert: vi.fn(),
		recordSuccess: vi.fn(),
		recordFailure: vi.fn(),
		updateCircuitBreakerState: vi.fn(),
		getUnhealthyDestinations: vi.fn(),
	},
	getDefaultDestinations: vi.fn(),
	healthCheck: vi.fn(),
} as unknown as DeliveryDatabaseClient

const mockDestinationManager = {
	createDestination: vi.fn(),
	updateDestination: vi.fn(),
	deleteDestination: vi.fn(),
	getDestination: vi.fn(),
	listDestinations: vi.fn(),
	validateDestination: vi.fn(),
	testConnection: vi.fn(),
	getDestinationHealth: vi.fn(),
	updateDestinationHealth: vi.fn(),
	disableDestination: vi.fn(),
	enableDestination: vi.fn(),
	getDefaultDestinations: vi.fn(),
	setDefaultDestination: vi.fn(),
	removeDefaultDestination: vi.fn(),
} as unknown as IDestinationManager

const mockHealthMonitor = {
	start: vi.fn(),
	stop: vi.fn(),
	getDestinationHealth: vi.fn(),
	getUnhealthyDestinations: vi.fn(),
	shouldAllowDelivery: vi.fn(),
	recordSuccess: vi.fn(),
	recordFailure: vi.fn(),
	updateCircuitBreakerState: vi.fn(),
} as unknown as HealthMonitor

const mockDeliveryScheduler = {
	scheduleDelivery: vi.fn(),
	scheduleRetry: vi.fn(),
	processDeliveryQueue: vi.fn(),
	getQueueStatus: vi.fn(),
	cancelDelivery: vi.fn(),
	pauseQueue: vi.fn(),
	resumeQueue: vi.fn(),
} as unknown as IDeliveryScheduler

const mockRetryManager = {
	shouldRetry: vi.fn(),
	calculateBackoff: vi.fn(),
	recordAttempt: vi.fn(),
	getRetrySchedule: vi.fn(),
	resetRetryCount: vi.fn(),
	markAsNonRetryable: vi.fn(),
} as unknown as IRetryManager

// Mock factory functions
vi.mock('../database-client.js', () => ({
	createDeliveryDatabaseClient: vi.fn(() => mockDbClient),
}))

vi.mock('../destination-manager.js', () => ({
	createDestinationManager: vi.fn(() => mockDestinationManager),
}))

vi.mock('../health-monitor.js', () => ({
	createHealthMonitor: vi.fn(() => mockHealthMonitor),
}))

vi.mock('../delivery-scheduler.js', () => ({
	createDeliveryScheduler: vi.fn(() => mockDeliveryScheduler),
}))

vi.mock('../retry-manager.js', () => ({
	createRetryManager: vi.fn(() => mockRetryManager),
}))

describe('DeliveryService - Orchestration', () => {
	let deliveryService: DeliveryService

	const sampleDestination: DeliveryDestination = {
		id: '1',
		organizationId: 'org1',
		type: 'webhook',
		label: 'Test Webhook',
		description: 'Test webhook destination',
		disabled: false,
		countUsage: 0,
		config: {
			webhook: {
				url: 'https://example.com/webhook',
				method: 'POST',
				headers: {},
				timeout: 30000,
				retryConfig: {
					maxRetries: 3,
					backoffMultiplier: 2,
					maxBackoffDelay: 60000,
				},
			},
		},
		createdAt: '2023-01-01T00:00:00Z',
		updatedAt: '2023-01-01T00:00:00Z',
	}

	const sampleDeliveryRequest: DeliveryRequest = {
		organizationId: 'org1',
		destinations: ['1'],
		payload: {
			type: 'report',
			data: { reportId: 'report123', content: 'Sample report data' },
			metadata: { source: 'test' },
		},
		options: {
			priority: 5,
			correlationId: 'corr123',
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup default mock responses
		mockDestinationManager.getDestination.mockResolvedValue(sampleDestination)
		mockDestinationManager.getDefaultDestinations.mockResolvedValue([sampleDestination])
		mockHealthMonitor.shouldAllowDelivery.mockResolvedValue(true)
		mockDeliveryScheduler.scheduleDelivery.mockResolvedValue('delivery123')
		mockDbClient.destinations.incrementUsage.mockResolvedValue(undefined)
		mockDbClient.logs.findByDeliveryId.mockResolvedValue([])
		mockHealthMonitor.getDestinationHealth.mockResolvedValue({
			destinationId: '1',
			status: 'healthy',
			lastCheckAt: '2023-01-01T00:00:00Z',
			consecutiveFailures: 0,
			totalFailures: 0,
			totalDeliveries: 10,
			successRate: '100.00',
			circuitBreakerState: 'closed',
			metadata: {},
		})

		deliveryService = new DeliveryService(mockEnhancedClient)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('deliver', () => {
		it('should successfully orchestrate delivery to single destination', async () => {
			// Act
			const result = await deliveryService.deliver(sampleDeliveryRequest)

			// Assert
			expect(result).toMatchObject({
				deliveryId: expect.stringMatching(/^del_\d+_/),
				status: 'queued',
				destinations: [
					{
						destinationId: '1',
						status: 'pending',
					},
				],
				queuedAt: expect.any(String),
			})

			expect(mockDestinationManager.getDestination).toHaveBeenCalledWith('1')
			expect(mockHealthMonitor.shouldAllowDelivery).toHaveBeenCalledWith('1')
			expect(mockDeliveryScheduler.scheduleDelivery).toHaveBeenCalled()
			expect(mockDbClient.destinations.incrementUsage).toHaveBeenCalledWith('1')
		})

		it('should handle multi-destination fanout delivery', async () => {
			// Arrange
			const multiDestinationRequest: DeliveryRequest = {
				...sampleDeliveryRequest,
				destinations: ['1', '2'],
			}

			const destination2: DeliveryDestination = {
				...sampleDestination,
				id: '2',
				label: 'Test Email',
				type: 'email',
			}

			mockDestinationManager.getDestination
				.mockResolvedValueOnce(sampleDestination)
				.mockResolvedValueOnce(destination2)

			// Act
			const result = await deliveryService.deliver(multiDestinationRequest)

			// Assert
			expect(result.destinations).toHaveLength(2)
			expect(result.destinations).toEqual(
				expect.arrayContaining([
					{ destinationId: '1', status: 'pending' },
					{ destinationId: '2', status: 'pending' },
				])
			)

			expect(mockDestinationManager.getDestination).toHaveBeenCalledTimes(2)
			expect(mockHealthMonitor.shouldAllowDelivery).toHaveBeenCalledTimes(2)
			expect(mockDbClient.destinations.incrementUsage).toHaveBeenCalledTimes(2)
		})

		it('should use default destinations when specified', async () => {
			// Arrange
			const defaultDestinationRequest: DeliveryRequest = {
				...sampleDeliveryRequest,
				destinations: 'default',
			}

			// Act
			const result = await deliveryService.deliver(defaultDestinationRequest)

			// Assert
			expect(result.status).toBe('queued')
			expect(result.destinations).toHaveLength(1)
			expect(mockDestinationManager.getDefaultDestinations).toHaveBeenCalledWith('org1')
		})

		it('should skip unhealthy destinations', async () => {
			// Arrange
			mockHealthMonitor.shouldAllowDelivery.mockResolvedValue(false)

			// Act
			const result = await deliveryService.deliver(sampleDeliveryRequest)

			// Assert
			expect(result.status).toBe('failed')
			expect(result.destinations).toHaveLength(1)
			expect(result.destinations[0].status).toBe('failed')
			expect(mockDeliveryScheduler.scheduleDelivery).not.toHaveBeenCalled()
		})

		it('should handle cross-organization access denial', async () => {
			// Arrange
			const crossOrgDestination: DeliveryDestination = {
				...sampleDestination,
				organizationId: 'org2', // Different organization
			}
			mockDestinationManager.getDestination.mockResolvedValue(crossOrgDestination)

			// Act
			const result = await deliveryService.deliver(sampleDeliveryRequest)

			// Assert
			expect(result.status).toBe('failed')
			expect(mockDeliveryScheduler.scheduleDelivery).not.toHaveBeenCalled()
		})

		it('should skip disabled destinations', async () => {
			// Arrange
			const disabledDestination: DeliveryDestination = {
				...sampleDestination,
				disabled: true,
			}
			mockDestinationManager.getDestination.mockResolvedValue(disabledDestination)

			// Act
			const result = await deliveryService.deliver(sampleDeliveryRequest)

			// Assert
			expect(result.status).toBe('failed')
			expect(mockDeliveryScheduler.scheduleDelivery).not.toHaveBeenCalled()
		})

		it('should validate delivery request', async () => {
			// Arrange
			const invalidRequest: DeliveryRequest = {
				organizationId: '',
				destinations: [],
				payload: {
					type: 'report',
					data: null,
					metadata: {},
				},
			}

			// Act
			const result = await deliveryService.deliver(invalidRequest)

			// Assert
			expect(result.status).toBe('failed')
			expect(result.destinations).toHaveLength(0)
		})

		it('should generate unique delivery and idempotency keys', async () => {
			// Act
			const result1 = await deliveryService.deliver(sampleDeliveryRequest)
			const result2 = await deliveryService.deliver(sampleDeliveryRequest)

			// Assert
			expect(result1.deliveryId).not.toBe(result2.deliveryId)
			expect(result1.deliveryId).toMatch(/^del_\d+_/)
			expect(result2.deliveryId).toMatch(/^del_\d+_/)
		})
	})

	describe('retryDelivery', () => {
		const sampleDeliveryStatus: DeliveryStatusResponse = {
			deliveryId: 'delivery123',
			status: 'failed',
			destinations: [
				{
					destinationId: '1',
					status: 'failed',
					attempts: 2,
					failureReason: 'Connection timeout',
				},
			],
			createdAt: '2023-01-01T00:00:00Z',
			updatedAt: '2023-01-01T00:00:00Z',
			metadata: {},
		}

		it('should retry failed deliveries', async () => {
			// Arrange
			mockDbClient.logs.findByDeliveryId.mockResolvedValue([
				{
					deliveryId: 'delivery123',
					status: 'failed',
					destinations: sampleDeliveryStatus.destinations,
					createdAt: '2023-01-01T00:00:00Z',
					updatedAt: '2023-01-01T00:00:00Z',
					metadata: {},
				},
			])
			mockRetryManager.shouldRetry.mockResolvedValue(true)
			mockRetryManager.calculateBackoff.mockReturnValue(2000)

			// Act
			const result = await deliveryService.retryDelivery('delivery123')

			// Assert
			expect(result.status).toBe('queued')
			expect(result.destinations[0].status).toBe('pending')
			expect(mockRetryManager.shouldRetry).toHaveBeenCalled()
			expect(mockDeliveryScheduler.scheduleRetry).toHaveBeenCalledWith('delivery123', 2000)
		})

		it('should not retry when max retries exceeded', async () => {
			// Arrange
			mockDbClient.logs.findByDeliveryId.mockResolvedValue([
				{
					deliveryId: 'delivery123',
					status: 'failed',
					destinations: sampleDeliveryStatus.destinations,
					createdAt: '2023-01-01T00:00:00Z',
					updatedAt: '2023-01-01T00:00:00Z',
					metadata: {},
				},
			])
			mockRetryManager.shouldRetry.mockResolvedValue(false)

			// Act
			const result = await deliveryService.retryDelivery('delivery123')

			// Assert
			expect(result.status).toBe('failed')
			expect(mockDeliveryScheduler.scheduleRetry).not.toHaveBeenCalled()
		})

		it('should handle non-existent delivery', async () => {
			// Arrange
			mockDbClient.logs.findByDeliveryId.mockResolvedValue([])

			// Act & Assert
			await expect(deliveryService.retryDelivery('nonexistent')).rejects.toThrow(
				'Delivery not found: nonexistent'
			)
		})
	})

	describe('getDeliveryStatus', () => {
		it('should return delivery status with cross-system references', async () => {
			// Arrange
			const mockDeliveryLogs = [
				{
					deliveryId: 'delivery123',
					status: 'completed',
					destinations: [
						{
							destinationId: '1',
							status: 'delivered',
							attempts: 1,
							deliveredAt: '2023-01-01T01:00:00Z',
							crossSystemReference: 'ext-ref-123',
						},
					],
					createdAt: '2023-01-01T00:00:00Z',
					updatedAt: '2023-01-01T01:00:00Z',
					metadata: { source: 'test' },
				},
			]
			mockDbClient.logs.findByDeliveryId.mockResolvedValue(mockDeliveryLogs)

			// Act
			const result = await deliveryService.getDeliveryStatus('delivery123')

			// Assert
			expect(result.deliveryId).toBe('delivery123')
			expect(result.status).toBe('completed')
			expect(result.destinations).toHaveLength(1)
			expect(result.destinations[0]).toMatchObject({
				destinationId: '1',
				attempts: 1,
				crossSystemReference: 'ext-ref-123',
			})
			expect(result.metadata).toEqual({ source: 'test' })
		})

		it('should aggregate status from multiple destinations', async () => {
			// Arrange
			const mockDeliveryLogs = [
				{
					deliveryId: 'delivery123',
					status: 'processing',
					destinations: [
						{ destinationId: '1', status: 'delivered' },
						{ destinationId: '2', status: 'processing' },
					],
					createdAt: '2023-01-01T00:00:00Z',
					updatedAt: '2023-01-01T00:30:00Z',
					metadata: {},
				},
			]
			mockDbClient.logs.findByDeliveryId.mockResolvedValue(mockDeliveryLogs)

			// Act
			const result = await deliveryService.getDeliveryStatus('delivery123')

			// Assert
			expect(result.status).toBe('processing')
		})

		it('should handle non-existent delivery', async () => {
			// Arrange
			mockDbClient.logs.findByDeliveryId.mockResolvedValue([])

			// Act & Assert
			await expect(deliveryService.getDeliveryStatus('nonexistent')).rejects.toThrow(
				'Delivery not found: nonexistent'
			)
		})
	})

	describe('listDeliveries', () => {
		it('should list deliveries with filtering and pagination', async () => {
			// Arrange
			const mockDeliveryList = {
				deliveries: [
					{
						deliveryId: 'delivery1',
						status: 'completed' as const,
						destinations: [],
						createdAt: '2023-01-01T00:00:00Z',
						updatedAt: '2023-01-01T01:00:00Z',
						metadata: {},
					},
				],
				totalCount: 1,
			}
			mockDbClient.logs.list.mockResolvedValue(mockDeliveryList)

			const options = {
				organizationId: 'org1',
				limit: 10,
				offset: 0,
			}

			// Act
			const result = await deliveryService.listDeliveries(options)

			// Assert
			expect(result).toEqual(mockDeliveryList)
			expect(mockDbClient.logs.list).toHaveBeenCalledWith(options)
		})
	})

	describe('getDeliveryMetrics', () => {
		it('should return delivery metrics for monitoring', async () => {
			// Arrange
			const options = {
				organizationId: 'org1',
				startDate: '2023-01-01T00:00:00Z',
				endDate: '2023-01-02T00:00:00Z',
			}

			// Act
			const result = await deliveryService.getDeliveryMetrics(options)

			// Assert
			expect(result).toMatchObject({
				totalDeliveries: expect.any(Number),
				successfulDeliveries: expect.any(Number),
				failedDeliveries: expect.any(Number),
				successRate: expect.any(String),
				averageDeliveryTime: expect.any(Number),
				byDestinationType: expect.any(Object),
				byOrganization: expect.any(Object),
				timeRange: {
					start: expect.any(String),
					end: expect.any(String),
				},
			})
		})
	})

	describe('Default Destination Management', () => {
		it('should resolve default destinations correctly', async () => {
			// Arrange
			const defaultRequest: DeliveryRequest = {
				...sampleDeliveryRequest,
				destinations: 'default',
			}

			const defaultDestinations = [
				sampleDestination,
				{ ...sampleDestination, id: '2', type: 'email' as const },
			]
			mockDestinationManager.getDefaultDestinations.mockResolvedValue(defaultDestinations)

			// Act
			const result = await deliveryService.deliver(defaultRequest)

			// Assert
			expect(result.destinations).toHaveLength(2)
			expect(mockDestinationManager.getDefaultDestinations).toHaveBeenCalledWith('org1')
		})

		it('should fail when no default destinations are configured', async () => {
			// Arrange
			const defaultRequest: DeliveryRequest = {
				...sampleDeliveryRequest,
				destinations: 'default',
			}
			mockDestinationManager.getDefaultDestinations.mockResolvedValue([])

			// Act
			const result = await deliveryService.deliver(defaultRequest)

			// Assert
			expect(result.status).toBe('failed')
			expect(result.destinations).toHaveLength(0)
		})
	})

	describe('Organization Isolation', () => {
		it('should enforce organization isolation for destinations', async () => {
			// Arrange
			const crossOrgDestination: DeliveryDestination = {
				...sampleDestination,
				organizationId: 'org2',
			}
			mockDestinationManager.getDestination.mockResolvedValue(crossOrgDestination)

			// Act
			const result = await deliveryService.deliver(sampleDeliveryRequest)

			// Assert
			expect(result.status).toBe('failed')
			expect(result.destinations).toHaveLength(0)
		})

		it('should only return deliveries for the requesting organization', async () => {
			// Arrange
			const options = {
				organizationId: 'org1',
			}

			// Act
			await deliveryService.listDeliveries(options)

			// Assert
			expect(mockDbClient.logs.list).toHaveBeenCalledWith(
				expect.objectContaining({
					organizationId: 'org1',
				})
			)
		})
	})

	describe('Error Handling', () => {
		it('should handle delivery scheduler errors gracefully', async () => {
			// Arrange
			mockDeliveryScheduler.scheduleDelivery.mockRejectedValue(new Error('Scheduler error'))

			// Act
			const result = await deliveryService.deliver(sampleDeliveryRequest)

			// Assert
			expect(result.status).toBe('failed') // Should be failed when all destinations fail
			expect(result.destinations).toHaveLength(1)
			expect(result.destinations[0].status).toBe('failed')
		})

		it('should handle database errors in status tracking', async () => {
			// Arrange
			mockDbClient.logs.findByDeliveryId.mockRejectedValue(new Error('Database error'))

			// Act & Assert
			await expect(deliveryService.getDeliveryStatus('delivery123')).rejects.toThrow(
				'Database error'
			)
		})
	})
})
