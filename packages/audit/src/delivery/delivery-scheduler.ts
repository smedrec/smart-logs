/**
 * Delivery Scheduler - Priority-based queue management with concurrent processing
 * Requirements 2.4, 2.5: Queue management and scheduling
 */

import { nanoid } from 'nanoid'

import { StructuredLogger } from '@repo/logs'

import { QueueManager } from './queue-manager.js'

import type { DeliveryDatabaseClient } from './database-client.js'
import type { IDeliveryScheduler } from './interfaces.js'
import type { QueueManagerConfig } from './queue-manager.js'
import type { DeliveryRequest, QueueStatus } from './types.js'

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
	 * Process a single queue item
	 */
	private async processQueueItem(item: any): Promise<void> {
		const startTime = Date.now()
		this.currentlyProcessing.add(item.id)

		try {
			// Mark as processing
			await this.dbClient.queue.updateStatus(item.id, 'processing')

			// TODO: This will be implemented in later tasks when destination handlers are available
			// For now, we'll simulate processing
			this.logger.info('Processing queue item', {
				queueItemId: item.id,
				deliveryId: item.payload.deliveryId,
				destinationId: item.destinationId,
			})

			// Simulate processing delay
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Mark as completed (temporary - will be replaced with actual delivery logic)
			await this.dbClient.queue.updateStatus(item.id, 'completed', new Date().toISOString())

			// Update metrics
			if (this.config.enableMetrics) {
				const processingTime = Date.now() - startTime
				this.updateProcessingMetrics(processingTime, true)
			}

			this.logger.info('Queue item processed successfully', {
				queueItemId: item.id,
				processingTime: Date.now() - startTime,
			})
		} catch (error) {
			this.logger.error('Failed to process queue item', {
				queueItemId: item.id,
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			// Mark as failed and schedule retry if applicable
			const shouldRetry = item.retryCount < item.maxRetries

			if (shouldRetry) {
				const nextRetryAt = new Date(
					Date.now() + this.calculateRetryDelay(item.retryCount)
				).toISOString()
				await this.dbClient.queue.scheduleRetry(item.id, nextRetryAt, item.retryCount + 1)
			} else {
				await this.dbClient.queue.updateStatus(item.id, 'failed')
			}

			// Update metrics
			if (this.config.enableMetrics) {
				const processingTime = Date.now() - startTime
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
