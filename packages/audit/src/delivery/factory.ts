/**
 * Service Factory and Dependency Injection - Configurable service creation
 * Requirements 1.1, 6.1, 6.2, 6.3, 6.4: Service lifecycle management and dependency injection
 */

import { StructuredLogger } from '@repo/logs'

import { createAlertManager } from './alert-manager.js'
import { createDeliveryAPI } from './api.js'
import { createCircuitBreaker } from './circuit-breaker.js'
import { createDeliveryDatabaseClient } from './database-client.js'
import { createDeliveryScheduler } from './delivery-scheduler.js'
import { createDeliveryService } from './delivery-service.js'
import { createDestinationManager } from './destination-manager.js'
import { createHealthMonitor } from './health-monitor.js'
import {
	createDeliveryObservabilityStack,
	DEFAULT_DELIVERY_OBSERVABILITY_CONFIG,
} from './observability/index.js'
import { createRetryManager } from './retry-manager.js'

import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'
import type { AlertManager } from './alert-manager.js'
import type { DeliveryAPI } from './api.js'
import type { CircuitBreaker } from './circuit-breaker.js'
import type { DeliveryDatabaseClient } from './database-client.js'
import type { DeliveryScheduler } from './delivery-scheduler.js'
import type { DeliveryService, DeliveryServiceConfig } from './delivery-service.js'
import type { IDestinationManager } from './destination-manager.js'
import type { HealthMonitor, HealthMonitorConfig } from './health-monitor.js'
import type {
	DeliveryObservabilityConfig,
	IDeliveryMetricsCollector,
	IDeliveryPerformanceMonitor,
	IDeliveryTracer,
} from './observability/index.js'
import type { RetryManager, RetryManagerConfig } from './retry-manager.js'

/**
 * Configuration for the delivery service factory
 */
export interface DeliveryServiceFactoryConfig {
	// Core service configuration
	deliveryService?: Partial<DeliveryServiceConfig>

	// Component configurations
	healthMonitor?: Partial<HealthMonitorConfig>
	retryManager?: Partial<RetryManagerConfig>

	// Feature flags
	enableHealthMonitoring?: boolean
	enableObservability?: boolean
	enableAlerting?: boolean
	enableScheduler?: boolean

	// Observability configuration
	observability?: Partial<DeliveryObservabilityConfig>

	// Environment-specific settings
	environment?: 'development' | 'staging' | 'production'
	logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Default factory configuration
 */
export const DEFAULT_FACTORY_CONFIG: DeliveryServiceFactoryConfig = {
	enableHealthMonitoring: true,
	enableObservability: true,
	enableAlerting: true,
	enableScheduler: true,
	environment: 'development',
	logLevel: 'info',
}

/**
 * Dependency container for delivery service components
 */
export interface DeliveryServiceContainer {
	// Core components
	databaseClient: DeliveryDatabaseClient
	deliveryService: DeliveryService
	destinationManager: IDestinationManager
	deliveryScheduler: DeliveryScheduler
	retryManager: RetryManager
	circuitBreaker: CircuitBreaker

	// Optional components
	healthMonitor?: HealthMonitor
	alertManager?: AlertManager
	api?: DeliveryAPI

	// Observability components
	observability?: {
		tracer: IDeliveryTracer
		metricsCollector: IDeliveryMetricsCollector
		performanceMonitor: IDeliveryPerformanceMonitor
		initialize(): Promise<void>
		shutdown(): Promise<void>
	}

	// Lifecycle methods
	start(): Promise<void>
	stop(): Promise<void>
	healthCheck(): Promise<{ healthy: boolean; details: any }>
	getStatus(): ServiceStatus
}

/**
 * Service status information
 */
export interface ServiceStatus {
	status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
	startedAt?: string
	stoppedAt?: string
	uptime?: number
	components: {
		[key: string]: {
			status: 'healthy' | 'unhealthy' | 'disabled'
			lastCheck?: string
			details?: any
		}
	}
	config: DeliveryServiceFactoryConfig
	version: string
}

/**
 * Service factory for creating and managing delivery service components
 */
export class DeliveryServiceFactory {
	private readonly logger: StructuredLogger
	private readonly config: DeliveryServiceFactoryConfig
	private readonly version = '1.0.0'

	constructor(config: Partial<DeliveryServiceFactoryConfig> = {}) {
		this.config = { ...DEFAULT_FACTORY_CONFIG, ...config }

		this.logger = new StructuredLogger({
			service: '@repo/audit - DeliveryServiceFactory',
			environment: this.config.environment || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: this.config.logLevel || 'info',
			},
		})
	}

	/**
	 * Create a complete delivery service container with all dependencies
	 */
	async createContainer(
		enhancedClient: EnhancedAuditDatabaseClient
	): Promise<DeliveryServiceContainer> {
		this.logger.info('Creating delivery service container', {
			config: this.config,
			version: this.version,
		})

		try {
			// Create core components
			const databaseClient = createDeliveryDatabaseClient(enhancedClient)
			const destinationManager = createDestinationManager(databaseClient)
			const retryManager = createRetryManager(databaseClient, this.config.retryManager)
			const circuitBreaker = createCircuitBreaker(databaseClient)
			const deliveryScheduler = createDeliveryScheduler(databaseClient)

			// Create delivery service
			const deliveryService = createDeliveryService(enhancedClient, this.config.deliveryService)

			// Create optional components
			let healthMonitor: HealthMonitor | undefined
			let alertManager: AlertManager | undefined
			let observability: any | undefined
			let api: DeliveryAPI | undefined

			if (this.config.enableHealthMonitoring) {
				healthMonitor = createHealthMonitor(databaseClient, this.config.healthMonitor)
			}

			if (this.config.enableAlerting) {
				alertManager = createAlertManager(databaseClient)
			}

			if (this.config.enableObservability) {
				const observabilityConfig = {
					...DEFAULT_DELIVERY_OBSERVABILITY_CONFIG,
					...this.config.observability,
				}
				observability = createDeliveryObservabilityStack(observabilityConfig)
			}

			// Create API interface
			api = createDeliveryAPI(deliveryService)

			// Create container
			const container = new DeliveryServiceContainerImpl(
				{
					databaseClient,
					deliveryService,
					destinationManager,
					deliveryScheduler,
					retryManager,
					circuitBreaker,
					healthMonitor,
					alertManager,
					api,
					observability,
				},
				this.config,
				this.version,
				this.logger
			)

			this.logger.info('Delivery service container created successfully', {
				components: Object.keys(container).filter(
					(key) => !key.startsWith('_') && typeof (container as any)[key] !== 'function'
				),
				enabledFeatures: {
					healthMonitoring: !!healthMonitor,
					alerting: !!alertManager,
					observability: !!observability,
					scheduler: this.config.enableScheduler,
				},
			})

			return container
		} catch (error) {
			this.logger.error('Failed to create delivery service container', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Create a minimal delivery service for basic operations
	 */
	async createMinimalService(
		enhancedClient: EnhancedAuditDatabaseClient
	): Promise<DeliveryService> {
		this.logger.info('Creating minimal delivery service')

		try {
			const deliveryService = createDeliveryService(enhancedClient, {
				enableHealthMonitoring: false,
				enableObservability: false,
			})

			this.logger.info('Minimal delivery service created successfully')
			return deliveryService
		} catch (error) {
			this.logger.error('Failed to create minimal delivery service', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Validate configuration before creating services
	 */
	validateConfig(): { valid: boolean; errors: string[] } {
		const errors: string[] = []

		// Validate environment
		if (
			this.config.environment &&
			!['development', 'staging', 'production'].includes(this.config.environment)
		) {
			errors.push('Invalid environment. Must be development, staging, or production')
		}

		// Validate log level
		if (
			this.config.logLevel &&
			!['debug', 'info', 'warn', 'error'].includes(this.config.logLevel)
		) {
			errors.push('Invalid log level. Must be debug, info, warn, or error')
		}

		// Validate observability config if enabled
		if (this.config.enableObservability && this.config.observability) {
			if (
				this.config.observability.serviceName &&
				typeof this.config.observability.serviceName !== 'string'
			) {
				errors.push('Observability service name must be a string')
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): DeliveryServiceFactoryConfig {
		return { ...this.config }
	}

	/**
	 * Update configuration (creates new factory instance)
	 */
	withConfig(updates: Partial<DeliveryServiceFactoryConfig>): DeliveryServiceFactory {
		return new DeliveryServiceFactory({ ...this.config, ...updates })
	}
}

/**
 * Implementation of the delivery service container
 */
class DeliveryServiceContainerImpl implements DeliveryServiceContainer {
	private status: ServiceStatus['status'] = 'stopped'
	private startedAt?: string
	private stoppedAt?: string

	constructor(
		private readonly components: {
			databaseClient: DeliveryDatabaseClient
			deliveryService: DeliveryService
			destinationManager: IDestinationManager
			deliveryScheduler: DeliveryScheduler
			retryManager: RetryManager
			circuitBreaker: CircuitBreaker
			healthMonitor?: HealthMonitor
			alertManager?: AlertManager
			api?: DeliveryAPI
			observability?: any
		},
		private readonly config: DeliveryServiceFactoryConfig,
		private readonly version: string,
		private readonly logger: StructuredLogger
	) {}

	// Component getters
	get databaseClient(): DeliveryDatabaseClient {
		return this.components.databaseClient
	}

	get deliveryService(): DeliveryService {
		return this.components.deliveryService
	}

	get destinationManager(): IDestinationManager {
		return this.components.destinationManager
	}

	get deliveryScheduler(): DeliveryScheduler {
		return this.components.deliveryScheduler
	}

	get retryManager(): RetryManager {
		return this.components.retryManager
	}

	get circuitBreaker(): CircuitBreaker {
		return this.components.circuitBreaker
	}

	get healthMonitor(): HealthMonitor | undefined {
		return this.components.healthMonitor
	}

	get alertManager(): AlertManager | undefined {
		return this.components.alertManager
	}

	get api(): DeliveryAPI | undefined {
		return this.components.api
	}

	get observability() {
		return this.components.observability
	}

	/**
	 * Start all services in the container
	 */
	async start(): Promise<void> {
		if (this.status === 'running') {
			this.logger.warn('Container is already running')
			return
		}

		this.logger.info('Starting delivery service container')
		this.status = 'starting'

		try {
			// Start observability first if enabled
			if (this.components.observability) {
				await this.components.observability.initialize()
			}

			// Start core delivery service
			await this.components.deliveryService.start()

			// Start scheduler if enabled
			if (this.config.enableScheduler) {
				await this.components.deliveryScheduler.start()
			}

			// Start health monitor if enabled
			if (this.components.healthMonitor) {
				this.components.healthMonitor.start()
			}

			this.status = 'running'
			this.startedAt = new Date().toISOString()
			this.stoppedAt = undefined

			this.logger.info('Delivery service container started successfully', {
				startedAt: this.startedAt,
			})
		} catch (error) {
			this.status = 'error'
			this.logger.error('Failed to start delivery service container', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Stop all services in the container
	 */
	async stop(): Promise<void> {
		if (this.status === 'stopped') {
			return
		}

		this.logger.info('Stopping delivery service container')
		this.status = 'stopping'

		try {
			// Stop components in reverse order
			if (this.components.healthMonitor) {
				this.components.healthMonitor.stop()
			}

			if (this.config.enableScheduler) {
				await this.components.deliveryScheduler.stop()
			}

			await this.components.deliveryService.stop()

			if (this.components.observability) {
				await this.components.observability.shutdown()
			}

			this.status = 'stopped'
			this.stoppedAt = new Date().toISOString()

			this.logger.info('Delivery service container stopped successfully', {
				stoppedAt: this.stoppedAt,
			})
		} catch (error) {
			this.status = 'error'
			this.logger.error('Error stopping delivery service container', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Perform health check on all components
	 */
	async healthCheck(): Promise<{ healthy: boolean; details: any }> {
		try {
			const componentHealth: any = {}

			// Check core service health
			const serviceHealth = await this.components.deliveryService.healthCheck()
			componentHealth.deliveryService = serviceHealth

			// Check scheduler health if enabled
			if (this.config.enableScheduler) {
				const schedulerHealth = await this.components.deliveryScheduler.healthCheck()
				componentHealth.deliveryScheduler = schedulerHealth
			}

			// Check database health
			const dbHealth = await this.components.databaseClient.healthCheck()
			componentHealth.database = dbHealth

			// Determine overall health
			const allHealthy = Object.values(componentHealth).every((health: any) => health.healthy)

			return {
				healthy: allHealthy && this.status === 'running',
				details: {
					status: this.status,
					components: componentHealth,
					container: this.getStatus(),
				},
			}
		} catch (error) {
			return {
				healthy: false,
				details: {
					error: error instanceof Error ? error.message : 'Unknown error',
					status: this.status,
				},
			}
		}
	}

	/**
	 * Get current service status
	 */
	getStatus(): ServiceStatus {
		const uptime = this.startedAt ? Date.now() - new Date(this.startedAt).getTime() : undefined

		return {
			status: this.status,
			startedAt: this.startedAt,
			stoppedAt: this.stoppedAt,
			uptime,
			components: {
				deliveryService: { status: 'healthy' },
				destinationManager: { status: 'healthy' },
				deliveryScheduler: { status: this.config.enableScheduler ? 'healthy' : 'disabled' },
				retryManager: { status: 'healthy' },
				circuitBreaker: { status: 'healthy' },
				healthMonitor: { status: this.config.enableHealthMonitoring ? 'healthy' : 'disabled' },
				alertManager: { status: this.config.enableAlerting ? 'healthy' : 'disabled' },
				observability: { status: this.config.enableObservability ? 'healthy' : 'disabled' },
			},
			config: this.config,
			version: this.version,
		}
	}
}

/**
 * Factory function for creating delivery service factory
 */
export function createDeliveryServiceFactory(
	config?: Partial<DeliveryServiceFactoryConfig>
): DeliveryServiceFactory {
	return new DeliveryServiceFactory(config)
}

/**
 * Convenience function for creating a complete delivery service container
 */
export async function createDeliveryServiceContainer(
	enhancedClient: EnhancedAuditDatabaseClient,
	config?: Partial<DeliveryServiceFactoryConfig>
): Promise<DeliveryServiceContainer> {
	const factory = createDeliveryServiceFactory(config)
	return factory.createContainer(enhancedClient)
}

/**
 * Convenience function for creating a minimal delivery service
 */
export async function createMinimalDeliveryService(
	enhancedClient: EnhancedAuditDatabaseClient
): Promise<DeliveryService> {
	const factory = createDeliveryServiceFactory({
		enableHealthMonitoring: false,
		enableObservability: false,
		enableAlerting: false,
		enableScheduler: false,
	})
	return factory.createMinimalService(enhancedClient)
}
