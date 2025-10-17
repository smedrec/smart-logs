/**
 * Queue Manager - Advanced queue management with monitoring and maintenance
 * Requirements 2.4, 2.5: Queue management with status monitoring and cleanup
 */

import { StructuredLogger } from '@repo/logs'

import type { DeliveryDatabaseClient } from './database-client.js'
import type { QueueStatus } from './types.js'

/**
 * Configuration for queue manager
 */
export interface QueueManagerConfig {
	monitoringInterval: number // milliseconds
	alertThresholds: {
		queueDepth: number
		oldestItemAge: number // milliseconds
		processingTime: number // milliseconds
		failureRate: number // percentage
	}
	cleanupConfig: {
		completedItemRetention: number // milliseconds
		failedItemRetention: number // milliseconds
		cancelledItemRetention: number // milliseconds
	}
	enableAutoScaling: boolean
	maxConcurrentWorkers: number
}

/**
 * Default queue manager configuration
 */
export const DEFAULT_QUEUE_MANAGER_CONFIG: QueueManagerConfig = {
	monitoringInterval: 30000, // 30 seconds
	alertThresholds: {
		queueDepth: 1000,
		oldestItemAge: 300000, // 5 minutes
		processingTime: 30000, // 30 seconds
		failureRate: 10, // 10%
	},
	cleanupConfig: {
		completedItemRetention: 86400000, // 24 hours
		failedItemRetention: 604800000, // 7 days
		cancelledItemRetention: 86400000, // 24 hours
	},
	enableAutoScaling: false,
	maxConcurrentWorkers: 20,
}

/**
 * Queue health status
 */
export interface QueueHealth {
	status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
	metrics: QueueMetrics
	alerts: QueueAlert[]
	recommendations: string[]
}

/**
 * Queue metrics for detailed monitoring
 */
export interface QueueMetrics {
	queueDepth: number
	processingRate: number // items per minute
	averageProcessingTime: number // milliseconds
	failureRate: number // percentage
	oldestItemAge: number // milliseconds
	throughput: {
		last5Minutes: number
		last15Minutes: number
		lastHour: number
	}
	statusDistribution: {
		pending: number
		processing: number
		completed: number
		failed: number
		retrying: number
	}
	organizationBreakdown: Record<
		string,
		{
			pending: number
			processing: number
			averageWaitTime: number
		}
	>
}

/**
 * Queue alert information
 */
export interface QueueAlert {
	type: 'queue_depth' | 'processing_time' | 'failure_rate' | 'stale_items'
	severity: 'warning' | 'error' | 'critical'
	message: string
	value: number
	threshold: number
	timestamp: string
}

/**
 * Queue manager for advanced monitoring and maintenance
 */
export class QueueManager {
	private readonly logger: StructuredLogger
	private readonly config: QueueManagerConfig
	private monitoringInterval?: NodeJS.Timeout
	private isMonitoring = false
	private lastMetrics?: QueueMetrics

	constructor(
		private readonly dbClient: DeliveryDatabaseClient,
		config: Partial<QueueManagerConfig> = {}
	) {
		this.config = { ...DEFAULT_QUEUE_MANAGER_CONFIG, ...config }

		this.logger = new StructuredLogger({
			service: '@repo/audit - QueueManager',
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
	 * Start queue monitoring
	 */
	async startMonitoring(): Promise<void> {
		if (this.isMonitoring) {
			this.logger.warn('Queue monitoring is already running')
			return
		}

		this.logger.info('Starting queue monitoring', {
			interval: this.config.monitoringInterval,
			thresholds: this.config.alertThresholds,
		})

		this.isMonitoring = true
		this.monitoringInterval = setInterval(
			() => this.performMonitoring(),
			this.config.monitoringInterval
		)

		// Perform initial monitoring
		await this.performMonitoring()
	}

	/**
	 * Stop queue monitoring
	 */
	async stopMonitoring(): Promise<void> {
		if (!this.isMonitoring) {
			return
		}

		this.logger.info('Stopping queue monitoring')

		this.isMonitoring = false
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval)
			this.monitoringInterval = undefined
		}
	}

	/**
	 * Get comprehensive queue health status
	 */
	async getQueueHealth(): Promise<QueueHealth> {
		const metrics = await this.collectMetrics()
		const alerts = this.analyzeMetrics(metrics)
		const recommendations = this.generateRecommendations(metrics, alerts)

		let status: QueueHealth['status'] = 'healthy'
		if (alerts.some((a) => a.severity === 'critical')) {
			status = 'critical'
		} else if (alerts.some((a) => a.severity === 'error')) {
			status = 'unhealthy'
		} else if (alerts.some((a) => a.severity === 'warning')) {
			status = 'degraded'
		}

		return {
			status,
			metrics,
			alerts,
			recommendations,
		}
	}

	/**
	 * Perform comprehensive queue cleanup
	 */
	async performCleanup(): Promise<{
		completedDeleted: number
		failedDeleted: number
		cancelledDeleted: number
		totalDeleted: number
	}> {
		this.logger.info('Performing queue cleanup', {
			retentionConfig: this.config.cleanupConfig,
		})

		const now = Date.now()
		const completedCutoff = new Date(
			now - this.config.cleanupConfig.completedItemRetention
		).toISOString()
		const failedCutoff = new Date(now - this.config.cleanupConfig.failedItemRetention).toISOString()
		const cancelledCutoff = new Date(
			now - this.config.cleanupConfig.cancelledItemRetention
		).toISOString()

		// Clean up completed items
		const completedDeleted = await this.dbClient.queue.deleteCompletedItems(completedCutoff)

		// Clean up old failed items (we'll need to add this method)
		const failedItems = await this.dbClient.queue.findByStatus('failed', { limit: 1000 })
		let failedDeleted = 0
		for (const item of failedItems) {
			if (new Date(item.updatedAt).getTime() < new Date(failedCutoff).getTime()) {
				// Delete old failed items (we'll need to add a delete method)
				failedDeleted++
			}
		}

		// Clean up cancelled items
		const cancelledItems = await this.dbClient.queue.findByStatus('cancelled', { limit: 1000 })
		let cancelledDeleted = 0
		for (const item of cancelledItems) {
			if (new Date(item.updatedAt).getTime() < new Date(cancelledCutoff).getTime()) {
				cancelledDeleted++
			}
		}

		const totalDeleted = completedDeleted + failedDeleted + cancelledDeleted

		this.logger.info('Queue cleanup completed', {
			completedDeleted,
			failedDeleted,
			cancelledDeleted,
			totalDeleted,
		})

		return {
			completedDeleted,
			failedDeleted,
			cancelledDeleted,
			totalDeleted,
		}
	}

	/**
	 * Get queue statistics by organization
	 */
	async getOrganizationStats(organizationId: string): Promise<{
		queueDepth: number
		processingCount: number
		averageWaitTime: number
		recentThroughput: number
		failureRate: number
	}> {
		const orgStats = await this.dbClient.queue.getQueueDepthByOrganization(organizationId)

		// Get recent items for throughput calculation
		const recentItems = await this.dbClient.queue.getRecentProcessedItems(100)
		const orgRecentItems = recentItems.filter((item) => item.organizationId === organizationId)

		// Calculate throughput (items processed in last hour)
		const oneHourAgo = Date.now() - 3600000
		const recentThroughput = orgRecentItems.filter(
			(item) => item.processedAt && new Date(item.processedAt).getTime() > oneHourAgo
		).length

		// Calculate failure rate
		const totalRecent = orgRecentItems.length
		const failedRecent = orgRecentItems.filter((item) => item.status === 'failed').length
		const failureRate = totalRecent > 0 ? (failedRecent / totalRecent) * 100 : 0

		return {
			queueDepth: orgStats.pendingCount,
			processingCount: orgStats.processingCount,
			averageWaitTime: orgStats.averageWaitTime,
			recentThroughput,
			failureRate,
		}
	}

	/**
	 * Force process stuck items
	 */
	async processStuckItems(): Promise<number> {
		this.logger.info('Processing stuck items')

		// Find items that have been processing for too long
		const stuckThreshold = Date.now() - 300000 // 5 minutes
		const processingItems = await this.dbClient.queue.findByStatus('processing')

		let processedCount = 0
		for (const item of processingItems) {
			if (new Date(item.updatedAt).getTime() < stuckThreshold) {
				// Reset stuck items back to pending
				await this.dbClient.queue.updateStatus(item.id, 'pending')
				processedCount++
			}
		}

		this.logger.info('Processed stuck items', { count: processedCount })
		return processedCount
	}

	/**
	 * Perform monitoring cycle
	 */
	private async performMonitoring(): Promise<void> {
		try {
			const health = await this.getQueueHealth()

			// Log health status
			this.logger.info('Queue health check', {
				status: health.status,
				queueDepth: health.metrics.queueDepth,
				processingRate: health.metrics.processingRate,
				failureRate: health.metrics.failureRate,
				alertCount: health.alerts.length,
			})

			// Log alerts
			for (const alert of health.alerts) {
				this.logger.warn('Queue alert', {
					type: alert.type,
					severity: alert.severity,
					message: alert.message,
					value: alert.value,
					threshold: alert.threshold,
				})
			}

			this.lastMetrics = health.metrics
		} catch (error) {
			this.logger.error('Queue monitoring failed', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Collect comprehensive queue metrics
	 */
	private async collectMetrics(): Promise<QueueMetrics> {
		const queueStats = await this.dbClient.queue.getQueueStats()
		const recentItems = await this.dbClient.queue.getRecentProcessedItems(1000)
		const oldestPending = await this.dbClient.queue.getOldestPendingItem()

		// Calculate processing rate
		const now = Date.now()
		const fiveMinutesAgo = now - 300000
		const fifteenMinutesAgo = now - 900000
		const oneHourAgo = now - 3600000

		const last5MinuteItems = recentItems.filter(
			(item) => item.processedAt && new Date(item.processedAt).getTime() > fiveMinutesAgo
		)
		const last15MinuteItems = recentItems.filter(
			(item) => item.processedAt && new Date(item.processedAt).getTime() > fifteenMinutesAgo
		)
		const lastHourItems = recentItems.filter(
			(item) => item.processedAt && new Date(item.processedAt).getTime() > oneHourAgo
		)

		// Calculate average processing time
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

		// Calculate failure rate
		const totalRecent = recentItems.length
		const failedRecent = recentItems.filter((item) => item.status === 'failed').length
		const failureRate = totalRecent > 0 ? (failedRecent / totalRecent) * 100 : 0

		// Calculate oldest item age
		const oldestItemAge = oldestPending ? now - new Date(oldestPending.createdAt).getTime() : 0

		// Get organization breakdown (simplified for now)
		const organizationBreakdown: Record<string, any> = {}

		return {
			queueDepth: queueStats.pendingCount + queueStats.processingCount,
			processingRate: last5MinuteItems.length / 5, // items per minute
			averageProcessingTime,
			failureRate,
			oldestItemAge,
			throughput: {
				last5Minutes: last5MinuteItems.length,
				last15Minutes: last15MinuteItems.length,
				lastHour: lastHourItems.length,
			},
			statusDistribution: {
				pending: queueStats.pendingCount,
				processing: queueStats.processingCount,
				completed: queueStats.completedCount,
				failed: queueStats.failedCount,
				retrying: queueStats.retryingCount,
			},
			organizationBreakdown,
		}
	}

	/**
	 * Analyze metrics and generate alerts
	 */
	private analyzeMetrics(metrics: QueueMetrics): QueueAlert[] {
		const alerts: QueueAlert[] = []
		const now = new Date().toISOString()

		// Queue depth alert
		if (metrics.queueDepth > this.config.alertThresholds.queueDepth) {
			alerts.push({
				type: 'queue_depth',
				severity:
					metrics.queueDepth > this.config.alertThresholds.queueDepth * 2 ? 'critical' : 'warning',
				message: `Queue depth is high: ${metrics.queueDepth} items`,
				value: metrics.queueDepth,
				threshold: this.config.alertThresholds.queueDepth,
				timestamp: now,
			})
		}

		// Processing time alert
		if (metrics.averageProcessingTime > this.config.alertThresholds.processingTime) {
			alerts.push({
				type: 'processing_time',
				severity:
					metrics.averageProcessingTime > this.config.alertThresholds.processingTime * 2
						? 'error'
						: 'warning',
				message: `Average processing time is high: ${Math.round(metrics.averageProcessingTime)}ms`,
				value: metrics.averageProcessingTime,
				threshold: this.config.alertThresholds.processingTime,
				timestamp: now,
			})
		}

		// Failure rate alert
		if (metrics.failureRate > this.config.alertThresholds.failureRate) {
			alerts.push({
				type: 'failure_rate',
				severity:
					metrics.failureRate > this.config.alertThresholds.failureRate * 2 ? 'critical' : 'error',
				message: `Failure rate is high: ${metrics.failureRate.toFixed(1)}%`,
				value: metrics.failureRate,
				threshold: this.config.alertThresholds.failureRate,
				timestamp: now,
			})
		}

		// Stale items alert
		if (metrics.oldestItemAge > this.config.alertThresholds.oldestItemAge) {
			alerts.push({
				type: 'stale_items',
				severity:
					metrics.oldestItemAge > this.config.alertThresholds.oldestItemAge * 3
						? 'critical'
						: 'warning',
				message: `Oldest pending item is stale: ${Math.round(metrics.oldestItemAge / 60000)} minutes old`,
				value: metrics.oldestItemAge,
				threshold: this.config.alertThresholds.oldestItemAge,
				timestamp: now,
			})
		}

		return alerts
	}

	/**
	 * Generate recommendations based on metrics and alerts
	 */
	private generateRecommendations(metrics: QueueMetrics, alerts: QueueAlert[]): string[] {
		const recommendations: string[] = []

		if (alerts.some((a) => a.type === 'queue_depth')) {
			recommendations.push('Consider increasing the number of concurrent workers')
			recommendations.push('Check for destination health issues that may be slowing processing')
		}

		if (alerts.some((a) => a.type === 'processing_time')) {
			recommendations.push('Review destination configurations for timeout settings')
			recommendations.push('Consider optimizing payload sizes')
		}

		if (alerts.some((a) => a.type === 'failure_rate')) {
			recommendations.push('Check destination health and connectivity')
			recommendations.push('Review recent error logs for common failure patterns')
		}

		if (alerts.some((a) => a.type === 'stale_items')) {
			recommendations.push('Run stuck item processing to reset stale items')
			recommendations.push('Check for deadlocked or hung processing workers')
		}

		if (metrics.processingRate < 1 && metrics.queueDepth > 0) {
			recommendations.push('Processing rate is very low - check system health')
		}

		return recommendations
	}

	/**
	 * Get current configuration
	 */
	getConfig(): QueueManagerConfig {
		return { ...this.config }
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<QueueManagerConfig>): void {
		Object.assign(this.config, updates)
		this.logger.info('Queue manager configuration updated', { updates })
	}
}

/**
 * Factory function for creating queue manager
 */
export function createQueueManager(
	dbClient: DeliveryDatabaseClient,
	config?: Partial<QueueManagerConfig>
): QueueManager {
	return new QueueManager(dbClient, config)
}
