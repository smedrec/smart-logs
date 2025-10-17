/**
 * Retry Manager - Exponential backoff and retry logic coordination
 * Requirements 3.1, 3.2, 3.3: Retry management with exponential backoff
 */

import { StructuredLogger } from '@repo/logs'

import type { DeliveryDatabaseClient } from './database-client.js'
import type { IRetryManager } from './interfaces.js'
import type { RetrySchedule } from './types.js'

/**
 * Configuration for retry manager
 */
export interface RetryManagerConfig {
	maxRetries: number
	baseDelay: number // milliseconds
	maxDelay: number // milliseconds
	backoffMultiplier: number
	jitterEnabled: boolean
	jitterMaxPercent: number // percentage of delay to add as jitter
	nonRetryableErrors: string[] // Error patterns that should not be retried
	retryableStatusCodes: number[] // HTTP status codes that should be retried
}

/**
 * Default retry manager configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryManagerConfig = {
	maxRetries: 5,
	baseDelay: 1000, // 1 second
	maxDelay: 300000, // 5 minutes
	backoffMultiplier: 2,
	jitterEnabled: true,
	jitterMaxPercent: 10, // 10% jitter
	nonRetryableErrors: [
		'INVALID_CONFIG',
		'AUTHENTICATION_FAILED',
		'AUTHORIZATION_DENIED',
		'INVALID_PAYLOAD',
		'DESTINATION_NOT_FOUND',
	],
	retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}

/**
 * Retry attempt record for tracking
 */
export interface RetryAttempt {
	attemptNumber: number
	timestamp: string
	success: boolean
	error?: string
	responseTime?: number
	nextRetryAt?: string
}

/**
 * Retry manager implementation with exponential backoff and jitter
 */
export class RetryManager implements IRetryManager {
	private readonly logger: StructuredLogger
	private readonly config: RetryManagerConfig

	constructor(
		private readonly dbClient: DeliveryDatabaseClient,
		config: Partial<RetryManagerConfig> = {}
	) {
		this.config = { ...DEFAULT_RETRY_CONFIG, ...config }

		this.logger = new StructuredLogger({
			service: '@repo/audit - RetryManager',
			environment: process.env.NODE_ENV || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})
	}

	/**
	 * Determine if a delivery should be retried based on error and attempt count
	 * Requirements 3.1, 3.2: Retry logic with failure analysis
	 */
	async shouldRetry(deliveryId: string, error: Error): Promise<boolean> {
		try {
			// Get current retry schedule
			const schedule = await this.getRetrySchedule(deliveryId)

			// Check if we've exceeded max retries
			if (schedule.currentAttempt >= this.config.maxRetries) {
				this.logger.info('Max retries exceeded', {
					deliveryId,
					currentAttempt: schedule.currentAttempt,
					maxRetries: this.config.maxRetries,
				})
				return false
			}

			// Check if error is non-retryable
			if (this.isNonRetryableError(error)) {
				this.logger.info('Non-retryable error detected', {
					deliveryId,
					error: error.message,
				})
				await this.markAsNonRetryable(deliveryId, `Non-retryable error: ${error.message}`)
				return false
			}

			// Check if HTTP status code is retryable (if available)
			const statusCode = this.extractStatusCode(error)
			if (statusCode && !this.config.retryableStatusCodes.includes(statusCode)) {
				this.logger.info('Non-retryable status code', {
					deliveryId,
					statusCode,
					retryableStatusCodes: JSON.stringify(this.config.retryableStatusCodes),
				})
				return false
			}

			this.logger.info('Delivery eligible for retry', {
				deliveryId,
				currentAttempt: schedule.currentAttempt,
				maxRetries: this.config.maxRetries,
				error: error.message,
			})

			return true
		} catch (err) {
			this.logger.error('Error checking retry eligibility', {
				deliveryId,
				error: err instanceof Error ? err.message : 'Unknown error',
			})
			return false
		}
	}

	/**
	 * Calculate exponential backoff delay with jitter
	 * Requirements 3.2, 3.3: Exponential backoff with jitter to prevent thundering herd
	 */
	calculateBackoff(attemptCount: number): number {
		// Calculate base exponential backoff
		const exponentialDelay =
			this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attemptCount)

		// Cap at maximum delay
		const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay)

		// Add jitter if enabled
		if (this.config.jitterEnabled) {
			const jitterAmount = cappedDelay * (this.config.jitterMaxPercent / 100)
			const jitter = Math.random() * jitterAmount
			return Math.round(cappedDelay + jitter)
		}

		return Math.round(cappedDelay)
	}

	/**
	 * Record a delivery attempt with success/failure tracking
	 * Requirements 3.1, 3.3: Attempt tracking and failure analysis
	 */
	async recordAttempt(deliveryId: string, success: boolean, error?: Error): Promise<void> {
		const timestamp = new Date().toISOString()

		try {
			// Get current schedule to determine attempt number
			const schedule = await this.getRetrySchedule(deliveryId)
			const attemptNumber = schedule.currentAttempt + 1

			// Calculate next retry time if this attempt failed
			let nextRetryAt: string | undefined
			if (!success && attemptNumber < this.config.maxRetries) {
				const backoffDelay = this.calculateBackoff(attemptNumber)
				nextRetryAt = new Date(Date.now() + backoffDelay).toISOString()
			}

			// Create retry attempt record
			const attempt: RetryAttempt = {
				attemptNumber,
				timestamp,
				success,
				error: error?.message,
				nextRetryAt,
			}

			// Update queue item with retry information
			const queueItems = await this.dbClient.queue.findByDeliveryId(deliveryId)

			for (const item of queueItems) {
				if (success) {
					// Mark as completed
					await this.dbClient.queue.updateStatus(item.id, 'completed', timestamp)
				} else if (nextRetryAt && attemptNumber < this.config.maxRetries) {
					// Schedule retry
					await this.dbClient.queue.scheduleRetry(item.id, nextRetryAt, attemptNumber)
				} else {
					// Mark as permanently failed
					await this.dbClient.queue.updateStatus(item.id, 'failed')
				}

				// Update metadata with retry attempt information
				const currentMetadata = item.metadata || {}
				const retryAttempts = currentMetadata.retryAttempts || []
				retryAttempts.push(attempt)

				await this.dbClient.queue.updateItem(item.id, {
					metadata: {
						...currentMetadata,
						retryAttempts,
						lastAttemptAt: timestamp,
						totalAttempts: attemptNumber,
					},
				})
			}

			this.logger.info('Retry attempt recorded', {
				deliveryId,
				attemptNumber,
				success,
				nextRetryAt,
				error: error?.message,
			})
		} catch (err) {
			this.logger.error('Failed to record retry attempt', {
				deliveryId,
				error: err instanceof Error ? err.message : 'Unknown error',
			})
			throw err
		}
	}

	/**
	 * Get current retry schedule for a delivery
	 * Requirements 3.1, 3.3: Retry scheduling and tracking
	 */
	async getRetrySchedule(deliveryId: string): Promise<RetrySchedule> {
		try {
			const queueItems = await this.dbClient.queue.findByDeliveryId(deliveryId)

			if (queueItems.length === 0) {
				// Return default schedule for new deliveries
				return {
					deliveryId,
					currentAttempt: 0,
					maxAttempts: this.config.maxRetries,
					backoffDelay: this.config.baseDelay,
					totalDelay: 0,
				}
			}

			// Get the most recent queue item to determine current state
			const latestItem = queueItems.reduce((latest, item) => {
				return new Date(item.updatedAt) > new Date(latest.updatedAt) ? item : latest
			})

			const metadata = latestItem.metadata || {}
			const retryAttempts = metadata.retryAttempts || []
			const currentAttempt = latestItem.retryCount || 0

			// Calculate total delay from first attempt
			let totalDelay = 0
			if (retryAttempts.length > 0) {
				const firstAttempt = new Date(retryAttempts[0].timestamp).getTime()
				totalDelay = Date.now() - firstAttempt
			}

			// Calculate next backoff delay
			const backoffDelay = this.calculateBackoff(currentAttempt)

			return {
				deliveryId,
				currentAttempt,
				maxAttempts: this.config.maxRetries,
				nextRetryAt: latestItem.nextRetryAt,
				backoffDelay,
				totalDelay,
			}
		} catch (error) {
			this.logger.error('Failed to get retry schedule', {
				deliveryId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			// Return default schedule on error
			return {
				deliveryId,
				currentAttempt: 0,
				maxAttempts: this.config.maxRetries,
				backoffDelay: this.config.baseDelay,
				totalDelay: 0,
			}
		}
	}

	/**
	 * Reset retry count for a delivery (useful for manual retries)
	 * Requirements 3.1: Retry count management
	 */
	async resetRetryCount(deliveryId: string): Promise<void> {
		try {
			const queueItems = await this.dbClient.queue.findByDeliveryId(deliveryId)

			for (const item of queueItems) {
				await this.dbClient.queue.updateItem(item.id, {
					retryCount: 0,
					nextRetryAt: null,
					status: 'pending',
					metadata: {
						...item.metadata,
						retryAttempts: [],
						lastAttemptAt: null,
						totalAttempts: 0,
						resetAt: new Date().toISOString(),
					},
				})
			}

			this.logger.info('Retry count reset', { deliveryId })
		} catch (error) {
			this.logger.error('Failed to reset retry count', {
				deliveryId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Mark delivery as non-retryable due to permanent failure
	 * Requirements 3.1: Non-retryable error handling
	 */
	async markAsNonRetryable(deliveryId: string, reason: string): Promise<void> {
		try {
			const queueItems = await this.dbClient.queue.findByDeliveryId(deliveryId)

			for (const item of queueItems) {
				await this.dbClient.queue.updateItem(item.id, {
					status: 'failed',
					metadata: {
						...item.metadata,
						nonRetryable: true,
						nonRetryableReason: reason,
						markedNonRetryableAt: new Date().toISOString(),
					},
				})
			}

			this.logger.info('Delivery marked as non-retryable', {
				deliveryId,
				reason,
			})
		} catch (error) {
			this.logger.error('Failed to mark delivery as non-retryable', {
				deliveryId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Check if an error should not be retried
	 */
	private isNonRetryableError(error: Error): boolean {
		const errorMessage = error.message.toLowerCase()

		return this.config.nonRetryableErrors.some((pattern) =>
			errorMessage.includes(pattern.toLowerCase())
		)
	}

	/**
	 * Extract HTTP status code from error if available
	 */
	private extractStatusCode(error: Error): number | null {
		// Try to extract status code from common error formats
		const message = error.message

		// Look for "status: 404" or "status code: 404" patterns
		const statusMatch = message.match(/status(?:\s+code)?:\s*(\d{3})/i)
		if (statusMatch) {
			return parseInt(statusMatch[1], 10)
		}

		// Look for HTTP error patterns like "404 Not Found"
		const httpMatch = message.match(/^(\d{3})\s+/i)
		if (httpMatch) {
			return parseInt(httpMatch[1], 10)
		}

		// Check if error object has status property
		if ('status' in error && typeof (error as any).status === 'number') {
			return (error as any).status
		}

		return null
	}

	/**
	 * Get retry statistics for monitoring
	 */
	async getRetryStatistics(organizationId?: string): Promise<{
		totalRetries: number
		successfulRetries: number
		failedRetries: number
		averageRetryCount: number
		averageBackoffTime: number
		nonRetryableCount: number
	}> {
		try {
			// Get all queue items with retry attempts
			const allItems = await this.dbClient.queue.findByStatus('completed', {
				organizationId,
				limit: 1000,
			})

			const failedItems = await this.dbClient.queue.findByStatus('failed', {
				organizationId,
				limit: 1000,
			})

			const allItemsWithRetries = [...allItems, ...failedItems].filter((item) => {
				const metadata = item.metadata || {}
				return metadata.retryAttempts && metadata.retryAttempts.length > 0
			})

			let totalRetries = 0
			let successfulRetries = 0
			let failedRetries = 0
			let totalBackoffTime = 0
			let nonRetryableCount = 0

			for (const item of allItemsWithRetries) {
				const metadata = item.metadata || {}
				const retryAttempts = metadata.retryAttempts || []

				if (metadata.nonRetryable) {
					nonRetryableCount++
					continue
				}

				totalRetries += retryAttempts.length

				if (item.status === 'completed') {
					successfulRetries += retryAttempts.length
				} else {
					failedRetries += retryAttempts.length
				}

				// Calculate total backoff time for this delivery
				if (retryAttempts.length > 1) {
					const firstAttempt = new Date(retryAttempts[0].timestamp).getTime()
					const lastAttempt = new Date(retryAttempts[retryAttempts.length - 1].timestamp).getTime()
					totalBackoffTime += lastAttempt - firstAttempt
				}
			}

			const averageRetryCount =
				allItemsWithRetries.length > 0 ? totalRetries / allItemsWithRetries.length : 0

			const averageBackoffTime = totalRetries > 0 ? totalBackoffTime / totalRetries : 0

			return {
				totalRetries,
				successfulRetries,
				failedRetries,
				averageRetryCount,
				averageBackoffTime,
				nonRetryableCount,
			}
		} catch (error) {
			this.logger.error('Failed to get retry statistics', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): RetryManagerConfig {
		return { ...this.config }
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<RetryManagerConfig>): void {
		Object.assign(this.config, updates)
		this.logger.info('Retry manager configuration updated', { updates: JSON.stringify(updates) })
	}
}

/**
 * Factory function for creating retry manager
 */
export function createRetryManager(
	dbClient: DeliveryDatabaseClient,
	config?: Partial<RetryManagerConfig>
): RetryManager {
	return new RetryManager(dbClient, config)
}
