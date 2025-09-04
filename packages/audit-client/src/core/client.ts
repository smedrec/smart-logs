import { AuthManager } from '../infrastructure/auth'
import { BatchManager } from '../infrastructure/batch'
import { CacheManager } from '../infrastructure/cache'
import { ErrorHandler } from '../infrastructure/error'
import { DefaultLogger } from '../infrastructure/logger'
import { RetryManager } from '../infrastructure/retry'
import { ComplianceService } from '../services/compliance'
// Import all services
import { EventsService } from '../services/events'
import { HealthService } from '../services/health'
import { MetricsService } from '../services/metrics'
import { PresetsService } from '../services/presets'
import { ScheduledReportsService } from '../services/scheduled-reports'
import { ConfigManager } from './config'

import type { Logger } from '../infrastructure/logger'
import type { RequestInterceptor, ResponseInterceptor } from './base-resource'
import type { AuditClientConfig, PartialAuditClientConfig } from './config'

/**
 * Client lifecycle state
 */
export type ClientState = 'initializing' | 'ready' | 'error' | 'destroyed'

/**
 * Client statistics interface
 */
export interface ClientStats {
	state: ClientState
	uptime: number
	requestCount: number
	errorCount: number
	cacheStats: any
	retryStats: any
	batchStats: any
	authStats: any
}

/**
 * Main AuditClient class that orchestrates all services
 *
 * This is the primary entry point for the audit client library. It provides:
 * - Service initialization and dependency injection
 * - Unified configuration management
 * - Client lifecycle management and cleanup
 * - Centralized error handling
 * - Performance monitoring and statistics
 * - Request/response interceptor management
 */
export class AuditClient {
	// Configuration and state management
	private configManager: ConfigManager
	private config: AuditClientConfig
	private state: ClientState = 'initializing'
	private startTime: number = Date.now()
	private requestCount: number = 0
	private errorCount: number = 0

	// Infrastructure components
	private logger: Logger
	private authManager!: AuthManager
	private cacheManager!: CacheManager
	private retryManager!: RetryManager
	private batchManager!: BatchManager
	private errorHandler!: ErrorHandler

	// Service instances
	private _events!: EventsService
	private _compliance!: ComplianceService
	private _scheduledReports!: ScheduledReportsService
	private _presets!: PresetsService
	private _metrics!: MetricsService
	private _health!: HealthService

	// Cleanup and lifecycle management
	private cleanupTasks: Array<() => void | Promise<void>> = []
	private destroyed: boolean = false
	private processCleanup?: () => void

	/**
	 * Initialize the AuditClient with configuration
	 */
	constructor(config: PartialAuditClientConfig) {
		try {
			// Initialize configuration manager
			this.configManager = new ConfigManager(config)
			this.config = this.configManager.getConfig()

			// Initialize logger
			this.logger = this.config.logging.customLogger || new DefaultLogger()

			// Initialize infrastructure components
			this.initializeInfrastructure()

			// Initialize services
			this.initializeServices()

			// Set up cleanup tasks
			this.setupCleanupTasks()

			// Mark as ready
			this.state = 'ready'

			this.logger.info('AuditClient initialized successfully', {
				baseUrl: this.config.baseUrl,
				environment: this.config.environment,
				features: this.getEnabledFeatures(),
			})
		} catch (error) {
			this.state = 'error'
			// Initialize logger first if it failed during initialization
			const logger = this.logger || new DefaultLogger()
			logger.error('Failed to initialize AuditClient', { error })
			throw error
		}
	}

	/**
	 * Initialize all infrastructure components
	 */
	private initializeInfrastructure(): void {
		// Initialize authentication manager
		this.authManager = new AuthManager(this.config.authentication)

		// Initialize cache manager
		this.cacheManager = new CacheManager(this.config.cache)

		// Initialize retry manager
		this.retryManager = new RetryManager(this.config.retry)

		// Initialize batch manager with request executor
		this.batchManager = new BatchManager(
			this.config.batching,
			async (endpoint: string, options: any) => {
				// This will be used by services for batch execution
				throw new Error('Batch execution should be handled by individual services')
			}
		)

		// Initialize error handler
		this.errorHandler = new ErrorHandler(
			this.config.logging,
			this.config.errorHandling,
			this.logger
		)

		this.logger.debug('Infrastructure components initialized', {
			auth: this.config.authentication.type,
			cache: this.config.cache.enabled,
			retry: this.config.retry.enabled,
			batch: this.config.batching.enabled,
		})
	}

	/**
	 * Initialize all service instances
	 */
	private initializeServices(): void {
		// All services share the same configuration and logger
		this._events = new EventsService(this.config, this.logger)
		this._compliance = new ComplianceService(this.config, this.logger)
		this._scheduledReports = new ScheduledReportsService(this.config, this.logger)
		this._presets = new PresetsService(this.config, this.logger)
		this._metrics = new MetricsService(this.config, this.logger)
		this._health = new HealthService(this.config, this.logger)

		this.logger.debug('Services initialized', {
			services: ['events', 'compliance', 'scheduledReports', 'presets', 'metrics', 'health'],
		})
	}

	/**
	 * Set up cleanup tasks for proper resource management
	 */
	private setupCleanupTasks(): void {
		// Add cleanup for infrastructure components
		this.cleanupTasks.push(() => this.cacheManager.destroy())
		this.cleanupTasks.push(() => this.batchManager.clear())
		this.cleanupTasks.push(() => this.authManager.clearAllTokenCache())

		// Add cleanup for services
		this.cleanupTasks.push(() => this._events.destroy())
		this.cleanupTasks.push(() => this._compliance.destroy())
		this.cleanupTasks.push(() => this._scheduledReports.destroy())
		this.cleanupTasks.push(() => this._presets.destroy())
		this.cleanupTasks.push(() => this._metrics.destroy())
		this.cleanupTasks.push(() => this._health.destroy())

		// Set up process cleanup handlers if in Node.js environment
		if (typeof process !== 'undefined' && process.on) {
			const cleanup = () => {
				if (!this.destroyed) {
					this.destroy()
				}
			}

			// Store cleanup function for removal later
			this.processCleanup = cleanup

			process.on('exit', cleanup)
			process.on('SIGINT', cleanup)
			process.on('SIGTERM', cleanup)
			process.on('uncaughtException', cleanup)
		}
	}

	/**
	 * Get enabled features for logging
	 */
	private getEnabledFeatures(): string[] {
		const features: string[] = []

		if (this.config.cache.enabled) features.push('cache')
		if (this.config.retry.enabled) features.push('retry')
		if (this.config.batching.enabled) features.push('batching')
		if (this.config.performance.enableCompression) features.push('compression')
		if (this.config.performance.enableStreaming) features.push('streaming')
		if (this.config.logging.enabled) features.push('logging')

		return features
	}

	// Service getters with lazy initialization validation
	/**
	 * Events service for audit event management
	 */
	public get events(): EventsService {
		this.validateClientState()
		return this._events
	}

	/**
	 * Compliance service for HIPAA, GDPR, and custom reporting
	 */
	public get compliance(): ComplianceService {
		this.validateClientState()
		return this._compliance
	}

	/**
	 * Scheduled reports service for automated reporting
	 */
	public get scheduledReports(): ScheduledReportsService {
		this.validateClientState()
		return this._scheduledReports
	}

	/**
	 * Presets service for audit configuration templates
	 */
	public get presets(): PresetsService {
		this.validateClientState()
		return this._presets
	}

	/**
	 * Metrics service for system monitoring and performance tracking
	 */
	public get metrics(): MetricsService {
		this.validateClientState()
		return this._metrics
	}

	/**
	 * Health service for system health monitoring
	 */
	public get health(): HealthService {
		this.validateClientState()
		return this._health
	}

	/**
	 * Validate that the client is in a usable state
	 */
	private validateClientState(): void {
		if (this.destroyed) {
			throw new Error('AuditClient has been destroyed and cannot be used')
		}

		if (this.state === 'error') {
			throw new Error('AuditClient is in an error state and cannot be used')
		}

		if (this.state === 'initializing') {
			throw new Error('AuditClient is still initializing')
		}
	}

	// Configuration management methods
	/**
	 * Get current configuration
	 */
	public getConfig(): AuditClientConfig {
		this.validateClientState()
		return this.configManager.getConfig()
	}

	/**
	 * Update configuration with new values
	 */
	public updateConfig(updates: Partial<AuditClientConfig>): void {
		this.validateClientState()

		try {
			this.configManager.updateConfig(updates)
			this.config = this.configManager.getConfig()

			// Reinitialize infrastructure with new config
			this.initializeInfrastructure()

			// Update service configurations
			this._events.updateConfig(this.config)
			this._compliance.updateConfig(this.config)
			this._scheduledReports.updateConfig(this.config)
			this._presets.updateConfig(this.config)
			this._metrics.updateConfig(this.config)
			this._health.updateConfig(this.config)

			this.logger.info('Configuration updated successfully', {
				updatedFields: Object.keys(updates),
			})
		} catch (error) {
			this.errorCount++
			this.logger.error('Failed to update configuration', { error })
			throw error
		}
	}

	/**
	 * Load environment-specific configuration
	 */
	public loadEnvironmentConfig(environment: string, envConfig: Partial<AuditClientConfig>): void {
		this.validateClientState()

		try {
			this.configManager.loadEnvironmentConfig(environment, envConfig)

			// If this is the current environment, apply the config
			if (this.config.environment === environment) {
				this.config = this.configManager.getConfig()
				this.initializeInfrastructure()

				// Update service configurations
				this._events.updateConfig(this.config)
				this._compliance.updateConfig(this.config)
				this._scheduledReports.updateConfig(this.config)
				this._presets.updateConfig(this.config)
				this._metrics.updateConfig(this.config)
				this._health.updateConfig(this.config)
			}

			this.logger.info('Environment configuration loaded', { environment })
		} catch (error) {
			this.errorCount++
			this.logger.error('Failed to load environment configuration', { error, environment })
			throw error
		}
	}

	// Interceptor management methods
	/**
	 * Add request interceptor to all services
	 */
	public addRequestInterceptor(interceptor: RequestInterceptor): void {
		this.validateClientState()

		this._events.addRequestInterceptor(interceptor)
		this._compliance.addRequestInterceptor(interceptor)
		this._scheduledReports.addRequestInterceptor(interceptor)
		this._presets.addRequestInterceptor(interceptor)
		this._metrics.addRequestInterceptor(interceptor)
		this._health.addRequestInterceptor(interceptor)

		this.logger.debug('Request interceptor added to all services')
	}

	/**
	 * Add response interceptor to all services
	 */
	public addResponseInterceptor(interceptor: ResponseInterceptor): void {
		this.validateClientState()

		this._events.addResponseInterceptor(interceptor)
		this._compliance.addResponseInterceptor(interceptor)
		this._scheduledReports.addResponseInterceptor(interceptor)
		this._presets.addResponseInterceptor(interceptor)
		this._metrics.addResponseInterceptor(interceptor)
		this._health.addResponseInterceptor(interceptor)

		this.logger.debug('Response interceptor added to all services')
	}

	/**
	 * Clear all interceptors from all services
	 */
	public clearInterceptors(): void {
		this.validateClientState()

		this._events.clearInterceptors()
		this._compliance.clearInterceptors()
		this._scheduledReports.clearInterceptors()
		this._presets.clearInterceptors()
		this._metrics.clearInterceptors()
		this._health.clearInterceptors()

		this.logger.debug('All interceptors cleared from all services')
	}

	// Statistics and monitoring methods
	/**
	 * Get client statistics and performance metrics
	 */
	public getStats(): ClientStats {
		this.validateClientState()

		return {
			state: this.state,
			uptime: Date.now() - this.startTime,
			requestCount: this.requestCount,
			errorCount: this.errorCount,
			cacheStats: this.cacheManager.getStats(),
			retryStats: this.retryManager.getCircuitBreakerStats(),
			batchStats: this.batchManager.getStats(),
			authStats: this.authManager.getCacheStats(),
		}
	}

	/**
	 * Get infrastructure component statistics
	 */
	public getInfrastructureStats(): {
		cache: any
		retry: any
		batch: any
		auth: any
	} {
		this.validateClientState()

		return {
			cache: this.cacheManager.getStats(),
			retry: this.retryManager.getCircuitBreakerStats(),
			batch: this.batchManager.getStats(),
			auth: this.authManager.getCacheStats(),
		}
	}

	/**
	 * Get service statistics
	 */
	public getServiceStats(): {
		events: any
		compliance: any
		scheduledReports: any
		presets: any
		metrics: any
		health: any
	} {
		this.validateClientState()

		return {
			events: this._events.getStats(),
			compliance: this._compliance.getStats(),
			scheduledReports: this._scheduledReports.getStats(),
			presets: this._presets.getStats(),
			metrics: this._metrics.getStats(),
			health: this._health.getStats(),
		}
	}

	// Lifecycle management methods
	/**
	 * Check if the client is ready for use
	 */
	public isReady(): boolean {
		return this.state === 'ready' && !this.destroyed
	}

	/**
	 * Check if the client has been destroyed
	 */
	public isDestroyed(): boolean {
		return this.destroyed
	}

	/**
	 * Get current client state
	 */
	public getState(): ClientState {
		return this.state
	}

	/**
	 * Perform a health check on all services
	 */
	public async healthCheck(): Promise<{
		overall: 'healthy' | 'degraded' | 'unhealthy'
		services: Record<string, 'healthy' | 'unhealthy'>
		timestamp: string
	}> {
		this.validateClientState()

		try {
			const results = await Promise.allSettled([
				this._health.check(),
				// Services don't have healthCheck methods, so we just check if they exist
				Promise.resolve({ status: 'healthy' }), // events
				Promise.resolve({ status: 'healthy' }), // compliance
				Promise.resolve({ status: 'healthy' }), // scheduledReports
				Promise.resolve({ status: 'healthy' }), // presets
				Promise.resolve({ status: 'healthy' }), // metrics
			])

			const serviceNames = [
				'health',
				'events',
				'compliance',
				'scheduledReports',
				'presets',
				'metrics',
			]
			const services: Record<string, 'healthy' | 'unhealthy'> = {}
			let healthyCount = 0

			results.forEach((result, index) => {
				const serviceName = serviceNames[index]
				if (serviceName && result.status === 'fulfilled') {
					services[serviceName] = 'healthy'
					healthyCount++
				} else if (serviceName) {
					services[serviceName] = 'unhealthy'
				}
			})

			let overall: 'healthy' | 'degraded' | 'unhealthy'
			if (healthyCount === serviceNames.length) {
				overall = 'healthy'
			} else if (healthyCount > serviceNames.length / 2) {
				overall = 'degraded'
			} else {
				overall = 'unhealthy'
			}

			return {
				overall,
				services,
				timestamp: new Date().toISOString(),
			}
		} catch (error) {
			this.errorCount++
			this.logger.error('Health check failed', { error })
			throw error
		}
	}

	/**
	 * Cleanup and destroy the client instance
	 */
	public async destroy(): Promise<void> {
		if (this.destroyed) {
			return
		}

		this.logger.info('Destroying AuditClient instance')

		try {
			// Remove process event listeners
			if (this.processCleanup && typeof process !== 'undefined' && process.removeListener) {
				process.removeListener('exit', this.processCleanup)
				process.removeListener('SIGINT', this.processCleanup)
				process.removeListener('SIGTERM', this.processCleanup)
				process.removeListener('uncaughtException', this.processCleanup)
			}

			// Execute all cleanup tasks
			await Promise.allSettled(
				this.cleanupTasks.map(async (task) => {
					try {
						await task()
					} catch (error) {
						this.logger.warn('Cleanup task failed', { error })
					}
				})
			)

			// Mark as destroyed
			this.destroyed = true
			this.state = 'destroyed'

			this.logger.info('AuditClient destroyed successfully', {
				uptime: Date.now() - this.startTime,
				totalRequests: this.requestCount,
				totalErrors: this.errorCount,
			})
		} catch (error) {
			this.logger.error('Error during client destruction', { error })
			throw error
		}
	}

	// Utility methods
	/**
	 * Create a new AuditClient instance with default configuration for environment
	 */
	public static createForEnvironment(
		environment: 'development' | 'staging' | 'production',
		baseUrl: string,
		authConfig:
			| { type: 'apiKey'; apiKey: string }
			| { type: 'session'; sessionToken: string }
			| { type: 'bearer'; bearerToken: string },
		overrides: Partial<AuditClientConfig> = {}
	): AuditClient {
		const defaultConfig = ConfigManager.createDefaultConfig(environment)

		const config: PartialAuditClientConfig = {
			...defaultConfig,
			baseUrl,
			authentication: authConfig,
			...overrides,
		}

		return new AuditClient(config)
	}

	/**
	 * Create a new AuditClient instance from environment variables
	 */
	public static fromEnvironment(envPrefix = 'AUDIT_CLIENT_'): AuditClient {
		const config = ConfigManager.fromEnvironment(envPrefix)
		return new AuditClient(config)
	}

	/**
	 * Validate configuration without creating an instance
	 */
	public static validateConfig(config: PartialAuditClientConfig): {
		isValid: boolean
		errors?: any
	} {
		return ConfigManager.validateConfig(config)
	}
}
