/**
 * Main Delivery Service - Orchestrates destination management and health monitoring
 * Requirements 1.1, 1.2, 1.3, 1.4, 3.4, 3.5: Complete destination management system
 */

import { StructuredLogger } from '@repo/logs'

import { createDeliveryDatabaseClient } from './database-client.js'
import { createDeliveryScheduler } from './delivery-scheduler.js'
import { createDestinationManager } from './destination-manager.js'
import { createHealthMonitor } from './health-monitor.js'
import {
	createDeliveryObservabilityStack,
	DEFAULT_DELIVERY_OBSERVABILITY_CONFIG,
} from './observability/index.js'
import { createRetryManager } from './retry-manager.js'

import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'
import type { DeliveryDatabaseClient } from './database-client.js'
import type { IDestinationManager } from './destination-manager.js'
import type { HealthMonitor, HealthMonitorConfig } from './health-monitor.js'
import type { IDeliveryScheduler, IRetryManager } from './interfaces.js'
import type {
	DeliveryObservabilityConfig,
	IDeliveryMetricsCollector,
	IDeliveryPerformanceMonitor,
	IDeliveryTracer,
} from './observability/index.js'
import type {
	ConnectionTestResult,
	CreateDeliveryDestinationInput,
	DeliveryDestination,
	DeliveryDestinationListOptions,
	DeliveryDestinationListResponse,
	DeliveryListOptions,
	DeliveryListResponse,
	DeliveryMetrics,
	DeliveryRequest,
	DeliveryResponse,
	DeliveryStatusResponse,
	DestinationHealth,
	MetricsOptions,
	UpdateDeliveryDestinationInput,
	ValidationResult,
} from './types.js'

/**
 * Configuration for the delivery service
 */
export interface DeliveryServiceConfig {
	healthMonitor?: Partial<HealthMonitorConfig>
	enableHealthMonitoring?: boolean
	observability?: Partial<DeliveryObservabilityConfig>
	enableObservability?: boolean
}

/**
 * Main delivery service interface
 */
export interface IDeliveryService {
	// Destination management
	createDestination(input: CreateDeliveryDestinationInput): Promise<DeliveryDestination>
	updateDestination(id: string, input: UpdateDeliveryDestinationInput): Promise<DeliveryDestination>
	deleteDestination(id: string): Promise<void>
	getDestination(id: string): Promise<DeliveryDestination | null>
	listDestinations(
		options: DeliveryDestinationListOptions
	): Promise<DeliveryDestinationListResponse>

	// Delivery operations - Requirements 2.1, 2.2, 2.3, 2.4, 2.5
	deliver(request: DeliveryRequest): Promise<DeliveryResponse>
	retryDelivery(deliveryId: string): Promise<DeliveryResponse>
	getDeliveryStatus(deliveryId: string): Promise<DeliveryStatusResponse>
	listDeliveries(options: DeliveryListOptions): Promise<DeliveryListResponse>

	// Validation and testing
	validateDestination(destination: DeliveryDestination): Promise<ValidationResult>
	testConnection(destination: DeliveryDestination): Promise<ConnectionTestResult>

	// Health monitoring
	getDestinationHealth(destinationId: string): Promise<DestinationHealth | null>
	getUnhealthyDestinations(): Promise<DestinationHealth[]>
	shouldAllowDelivery(destinationId: string): Promise<boolean>
	getDeliveryMetrics(options: MetricsOptions): Promise<DeliveryMetrics>

	// Service lifecycle
	start(): Promise<void>
	stop(): Promise<void>
	healthCheck(): Promise<{ healthy: boolean; details: any }>
}

/**
 * Main delivery service implementation
 */
export class DeliveryService implements IDeliveryService {
	private readonly logger: StructuredLogger
	private readonly dbClient: DeliveryDatabaseClient
	private readonly destinationManager: IDestinationManager
	private readonly healthMonitor: HealthMonitor
	private readonly deliveryScheduler: IDeliveryScheduler
	private readonly retryManager: IRetryManager
	private readonly config: DeliveryServiceConfig
	private readonly observabilityStack?: {
		tracer: IDeliveryTracer
		metricsCollector: IDeliveryMetricsCollector
		performanceMonitor: IDeliveryPerformanceMonitor
		initialize(): Promise<void>
		shutdown(): Promise<void>
	}
	private isStarted = false

	constructor(enhancedClient: EnhancedAuditDatabaseClient, config: DeliveryServiceConfig = {}) {
		this.logger = new StructuredLogger({
			service: '@repo/audit - DeliveryService',
			environment: process.env.NODE_ENV || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})

		this.config = {
			enableHealthMonitoring: true,
			enableObservability: true,
			...config,
		}

		// Initialize components
		this.dbClient = createDeliveryDatabaseClient(enhancedClient)
		this.destinationManager = createDestinationManager(this.dbClient)
		this.healthMonitor = createHealthMonitor(this.dbClient, config.healthMonitor)
		this.deliveryScheduler = createDeliveryScheduler(this.dbClient)
		this.retryManager = createRetryManager(this.dbClient)

		// Initialize observability stack if enabled
		if (this.config.enableObservability) {
			const observabilityConfig = {
				...DEFAULT_DELIVERY_OBSERVABILITY_CONFIG,
				...config.observability,
			}
			this.observabilityStack = createDeliveryObservabilityStack(observabilityConfig)
		}
	}

	/**
	 * Start the delivery service
	 */
	async start(): Promise<void> {
		if (this.isStarted) {
			this.logger.warn('Delivery service is already started')
			return
		}

		this.logger.info('Starting delivery service', {
			enableHealthMonitoring: this.config.enableHealthMonitoring,
		})

		try {
			// Start observability stack if enabled
			if (this.config.enableObservability && this.observabilityStack) {
				await this.observabilityStack.initialize()
			}

			// Start health monitoring if enabled
			if (this.config.enableHealthMonitoring) {
				this.healthMonitor.start()
			}

			this.isStarted = true
			this.logger.info('Delivery service started successfully', {
				observabilityEnabled: this.config.enableObservability,
				healthMonitoringEnabled: this.config.enableHealthMonitoring,
			})
		} catch (error) {
			this.logger.error('Failed to start delivery service', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Stop the delivery service
	 */
	async stop(): Promise<void> {
		if (!this.isStarted) {
			return
		}

		this.logger.info('Stopping delivery service')

		try {
			// Stop health monitoring
			this.healthMonitor.stop()

			// Stop observability stack if enabled
			if (this.config.enableObservability && this.observabilityStack) {
				await this.observabilityStack.shutdown()
			}

			this.isStarted = false
			this.logger.info('Delivery service stopped successfully')
		} catch (error) {
			this.logger.error('Error stopping delivery service', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Health check for the delivery service
	 */
	async healthCheck(): Promise<{ healthy: boolean; details: any }> {
		try {
			const dbHealth = await this.dbClient.healthCheck()
			const unhealthyDestinations = await this.getUnhealthyDestinations()

			const healthy = dbHealth.healthy && unhealthyDestinations.length < 10

			return {
				healthy,
				details: {
					database: dbHealth,
					service: {
						started: this.isStarted,
						healthMonitoringEnabled: this.config.enableHealthMonitoring,
					},
					destinations: {
						unhealthyCount: unhealthyDestinations.length,
					},
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

	// Destination management methods - delegate to destination manager

	async createDestination(input: CreateDeliveryDestinationInput): Promise<DeliveryDestination> {
		return this.destinationManager.createDestination(input)
	}

	async updateDestination(
		id: string,
		input: UpdateDeliveryDestinationInput
	): Promise<DeliveryDestination> {
		return this.destinationManager.updateDestination(id, input)
	}

	async deleteDestination(id: string): Promise<void> {
		return this.destinationManager.deleteDestination(id)
	}

	async getDestination(id: string): Promise<DeliveryDestination | null> {
		return this.destinationManager.getDestination(id)
	}

	async listDestinations(
		options: DeliveryDestinationListOptions
	): Promise<DeliveryDestinationListResponse> {
		return this.destinationManager.listDestinations(options)
	}

	async validateDestination(destination: DeliveryDestination): Promise<ValidationResult> {
		return this.destinationManager.validateDestination(destination)
	}

	async testConnection(destination: DeliveryDestination): Promise<ConnectionTestResult> {
		return this.destinationManager.testConnection(destination)
	}

	// Health monitoring methods - delegate to health monitor

	async getDestinationHealth(destinationId: string): Promise<DestinationHealth | null> {
		return this.healthMonitor.getDestinationHealth(destinationId)
	}

	async getUnhealthyDestinations(): Promise<DestinationHealth[]> {
		return this.healthMonitor.getUnhealthyDestinations()
	}

	async shouldAllowDelivery(destinationId: string): Promise<boolean> {
		return this.healthMonitor.shouldAllowDelivery(destinationId)
	}

	/**
	 * Record a successful delivery (for health monitoring and metrics)
	 */
	async recordDeliverySuccess(
		destinationId: string,
		responseTime: number,
		organizationId?: string,
		destinationType?: string
	): Promise<void> {
		await this.healthMonitor.recordSuccess(destinationId, responseTime)
		await this.healthMonitor.updateCircuitBreakerState(destinationId, true, responseTime)

		// Record metrics if observability is enabled
		if (
			this.config.enableObservability &&
			this.observabilityStack &&
			organizationId &&
			destinationType
		) {
			this.observabilityStack.metricsCollector.recordDeliveryAttempt(
				organizationId,
				destinationType,
				true,
				responseTime
			)
			this.observabilityStack.performanceMonitor.recordDestinationPerformance(
				destinationId,
				destinationType,
				responseTime,
				true
			)
		}
	}

	/**
	 * Record a failed delivery (for health monitoring and metrics)
	 */
	async recordDeliveryFailure(
		destinationId: string,
		error: string,
		organizationId?: string,
		destinationType?: string
	): Promise<void> {
		await this.healthMonitor.recordFailure(destinationId, error)
		await this.healthMonitor.updateCircuitBreakerState(destinationId, false)

		// Record metrics if observability is enabled
		if (
			this.config.enableObservability &&
			this.observabilityStack &&
			organizationId &&
			destinationType
		) {
			this.observabilityStack.metricsCollector.recordDeliveryAttempt(
				organizationId,
				destinationType,
				false,
				0
			)
			this.observabilityStack.metricsCollector.recordDestinationFailure(
				destinationId,
				destinationType,
				error
			)
			this.observabilityStack.performanceMonitor.recordDestinationPerformance(
				destinationId,
				destinationType,
				0,
				false
			)
		}
	}

	// Delivery orchestration methods - Requirements 2.1, 2.2, 2.3, 2.4, 2.5

	/**
	 * Deliver content to one or multiple destinations with fanout support
	 * Requirements 2.1, 2.2, 2.3, 2.4, 2.5: Multi-destination delivery orchestration
	 */
	async deliver(request: DeliveryRequest): Promise<DeliveryResponse> {
		const deliveryId = this.generateDeliveryId()

		this.logger.info('Starting delivery orchestration', {
			deliveryId,
			organizationId: request.organizationId,
			destinationCount: Array.isArray(request.destinations)
				? request.destinations.length
				: 'default',
			payloadType: request.payload.type,
			correlationId: request.options?.correlationId,
		})

		try {
			// Validate delivery request
			await this.validateDeliveryRequest(request)

			// Resolve destinations
			const destinations = await this.resolveDestinations(request)

			if (destinations.length === 0) {
				throw new Error('No valid destinations found for delivery')
			}

			// Create delivery response structure
			const response: DeliveryResponse = {
				deliveryId,
				status: 'queued',
				destinations: destinations.map((dest) => ({
					destinationId: dest.id,
					status: 'pending',
				})),
				queuedAt: new Date().toISOString(),
			}

			// Schedule delivery for each destination independently
			const schedulingPromises = destinations.map(async (destination) => {
				try {
					// Check if destination is healthy and allowed for delivery
					const canDeliver = await this.shouldAllowDelivery(destination.id)
					if (!canDeliver) {
						this.logger.warn('Destination not healthy, skipping delivery', {
							deliveryId,
							destinationId: destination.id,
						})

						// Update response to reflect skipped destination
						const destResponse = response.destinations.find(
							(d) => d.destinationId === destination.id
						)
						if (destResponse) {
							destResponse.status = 'failed'
						}
						return
					}

					// Create delivery payload
					const payload = {
						deliveryId,
						organizationId: request.organizationId,
						type: request.payload.type,
						data: request.payload.data,
						metadata: {
							...request.payload.metadata,
							destinationId: destination.id,
							destinationType: destination.type,
						},
						correlationId: request.options?.correlationId,
						idempotencyKey:
							request.options?.idempotencyKey ||
							this.generateIdempotencyKey(deliveryId, destination.id),
					}

					// Schedule the delivery
					await this.deliveryScheduler.scheduleDelivery({
						...request,
						destinations: [destination.id], // Single destination for this queue item
						payload,
					})

					// Update destination usage
					await this.dbClient.destinations.incrementUsage(destination.id)

					this.logger.debug('Delivery scheduled for destination', {
						deliveryId,
						destinationId: destination.id,
						destinationType: destination.type,
					})
				} catch (error) {
					this.logger.error('Failed to schedule delivery for destination', {
						deliveryId,
						destinationId: destination.id,
						error: error instanceof Error ? error.message : 'Unknown error',
					})

					// Update response to reflect failure
					const destResponse = response.destinations.find((d) => d.destinationId === destination.id)
					if (destResponse) {
						destResponse.status = 'failed'
					}
				}
			})

			// Wait for all scheduling to complete
			await Promise.allSettled(schedulingPromises)

			// Update overall status based on destination statuses
			const hasAnyPending = response.destinations.some((d) => d.status === 'pending')
			const hasAnyFailed = response.destinations.some((d) => d.status === 'failed')

			if (hasAnyPending) {
				response.status = 'queued'
			} else if (hasAnyFailed) {
				response.status = 'failed'
			} else {
				response.status = 'completed'
			}

			this.logger.info('Delivery orchestration completed', {
				deliveryId,
				status: response.status,
				destinationCount: destinations.length,
				pendingCount: response.destinations.filter((d) => d.status === 'pending').length,
				failedCount: response.destinations.filter((d) => d.status === 'failed').length,
			})

			return response
		} catch (error) {
			this.logger.error('Delivery orchestration failed', {
				deliveryId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			return {
				deliveryId,
				status: 'failed',
				destinations: [],
				queuedAt: new Date().toISOString(),
			}
		}
	}

	/**
	 * Retry a failed delivery
	 * Requirements 2.4, 3.1, 3.2, 3.3: Retry management and coordination
	 */
	async retryDelivery(deliveryId: string): Promise<DeliveryResponse> {
		this.logger.info('Retrying delivery', { deliveryId })

		try {
			// Get current delivery status
			const currentStatus = await this.getDeliveryStatus(deliveryId)

			// Find failed destinations that can be retried
			const retryableDestinations: typeof currentStatus.destinations = []
			for (const dest of currentStatus.destinations) {
				if (dest.status === 'failed') {
					const canRetry = await this.retryManager.shouldRetry(
						deliveryId,
						new Error(dest.failureReason || 'Unknown error')
					)
					if (canRetry) {
						retryableDestinations.push(dest)
					}
				}
			}

			if (retryableDestinations.length === 0) {
				this.logger.warn('No retryable destinations found for delivery', { deliveryId })
				return {
					deliveryId,
					status: 'failed',
					destinations: currentStatus.destinations.map((dest) => ({
						destinationId: dest.destinationId,
						status: dest.status,
					})),
					queuedAt: new Date().toISOString(),
				}
			}

			// Schedule retries for each retryable destination
			const retryPromises = retryableDestinations.map(async (dest) => {
				const backoffDelay = this.retryManager.calculateBackoff(dest.attempts)
				await this.deliveryScheduler.scheduleRetry(deliveryId, backoffDelay)
			})

			await Promise.allSettled(retryPromises)

			// Return updated response
			return {
				deliveryId,
				status: 'queued',
				destinations: currentStatus.destinations.map((dest) => ({
					destinationId: dest.destinationId,
					status: retryableDestinations.some((r) => r.destinationId === dest.destinationId)
						? 'pending'
						: dest.status,
				})),
				queuedAt: new Date().toISOString(),
			}
		} catch (error) {
			this.logger.error('Failed to retry delivery', {
				deliveryId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Get delivery status with detailed tracking information
	 * Requirements 9.1, 9.2, 9.3, 9.4: Status tracking and cross-system references
	 */
	async getDeliveryStatus(deliveryId: string): Promise<DeliveryStatusResponse> {
		try {
			// Get delivery logs for this delivery ID
			const deliveryLogs = await this.dbClient.logs.findByDeliveryId(deliveryId)

			if (deliveryLogs.length === 0) {
				throw new Error(`Delivery not found: ${deliveryId}`)
			}

			// Aggregate status from all destination deliveries
			const destinations = deliveryLogs.map((log) => ({
				destinationId: log.destinations[0]?.destinationId || 'unknown',
				status: this.mapOverallStatusToDestinationStatus(log.status),
				attempts: log.destinations[0]?.attempts || 0,
				lastAttemptAt: log.destinations[0]?.lastAttemptAt,
				deliveredAt: log.destinations[0]?.deliveredAt,
				failureReason: log.destinations[0]?.failureReason,
				crossSystemReference: log.destinations[0]?.crossSystemReference,
			}))

			// Determine overall status
			let overallStatus: 'queued' | 'processing' | 'completed' | 'failed' = 'completed'

			const hasProcessing = destinations.some((d) => d.status === 'retrying')
			const hasPending = destinations.some((d) => d.status === 'pending')
			const hasFailed = destinations.some((d) => d.status === 'failed')
			const allCompleted = destinations.every((d) => d.status === 'delivered')

			if (hasProcessing) {
				overallStatus = 'processing'
			} else if (hasPending) {
				overallStatus = 'queued'
			} else if (hasFailed && !allCompleted) {
				overallStatus = 'failed'
			}

			// Get the earliest created and latest updated timestamps
			const createdAt = Math.min(...deliveryLogs.map((log) => new Date(log.createdAt).getTime()))
			const updatedAt = Math.max(...deliveryLogs.map((log) => new Date(log.updatedAt).getTime()))

			return {
				deliveryId,
				status: overallStatus,
				destinations,
				createdAt: new Date(createdAt).toISOString(),
				updatedAt: new Date(updatedAt).toISOString(),
				metadata: deliveryLogs[0]?.metadata || {},
			}
		} catch (error) {
			this.logger.error('Failed to get delivery status', {
				deliveryId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * List deliveries with filtering and pagination
	 * Requirements 2.5, 9.1, 9.2: Delivery history and tracking
	 */
	async listDeliveries(options: DeliveryListOptions): Promise<DeliveryListResponse> {
		try {
			return await this.dbClient.logs.list(options)
		} catch (error) {
			this.logger.error('Failed to list deliveries', {
				options: JSON.stringify(options),
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Get delivery metrics for monitoring and analytics
	 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: Observability and metrics
	 */
	/**
	 * Get the observability stack for advanced metrics access
	 */
	getObservabilityStack() {
		return this.observabilityStack
	}

	/**
	 * Get delivery metrics for monitoring and analytics
	 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: Observability and metrics
	 */
	async getDeliveryMetrics(options: MetricsOptions): Promise<DeliveryMetrics> {
		try {
			// Use real metrics from observability stack if available
			if (this.config.enableObservability && this.observabilityStack) {
				const metricsSnapshot = await this.observabilityStack.metricsCollector.getMetricsSnapshot()
				const customMetrics = await this.observabilityStack.metricsCollector.getCustomMetrics()

				// Calculate totals from real metrics
				const totalDeliveries = metricsSnapshot.deliveries_total
				const successfulDeliveries = metricsSnapshot.deliveries_successful
				const failedDeliveries = metricsSnapshot.deliveries_failed

				// Calculate success rate
				const successRate =
					totalDeliveries > 0 ? ((successfulDeliveries / totalDeliveries) * 100).toFixed(2) : '0.00'

				// Calculate average delivery time from performance percentiles
				const averageDeliveryTime = metricsSnapshot.performance_percentiles.p50 || 0

				// Build destination type metrics from real data
				const byDestinationType: Record<string, any> = {}
				for (const [type, stats] of Object.entries(metricsSnapshot.by_destination_type)) {
					byDestinationType[type] = {
						total: stats.total,
						successful: stats.successful,
						failed: stats.failed,
						successRate:
							stats.total > 0 ? ((stats.successful / stats.total) * 100).toFixed(2) : '0.00',
						averageTime: stats.avg_duration_ms,
					}
				}

				// Build organization metrics from real data
				const byOrganization: Record<string, any> = {}
				for (const [org, stats] of Object.entries(metricsSnapshot.by_organization)) {
					byOrganization[org] = {
						total: stats.total,
						successful: stats.successful,
						failed: stats.failed,
						successRate:
							stats.total > 0 ? ((stats.successful / stats.total) * 100).toFixed(2) : '0.00',
					}
				}

				// If filtering by organization, only include that organization's data
				if (options.organizationId) {
					const orgStats = byOrganization[options.organizationId]
					if (orgStats) {
						return {
							totalDeliveries: orgStats.total,
							successfulDeliveries: orgStats.successful,
							failedDeliveries: orgStats.failed,
							successRate: orgStats.successRate,
							averageDeliveryTime,
							byDestinationType,
							byOrganization: { [options.organizationId]: orgStats },
							timeRange: {
								start:
									options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
								end: options.endDate || new Date().toISOString(),
							},
						}
					}
				}

				return {
					totalDeliveries,
					successfulDeliveries,
					failedDeliveries,
					successRate,
					averageDeliveryTime,
					byDestinationType,
					byOrganization,
					timeRange: {
						start: options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
						end: options.endDate || new Date().toISOString(),
					},
				}
			}

			// Fallback to database-based metrics if observability is disabled
			// This would query delivery logs from the database
			let deliveryLogs
			try {
				deliveryLogs = await this.dbClient.logs.list({
					organizationId: options.organizationId,
					startDate: options.startDate,
					endDate: options.endDate,
					limit: 10000, // Large limit to get comprehensive data
				})
			} catch (dbError) {
				this.logger.error('Failed to get delivery metrics from database', {
					error:
						dbError instanceof Error
							? { name: dbError.name, message: dbError.message, stack: dbError.stack }
							: 'Failed to get delivery metrics from database',
				})
				// Return empty metrics if database query fails
				return {
					totalDeliveries: 0,
					successfulDeliveries: 0,
					failedDeliveries: 0,
					successRate: '0.00',
					averageDeliveryTime: 0,
					byDestinationType: {},
					byOrganization: {},
					timeRange: {
						start: options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
						end: options.endDate || new Date().toISOString(),
					},
				}
			}

			// Aggregate metrics from delivery logs
			const totalDeliveries = deliveryLogs.totalCount
			let successfulDeliveries = 0
			let failedDeliveries = 0
			const destinationTypeStats: Record<
				string,
				{ total: number; successful: number; failed: number; totalTime: number }
			> = {}
			const organizationStats: Record<
				string,
				{ total: number; successful: number; failed: number }
			> = {}

			// Process delivery logs to calculate metrics
			for (const delivery of deliveryLogs.deliveries) {
				const isSuccessful = delivery.status === 'completed'

				if (isSuccessful) {
					successfulDeliveries++
				} else {
					failedDeliveries++
				}

				// Aggregate by destination (assuming we can get destination info from metadata)
				for (const dest of delivery.destinations) {
					const destType = dest.destinationId ? 'webhook' : 'unknown' // Simplified - would need actual destination type lookup

					if (!destinationTypeStats[destType]) {
						destinationTypeStats[destType] = { total: 0, successful: 0, failed: 0, totalTime: 0 }
					}

					destinationTypeStats[destType].total++
					if (dest.status === 'delivered') {
						destinationTypeStats[destType].successful++
					} else {
						destinationTypeStats[destType].failed++
					}
				}

				// Aggregate by organization
				const orgId = options.organizationId || 'default'
				if (!organizationStats[orgId]) {
					organizationStats[orgId] = { total: 0, successful: 0, failed: 0 }
				}

				organizationStats[orgId].total++
				if (isSuccessful) {
					organizationStats[orgId].successful++
				} else {
					organizationStats[orgId].failed++
				}
			}

			// Build response format
			const byDestinationType: Record<string, any> = {}
			for (const [type, stats] of Object.entries(destinationTypeStats)) {
				byDestinationType[type] = {
					total: stats.total,
					successful: stats.successful,
					failed: stats.failed,
					successRate:
						stats.total > 0 ? ((stats.successful / stats.total) * 100).toFixed(2) : '0.00',
					averageTime: stats.total > 0 ? stats.totalTime / stats.total : 0,
				}
			}

			const byOrganization: Record<string, any> = {}
			for (const [org, stats] of Object.entries(organizationStats)) {
				byOrganization[org] = {
					total: stats.total,
					successful: stats.successful,
					failed: stats.failed,
					successRate:
						stats.total > 0 ? ((stats.successful / stats.total) * 100).toFixed(2) : '0.00',
				}
			}

			return {
				totalDeliveries,
				successfulDeliveries,
				failedDeliveries,
				successRate:
					totalDeliveries > 0
						? ((successfulDeliveries / totalDeliveries) * 100).toFixed(2)
						: '0.00',
				averageDeliveryTime: 2500, // Would calculate from actual delivery times
				byDestinationType,
				byOrganization,
				timeRange: {
					start: options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
					end: options.endDate || new Date().toISOString(),
				},
			}
		} catch (error) {
			this.logger.error('Failed to get delivery metrics', {
				options: JSON.stringify(options),
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	// Private helper methods

	/**
	 * Generate a unique delivery ID
	 */
	private generateDeliveryId(): string {
		return `del_${Date.now()}_${Math.random().toString(36).substring(2)}`
	}

	/**
	 * Generate an idempotency key for a delivery
	 */
	private generateIdempotencyKey(deliveryId: string, destinationId: string): string {
		return `${deliveryId}_${destinationId}`
	}

	/**
	 * Validate delivery request
	 * Requirements 2.1, 2.2: Request validation and processing
	 */
	private async validateDeliveryRequest(request: DeliveryRequest): Promise<void> {
		if (!request.organizationId) {
			throw new Error('Organization ID is required')
		}

		if (!request.payload || !request.payload.type || !request.payload.data) {
			throw new Error('Payload with type and data is required')
		}

		if (
			!request.destinations ||
			(Array.isArray(request.destinations) && request.destinations.length === 0)
		) {
			throw new Error('At least one destination is required')
		}

		// Validate payload size (example: 10MB limit)
		const payloadSize = JSON.stringify(request.payload.data).length
		if (payloadSize > 10 * 1024 * 1024) {
			throw new Error('Payload size exceeds maximum limit of 10MB')
		}

		// Validate priority if specified
		if (request.options?.priority !== undefined) {
			if (request.options.priority < 0 || request.options.priority > 10) {
				throw new Error('Priority must be between 0 and 10')
			}
		}
	}

	/**
	 * Map overall delivery status to destination status
	 */
	private mapOverallStatusToDestinationStatus(
		overallStatus: 'queued' | 'processing' | 'completed' | 'failed'
	): 'pending' | 'delivered' | 'failed' | 'retrying' {
		switch (overallStatus) {
			case 'queued':
				return 'pending'
			case 'processing':
				return 'retrying'
			case 'completed':
				return 'delivered'
			case 'failed':
				return 'failed'
			default:
				return 'pending'
		}
	}

	/**
	 * Resolve destinations from request
	 * Requirements 2.3, 6.1, 6.2, 6.3: Default destination management and organization isolation
	 */
	private async resolveDestinations(request: DeliveryRequest): Promise<DeliveryDestination[]> {
		if (request.destinations === 'default') {
			// Use default destinations for the organization
			const defaultDestinations = await this.destinationManager.getDefaultDestinations(
				request.organizationId
			)

			if (defaultDestinations.length === 0) {
				throw new Error('No default destinations configured for organization')
			}

			return defaultDestinations
		}

		// Resolve specific destination IDs
		const destinations: DeliveryDestination[] = []

		for (const destinationId of request.destinations) {
			const destination = await this.getDestination(destinationId)

			if (!destination) {
				this.logger.warn('Destination not found, skipping', { destinationId })
				continue
			}

			// Verify organization access
			if (destination.organizationId !== request.organizationId) {
				this.logger.warn('Cross-organization access denied', {
					destinationId,
					requestOrg: request.organizationId,
					destinationOrg: destination.organizationId,
				})
				continue
			}

			// Skip disabled destinations
			if (destination.disabled) {
				this.logger.warn('Destination is disabled, skipping', { destinationId })
				continue
			}

			destinations.push(destination)
		}

		return destinations
	}
}

/**
 * Factory function for creating delivery service
 */
export function createDeliveryService(
	enhancedClient: EnhancedAuditDatabaseClient,
	config?: DeliveryServiceConfig
): DeliveryService {
	return new DeliveryService(enhancedClient, config)
}
