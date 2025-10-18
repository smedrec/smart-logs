/**
 * Delivery Scheduler - Priority-based queue management with concurrent processing
 * Requirements 2.4, 2.5: Queue management and scheduling
 */

import { nanoid } from 'nanoid'

import { StructuredLogger } from '@repo/logs'

import { createCircuitBreaker } from './circuit-breaker.js'
import { createDestinationManager } from './destination-manager.js'
import {
	DownloadHandler,
	EmailHandler,
	SftpHandler,
	StorageHandler,
	WebhookHandler,
} from './handlers/index.js'
import { QueueManager } from './queue-manager.js'
import { createRetryManager } from './retry-manager.js'

import type { CircuitBreaker } from './circuit-breaker.js'
import type { DeliveryDatabaseClient } from './database-client.js'
import type { IDestinationManager } from './destination-manager.js'
import type { IDeliveryScheduler, IDestinationHandler, IRetryManager } from './interfaces.js'
import type { QueueManagerConfig } from './queue-manager.js'
import type { RetryManager } from './retry-manager.js'
import type {
	DeliveryPayload,
	DeliveryRequest,
	DeliveryResult,
	DestinationType,
	QueueStatus,
} from './types.js'

/**
 * Configuration for the delivery scheduler
 */
export interface DeliverySchedulerConfig {
	maxConcurrentDeliveries: number
	processingInterval: number // milliseconds
	maxRetries: number
	retryBackoffMultiplier: number
	maxRetryDelay: number // milliseconds
	queueCleanupInterval: number // milliseconds
	maxCompletedAge: number // milliseconds to keep completed items
	enableMetrics: boolean
}

/**
 * Default configuration for the delivery scheduler
 */
export const DEFAULT_SCHEDULER_CONFIG: DeliverySchedulerConfig = {
	maxConcurrentDeliveries: 10,
	processingInterval: 5000, // 5 seconds
	maxRetries: 5,
	retryBackoffMultiplier: 2,
	maxRetryDelay: 300000, // 5 minutes
	queueCleanupInterval: 300000, // 5 minutes
	maxCompletedAge: 86400000, // 24 hours
	enableMetrics: true,
}

/**
 * Queue metrics for monitoring
 */
export interface QueueMetrics {
	totalQueued: number
	totalProcessed: number
	totalFailed: number
	averageProcessingTime: number
	queueDepth: number
	processingRate: number // items per minute
	lastProcessedAt?: string
	uptime: number // milliseconds
}

/**
 * Delivery scheduler implementation with priority-based processing
 */
export class DeliveryScheduler implements IDeliveryScheduler {
	private readonly logger: StructuredLogger
	private readonly config: DeliverySchedulerConfig
	private readonly queueManager: QueueManager
	private readonly destinationManager: IDestinationManager
	private readonly retryManager: IRetryManager
	private readonly circuitBreaker: CircuitBreaker
	private readonly destinationHandlers: Map<DestinationType, IDestinationHandler>
	private isRunning = false
	private processingInterval?: NodeJS.Timeout
	private cleanupInterval?: NodeJS.Timeout
	private currentlyProcessing = new Set<string>()
	private metrics: QueueMetrics
	private startTime: number

	constructor(
		private readonly dbClient: DeliveryDatabaseClient,
		config: Partial<DeliverySchedulerConfig> = {},
		queueManagerConfig?: Partial<QueueManagerConfig>
	) {
		this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config }
		this.startTime = Date.now()
		this.queueManager = new QueueManager(dbClient, queueManagerConfig)

		// Initialize delivery components
		this.destinationManager = createDestinationManager(dbClient)
		this.retryManager = createRetryManager(dbClient)
		this.circuitBreaker = createCircuitBreaker(dbClient)

		// Initialize destination handlers
		this.destinationHandlers = new Map()
		this.destinationHandlers.set('webhook', new WebhookHandler())
		this.destinationHandlers.set('email', new EmailHandler())
		this.destinationHandlers.set('storage', new StorageHandler())
		this.destinationHandlers.set('sftp', new SftpHandler())
		this.destinationHandlers.set('download', new DownloadHandler())

		this.logger = new StructuredLogger({
			service: '@repo/audit - DeliveryScheduler',
			environment: process.env.NODE_ENV || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})

		this.metrics = {
			totalQueued: 0,
			totalProcessed: 0,
			totalFailed: 0,
			averageProcessingTime: 0,
			queueDepth: 0,
			processingRate: 0,
			uptime: 0,
		}
	}

	/**
	 * Schedule a delivery request for processing
	 * Requirements 2.4: Queue management with priority support
	 */
	async scheduleDelivery(request: DeliveryRequest): Promise<string> {
		const deliveryId = nanoid()
		const scheduledAt = new Date().toISOString()
		const priority = request.options?.priority || 0

		this.logger.info('Scheduling delivery', {
			deliveryId,
			organizationId: request.organizationId,
			destinations: Array.isArray(request.destinations) ? request.destinations.length : 'default',
			priority,
		})

		try {
			// Handle default destinations
			let destinationIds: string[]
			if (request.destinations === 'default') {
				// Get default destinations for the organization
				const defaultDestinations = await this.dbClient.getDefaultDestinations(
					request.organizationId
				)
				destinationIds = defaultDestinations.map((d) => d.id)

				if (destinationIds.length === 0) {
					throw new Error(
						`No default destinations configured for organization ${request.organizationId}`
					)
				}
			} else {
				destinationIds = request.destinations
			}

			// Create queue entries for each destination
			for (const destinationId of destinationIds) {
				const queueItemId = nanoid()

				await this.dbClient.queue.enqueue({
					id: queueItemId,
					organizationId: request.organizationId,
					destinationId: parseInt(destinationId, 10),
					payload: {
						deliveryId,
						type: request.payload.type,
						data: request.payload.data,
						metadata: request.payload.metadata,
						correlationId: request.options?.correlationId,
						idempotencyKey: request.options?.idempotencyKey,
					},
					priority,
					scheduledAt,
					correlationId: request.options?.correlationId,
					idempotencyKey: request.options?.idempotencyKey,
					metadata: {
						tags: request.options?.tags || [],
						scheduledBy: 'delivery-scheduler',
						...request.payload.metadata,
					},
				})
			}

			// Update metrics
			if (this.config.enableMetrics) {
				this.metrics.totalQueued += destinationIds.length
				await this.updateQueueDepth()
			}

			this.logger.info('Delivery scheduled successfully', {
				deliveryId,
				queueItems: destinationIds.length,
			})

			return deliveryId
		} catch (error) {
			this.logger.error('Failed to schedule delivery', {
				deliveryId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Schedule a retry for a failed delivery
	 * Requirements 3.1, 3.2: Retry management with exponential backoff
	 */
	async scheduleRetry(deliveryId: string, delay: number): Promise<void> {
		this.logger.info('Scheduling delivery retry', {
			deliveryId,
			delay,
		})

		try {
			const queueItems = await this.dbClient.queue.findByDeliveryId(deliveryId)

			for (const item of queueItems) {
				if (item.status === 'failed' && item.retryCount < item.maxRetries) {
					const nextRetryAt = new Date(Date.now() + delay).toISOString()

					await this.dbClient.queue.scheduleRetry(item.id, nextRetryAt, item.retryCount + 1)
				}
			}

			this.logger.info('Delivery retry scheduled', {
				deliveryId,
				nextRetryAt: new Date(Date.now() + delay).toISOString(),
			})
		} catch (error) {
			this.logger.error('Failed to schedule retry', {
				deliveryId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Process the delivery queue with concurrent handling
	 * Requirements 2.4, 2.5: Concurrent queue processing
	 */
	async processDeliveryQueue(): Promise<void> {
		if (this.currentlyProcessing.size >= this.config.maxConcurrentDeliveries) {
			return // Already at max concurrency
		}

		try {
			// Get pending items ordered by priority and scheduled time
			const availableSlots = this.config.maxConcurrentDeliveries - this.currentlyProcessing.size
			const pendingItems = await this.dbClient.queue.dequeue(availableSlots)

			if (pendingItems.length === 0) {
				return // No items to process
			}

			this.logger.debug('Processing queue items', {
				itemCount: pendingItems.length,
				currentlyProcessing: this.currentlyProcessing.size,
			})

			// Process items concurrently
			const processingPromises = pendingItems.map((item) => this.processQueueItem(item))
			await Promise.allSettled(processingPromises)
		} catch (error) {
			this.logger.error('Error processing delivery queue', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Process a single queue item with destination handler integration
	 */
	private async processQueueItem(item: any): Promise<void> {
		const startTime = Date.now()
		this.currentlyProcessing.add(item.id)

		try {
			// Mark as processing
			await this.dbClient.queue.updateStatus(item.id, 'processing')

			this.logger.info('Processing queue item', {
				queueItemId: item.id,
				deliveryId: item.payload.deliveryId,
				destinationId: item.destinationId,
			})

			// Get destination information
			const destination = await this.destinationManager.getDestination(
				item.destinationId.toString()
			)
			if (!destination) {
				throw new Error(`Destination ${item.destinationId} not found`)
			}

			// Check circuit breaker before attempting delivery
			const isCircuitOpen = await this.circuitBreaker.isOpen(destination.id)
			if (isCircuitOpen) {
				throw new Error(`Circuit breaker is open for destination ${destination.id}`)
			}

			// Get the appropriate destination handler
			const handler = this.destinationHandlers.get(destination.type)
			if (!handler) {
				throw new Error(`No handler available for destination type: ${destination.type}`)
			}

			// Prepare delivery payload
			const deliveryPayload: DeliveryPayload = {
				deliveryId: item.payload.deliveryId,
				organizationId: item.organizationId,
				type: item.payload.type,
				data: item.payload.data,
				metadata: {
					...item.payload.metadata,
					queueItemId: item.id,
					attemptNumber: (item.retryCount || 0) + 1,
					scheduledAt: item.scheduledAt,
					processedAt: new Date().toISOString(),
				},
				correlationId: item.payload.correlationId,
				idempotencyKey: item.payload.idempotencyKey,
			}

			// Perform the actual delivery
			const deliveryResult: DeliveryResult = await handler.deliver(
				deliveryPayload,
				destination.config
			)

			// Record successful delivery
			await this.circuitBreaker.recordSuccess(destination.id)
			await this.destinationManager.updateDestinationHealth(destination.id, {
				status: 'healthy',
				lastSuccessAt: new Date().toISOString(),
				averageResponseTime: Date.now() - startTime,
			})

			// Mark as completed
			await this.dbClient.queue.updateStatus(item.id, 'completed', new Date().toISOString())

			// Create delivery log entry
			await this.dbClient.logs.create({
				deliveryId: item.payload.deliveryId,
				status: 'completed',
				destinations: [
					{
						destinationId: destination.id,
						status: 'delivered',
						attempts: (item.retryCount || 0) + 1,
						deliveredAt: new Date().toISOString(),
						crossSystemReference: deliveryResult.crossSystemReference,
					},
				],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				metadata: {
					...item.payload.metadata,
					organizationId: item.organizationId,
					deliveryResult,
					processingTime: Date.now() - startTime,
				},
			})

			// Update metrics
			if (this.config.enableMetrics) {
				const processingTime = Date.now() - startTime
				this.updateProcessingMetrics(processingTime, true)
			}

			this.logger.info('Queue item processed successfully', {
				queueItemId: item.id,
				deliveryId: item.payload.deliveryId,
				destinationId: destination.id,
				destinationType: destination.type,
				processingTime: Date.now() - startTime,
				crossSystemReference: deliveryResult.crossSystemReference,
			})
		} catch (error) {
			const processingTime = Date.now() - startTime
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'

			this.logger.error('Failed to process queue item', {
				queueItemId: item.id,
				deliveryId: item.payload?.deliveryId,
				destinationId: item.destinationId,
				error: errorMessage,
				processingTime,
			})

			// Get destination for circuit breaker and health updates
			let destination
			try {
				destination = await this.destinationManager.getDestination(item.destinationId.toString())
			} catch (destError) {
				this.logger.error('Failed to get destination for error handling', {
					destinationId: item.destinationId,
					error: destError instanceof Error ? destError.message : 'Unknown error',
				})
			}

			// Record failure in circuit breaker and health monitoring
			if (destination) {
				await this.circuitBreaker.recordFailure(destination.id)
				await this.destinationManager.updateDestinationHealth(destination.id, {
					status: 'unhealthy',
					lastFailureAt: new Date().toISOString(),
					consecutiveFailures: (destination as any).consecutiveFailures + 1 || 1,
				})
			}

			// Check if we should retry
			const shouldRetry = await this.retryManager.shouldRetry(
				item.payload?.deliveryId || item.id,
				error instanceof Error ? error : new Error(errorMessage)
			)

			if (shouldRetry && (item.retryCount || 0) < this.config.maxRetries) {
				// Calculate backoff delay and schedule retry
				const backoffDelay = this.retryManager.calculateBackoff(item.retryCount || 0)
				const nextRetryAt = new Date(Date.now() + backoffDelay).toISOString()

				await this.dbClient.queue.scheduleRetry(item.id, nextRetryAt, (item.retryCount || 0) + 1)

				// Record retry attempt
				await this.retryManager.recordAttempt(
					item.payload?.deliveryId || item.id,
					false,
					error instanceof Error ? error : new Error(errorMessage)
				)

				this.logger.info('Delivery scheduled for retry', {
					queueItemId: item.id,
					deliveryId: item.payload?.deliveryId,
					retryCount: (item.retryCount || 0) + 1,
					nextRetryAt,
					backoffDelay,
				})
			} else {
				// Mark as permanently failed
				await this.dbClient.queue.updateStatus(item.id, 'failed')

				// Record final failure attempt
				if (item.payload?.deliveryId) {
					await this.retryManager.recordAttempt(
						item.payload.deliveryId,
						false,
						error instanceof Error ? error : new Error(errorMessage)
					)
				}

				// Create delivery log entry for failure
				if (destination && item.payload?.deliveryId) {
					await this.dbClient.logs.create({
						deliveryId: item.payload.deliveryId,
						status: 'failed',
						destinations: [
							{
								destinationId: destination.id,
								status: 'failed',
								attempts: (item.retryCount || 0) + 1,
								failureReason: errorMessage,
								lastAttemptAt: new Date().toISOString(),
							},
						],
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						metadata: {
							...item.payload.metadata,
							organizationId: item.organizationId,
							finalError: errorMessage,
							totalProcessingTime: processingTime,
							maxRetriesReached: true,
						},
					})
				}

				this.logger.warn('Delivery permanently failed', {
					queueItemId: item.id,
					deliveryId: item.payload?.deliveryId,
					destinationId: item.destinationId,
					totalAttempts: (item.retryCount || 0) + 1,
					finalError: errorMessage,
				})
			}

			// Update metrics
			if (this.config.enableMetrics) {
				this.updateProcessingMetrics(processingTime, false)
			}
		} finally {
			this.currentlyProcessing.delete(item.id)
		}
	}

	/**
	 * Calculate retry delay with exponential backoff
	 */
	private calculateRetryDelay(retryCount: number): number {
		const baseDelay = 1000 // 1 second
		const delay = baseDelay * Math.pow(this.config.retryBackoffMultiplier, retryCount)
		return Math.min(delay, this.config.maxRetryDelay)
	}

	/**
	 * Update processing metrics
	 */
	private updateProcessingMetrics(processingTime: number, success: boolean): void {
		if (success) {
			this.metrics.totalProcessed++
		} else {
			this.metrics.totalFailed++
		}

		// Update average processing time (simple moving average)
		const totalProcessed = this.metrics.totalProcessed + this.metrics.totalFailed
		this.metrics.averageProcessingTime =
			(this.metrics.averageProcessingTime * (totalProcessed - 1) + processingTime) / totalProcessed

		// Update processing rate (items per minute)
		const uptimeMinutes = (Date.now() - this.startTime) / 60000
		this.metrics.processingRate = totalProcessed / Math.max(uptimeMinutes, 1)
		this.metrics.lastProcessedAt = new Date().toISOString()
		this.metrics.uptime = Date.now() - this.startTime
	}

	/**
	 * Update queue depth metric
	 */
	private async updateQueueDepth(): Promise<void> {
		try {
			const status = await this.getQueueStatus()
			this.metrics.queueDepth = status.pendingCount + status.processingCount
		} catch (error) {
			this.logger.error('Failed to update queue depth', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Get current queue status
	 * Requirements 2.4: Queue status monitoring
	 */
	async getQueueStatus(): Promise<QueueStatus> {
		try {
			const status = await this.dbClient.queue.getQueueStats()

			// Calculate average processing time from recent items
			const recentItems = await this.dbClient.queue.getRecentProcessedItems(100)
			let averageProcessingTime = 0

			if (recentItems.length > 0) {
				const totalTime = recentItems.reduce((sum: number, item: any) => {
					if (item.processedAt && item.createdAt) {
						return sum + (new Date(item.processedAt).getTime() - new Date(item.createdAt).getTime())
					}
					return sum
				}, 0)
				averageProcessingTime = totalTime / recentItems.length
			}

			// Calculate oldest pending age
			const oldestPending = await this.dbClient.queue.getOldestPendingItem()
			let oldestPendingAge = 0

			if (oldestPending) {
				oldestPendingAge = Date.now() - new Date(oldestPending.createdAt).getTime()
			}

			return {
				...status,
				averageProcessingTime,
				oldestPendingAge,
			}
		} catch (error) {
			this.logger.error('Failed to get queue status', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Cancel a pending delivery
	 */
	async cancelDelivery(deliveryId: string): Promise<void> {
		this.logger.info('Cancelling delivery', { deliveryId })

		try {
			await this.dbClient.queue.cancelByDeliveryId(deliveryId)
			this.logger.info('Delivery cancelled', { deliveryId })
		} catch (error) {
			this.logger.error('Failed to cancel delivery', {
				deliveryId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Pause queue processing
	 */
	async pauseQueue(): Promise<void> {
		this.logger.info('Pausing queue processing')

		if (this.processingInterval) {
			clearInterval(this.processingInterval)
			this.processingInterval = undefined
		}

		this.logger.info('Queue processing paused')
	}

	/**
	 * Resume queue processing
	 */
	async resumeQueue(): Promise<void> {
		this.logger.info('Resuming queue processing')

		if (!this.processingInterval && this.isRunning) {
			this.processingInterval = setInterval(
				() => this.processDeliveryQueue(),
				this.config.processingInterval
			)
		}

		this.logger.info('Queue processing resumed')
	}

	/**
	 * Start the delivery scheduler
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			this.logger.warn('Delivery scheduler is already running')
			return
		}

		this.logger.info('Starting delivery scheduler', {
			maxConcurrentDeliveries: this.config.maxConcurrentDeliveries,
			processingInterval: this.config.processingInterval,
			maxRetries: this.config.maxRetries,
		})

		this.isRunning = true
		this.startTime = Date.now()

		// Start processing interval
		this.processingInterval = setInterval(
			() => this.processDeliveryQueue(),
			this.config.processingInterval
		)

		// Start cleanup interval
		this.cleanupInterval = setInterval(
			() => this.performCleanup(),
			this.config.queueCleanupInterval
		)

		// Start queue monitoring
		await this.queueManager.startMonitoring()

		this.logger.info('Delivery scheduler started successfully')
	}

	/**
	 * Stop the delivery scheduler
	 */
	async stop(): Promise<void> {
		if (!this.isRunning) {
			return
		}

		this.logger.info('Stopping delivery scheduler')

		this.isRunning = false

		// Clear intervals
		if (this.processingInterval) {
			clearInterval(this.processingInterval)
			this.processingInterval = undefined
		}

		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = undefined
		}

		// Stop queue monitoring
		await this.queueManager.stopMonitoring()

		// Wait for current processing to complete
		while (this.currentlyProcessing.size > 0) {
			this.logger.info('Waiting for processing to complete', {
				remainingItems: this.currentlyProcessing.size,
			})
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}

		this.logger.info('Delivery scheduler stopped successfully')
	}

	/**
	 * Perform queue cleanup and maintenance
	 * Requirements 2.5: Queue cleanup and maintenance operations
	 */
	private async performCleanup(): Promise<void> {
		try {
			this.logger.debug('Performing queue cleanup')

			// Clean up old completed items
			const cutoffTime = new Date(Date.now() - this.config.maxCompletedAge).toISOString()
			const deletedCount = await this.dbClient.queue.deleteCompletedItems(cutoffTime)

			if (deletedCount > 0) {
				this.logger.info('Cleaned up completed queue items', {
					deletedCount,
					cutoffTime,
				})
			}

			// Update queue depth metric
			if (this.config.enableMetrics) {
				await this.updateQueueDepth()
			}
		} catch (error) {
			this.logger.error('Error during queue cleanup', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): QueueMetrics {
		return { ...this.metrics }
	}

	/**
	 * Reset metrics
	 */
	resetMetrics(): void {
		this.metrics = {
			totalQueued: 0,
			totalProcessed: 0,
			totalFailed: 0,
			averageProcessingTime: 0,
			queueDepth: 0,
			processingRate: 0,
			uptime: 0,
		}
		this.startTime = Date.now()
	}

	/**
	 * Get comprehensive queue health from queue manager
	 */
	async getQueueHealth(): Promise<any> {
		return this.queueManager.getQueueHealth()
	}

	/**
	 * Get organization-specific queue statistics
	 */
	async getOrganizationStats(organizationId: string): Promise<any> {
		return this.queueManager.getOrganizationStats(organizationId)
	}

	/**
	 * Perform comprehensive queue cleanup
	 */
	async performComprehensiveCleanup(): Promise<any> {
		return this.queueManager.performCleanup()
	}

	/**
	 * Process stuck items that have been processing too long
	 */
	async processStuckItems(): Promise<number> {
		return this.queueManager.processStuckItems()
	}

	/**
	 * Get queue manager for advanced operations
	 */
	getQueueManager(): QueueManager {
		return this.queueManager
	}

	/**
	 * Get destination manager for advanced operations
	 */
	getDestinationManager(): IDestinationManager {
		return this.destinationManager
	}

	/**
	 * Get retry manager for advanced operations
	 */
	getRetryManager(): IRetryManager {
		return this.retryManager
	}

	/**
	 * Get circuit breaker for advanced operations
	 */
	getCircuitBreaker(): CircuitBreaker {
		return this.circuitBreaker
	}

	/**
	 * Get destination handler for a specific type
	 */
	getDestinationHandler(type: DestinationType): IDestinationHandler | undefined {
		return this.destinationHandlers.get(type)
	}

	/**
	 * Register a custom destination handler
	 */
	registerDestinationHandler(type: DestinationType, handler: IDestinationHandler): void {
		this.destinationHandlers.set(type, handler)
		this.logger.info('Registered destination handler', { type })
	}

	/**
	 * Health check for the scheduler
	 */
	async healthCheck(): Promise<{ healthy: boolean; details: any }> {
		try {
			const status = await this.getQueueStatus()
			const metrics = this.getMetrics()
			const queueHealth = await this.getQueueHealth()

			const healthy =
				this.isRunning &&
				status.pendingCount < 10000 && // Not too many pending items
				metrics.processingRate > 0 && // Processing items
				queueHealth.status !== 'critical'

			return {
				healthy,
				details: {
					isRunning: this.isRunning,
					currentlyProcessing: this.currentlyProcessing.size,
					queueStatus: status,
					queueHealth,
					metrics,
					config: this.config,
				},
			}
		} catch (error) {
			return {
				healthy: false,
				details: {
					error: error instanceof Error ? error.message : 'Unknown error',
				},
			}
		}
	}
}

/**
 * Factory function for creating delivery scheduler
 */
export function createDeliveryScheduler(
	dbClient: DeliveryDatabaseClient,
	config?: Partial<DeliverySchedulerConfig>,
	queueManagerConfig?: Partial<QueueManagerConfig>
): DeliveryScheduler {
	return new DeliveryScheduler(dbClient, config, queueManagerConfig)
}
