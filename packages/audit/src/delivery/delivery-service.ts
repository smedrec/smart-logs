/**
 * Main Delivery Service - Orchestrates destination management and health monitoring
 * Requirements 1.1, 1.2, 1.3, 1.4, 3.4, 3.5: Complete destination management system
 */

import { StructuredLogger } from '@repo/logs'

import { createDeliveryDatabaseClient } from './database-client.js'
import { createDestinationManager } from './destination-manager.js'
import { createHealthMonitor } from './health-monitor.js'

import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'
import type { DeliveryDatabaseClient } from './database-client.js'
import type { IDestinationManager } from './destination-manager.js'
import type { HealthMonitor, HealthMonitorConfig } from './health-monitor.js'
import type {
	ConnectionTestResult,
	CreateDeliveryDestinationInput,
	DeliveryDestination,
	DeliveryDestinationListOptions,
	DeliveryDestinationListResponse,
	DestinationHealth,
	UpdateDeliveryDestinationInput,
	ValidationResult,
} from './types.js'

/**
 * Configuration for the delivery service
 */
export interface DeliveryServiceConfig {
	healthMonitor?: Partial<HealthMonitorConfig>
	enableHealthMonitoring?: boolean
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

	// Validation and testing
	validateDestination(destination: DeliveryDestination): Promise<ValidationResult>
	testConnection(destination: DeliveryDestination): Promise<ConnectionTestResult>

	// Health monitoring
	getDestinationHealth(destinationId: string): Promise<DestinationHealth | null>
	getUnhealthyDestinations(): Promise<DestinationHealth[]>
	shouldAllowDelivery(destinationId: string): Promise<boolean>

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
	private readonly config: DeliveryServiceConfig
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
			...config,
		}

		// Initialize components
		this.dbClient = createDeliveryDatabaseClient(enhancedClient)
		this.destinationManager = createDestinationManager(this.dbClient)
		this.healthMonitor = createHealthMonitor(this.dbClient, config.healthMonitor)
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
			// Start health monitoring if enabled
			if (this.config.enableHealthMonitoring) {
				this.healthMonitor.start()
			}

			this.isStarted = true
			this.logger.info('Delivery service started successfully')
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
	 * Record a successful delivery (for health monitoring)
	 */
	async recordDeliverySuccess(destinationId: string, responseTime: number): Promise<void> {
		await this.healthMonitor.recordSuccess(destinationId, responseTime)
		await this.healthMonitor.updateCircuitBreakerState(destinationId, true, responseTime)
	}

	/**
	 * Record a failed delivery (for health monitoring)
	 */
	async recordDeliveryFailure(destinationId: string, error: string): Promise<void> {
		await this.healthMonitor.recordFailure(destinationId, error)
		await this.healthMonitor.updateCircuitBreakerState(destinationId, false)
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
