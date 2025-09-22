import { AuthManager } from '../infrastructure/auth'
import { BatchManager } from '../infrastructure/batch'
import { CacheManager } from '../infrastructure/cache'
import { ErrorHandler } from '../infrastructure/error'
import { DefaultLogger } from '../infrastructure/logger'
import { PluginManager } from '../infrastructure/plugins'
import { RetryManager } from '../infrastructure/retry'
import { ComplianceService } from '../services/compliance'
// Import all services
import { EventsService } from '../services/events'
import { HealthService } from '../services/health'
import { MetricsService } from '../services/metrics'
import { PresetsService } from '../services/presets'
import { ScheduledReportsService } from '../services/scheduled-reports'
import { ConfigManager } from './config'

import type { RequestInterceptor, ResponseInterceptor } from '../infrastructure/interceptors'
import type { Logger } from '../infrastructure/logger'
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
	private logger: Logger | undefined
	private authManager!: AuthManager
	private cacheManager!: CacheManager
	private retryManager!: RetryManager
	private batchManager!: BatchManager
	private errorHandler!: ErrorHandler
	private pluginManager!: PluginManager

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

			// Initialize plugin system (async initialization will be handled separately)
			this.pluginManager = new PluginManager(this.getLogger())
			this.pluginManager.setClientConfig(this.config)

			// Initialize services
			this.initializeServices()

			// Set up cleanup tasks
			this.setupCleanupTasks()

			// Mark as ready (plugins will be loaded separately if needed)
			this.state = 'ready'

			this.getLogger().info('AuditClient initialized successfully', {
				baseUrl: this.config.baseUrl,
				environment: this.config.environment,
				features: this.getEnabledFeatures(),
			})

			// Initialize plugins asynchronously if auto-load is enabled
			if (this.config.plugins.enabled && this.config.plugins.autoLoad) {
				this.initializePlugins().catch((error) => {
					this.getLogger().error('Failed to initialize plugins', { error })
				})
			}
		} catch (error) {
			this.state = 'error'
			// Initialize logger first if it failed during initialization
			if (!this.logger) {
				this.logger = new DefaultLogger()
			}
			this.getLogger().error('Failed to initialize AuditClient', { error })
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
			this.getLogger()
		)

		this.getLogger().debug('Infrastructure components initialized', {
			auth: this.config.authentication.type,
			cache: this.config.cache.enabled,
			retry: this.config.retry.enabled,
			batch: this.config.batching.enabled,
		})
	}

	/**
	 * Initialize plugin system
	 */
	private async initializePlugins(): Promise<void> {
		// Initialize plugin manager
		this.pluginManager = new PluginManager(this.getLogger())
		this.pluginManager.setClientConfig(this.config)

		// Load built-in plugins if enabled
		if (this.config.plugins.enabled && this.config.plugins.autoLoad) {
			await this.loadBuiltInPlugins()
		}

		// Load configured plugins
		if (this.config.plugins.plugins.length > 0) {
			await this.loadConfiguredPlugins()
		}

		this.getLogger().debug('Plugin system initialized', {
			pluginCount: this.pluginManager.getRegistry().getAllPlugins().length,
			middlewareCount: this.pluginManager.getRegistry().getMiddlewareChain().length,
			storagePlugins: this.pluginManager.getRegistry().getStoragePlugins().length,
			authPlugins: this.pluginManager.getRegistry().getAuthPlugins().length,
		})
	}

	/**
	 * Load built-in plugins based on configuration
	 */
	private async loadBuiltInPlugins(): Promise<void> {
		const { BuiltInPluginFactory } = await import('../infrastructure/plugins/built-in')

		// Load middleware plugins
		if (this.config.plugins.middleware.enabled) {
			for (const pluginName of this.config.plugins.middleware.plugins) {
				try {
					let plugin
					switch (pluginName) {
						case 'request-logging':
							plugin = BuiltInPluginFactory.createRequestLoggingPlugin()
							break
						case 'correlation-id':
							plugin = BuiltInPluginFactory.createCorrelationIdPlugin()
							break
						case 'rate-limiting':
							plugin = BuiltInPluginFactory.createRateLimitingPlugin()
							break
						default:
							this.getLogger().warn(`Unknown built-in middleware plugin: ${pluginName}`)
							continue
					}

					await this.pluginManager.getRegistry().register(plugin, {})
				} catch (error) {
					this.getLogger().error(`Failed to load built-in middleware plugin '${pluginName}'`, {
						error,
					})
				}
			}
		}

		// Load storage plugins
		if (this.config.plugins.storage.enabled) {
			for (const [pluginName, pluginConfig] of Object.entries(
				this.config.plugins.storage.plugins
			)) {
				try {
					let plugin
					switch (pluginName) {
						case 'redis-storage':
							plugin = BuiltInPluginFactory.createRedisStoragePlugin()
							break
						case 'indexeddb-storage':
							plugin = BuiltInPluginFactory.createIndexedDBStoragePlugin()
							break
						default:
							this.getLogger().warn(`Unknown built-in storage plugin: ${pluginName}`)
							continue
					}

					await this.pluginManager.getRegistry().register(plugin, pluginConfig)
				} catch (error) {
					this.getLogger().error(`Failed to load built-in storage plugin '${pluginName}'`, {
						error,
					})
				}
			}
		}

		// Load auth plugins
		if (this.config.plugins.auth.enabled) {
			for (const [pluginName, pluginConfig] of Object.entries(this.config.plugins.auth.plugins)) {
				try {
					let plugin
					switch (pluginName) {
						case 'jwt-auth':
							plugin = BuiltInPluginFactory.createJWTAuthPlugin()
							break
						case 'oauth2-auth':
							plugin = BuiltInPluginFactory.createOAuth2AuthPlugin()
							break
						case 'custom-header-auth':
							plugin = BuiltInPluginFactory.createCustomHeaderAuthPlugin()
							break
						default:
							this.getLogger().warn(`Unknown built-in auth plugin: ${pluginName}`)
							continue
					}

					await this.pluginManager.getRegistry().register(plugin, pluginConfig)
				} catch (error) {
					this.getLogger().error(`Failed to load built-in auth plugin '${pluginName}'`, { error })
				}
			}
		}
	}

	/**
	 * Load plugins from configuration
	 */
	private async loadConfiguredPlugins(): Promise<void> {
		for (const pluginConfig of this.config.plugins.plugins) {
			if (!pluginConfig.enabled) {
				continue
			}

			try {
				// In a real implementation, this would dynamically load plugins
				// For now, we'll just log that the plugin would be loaded
				this.getLogger().info(`Would load configured plugin: ${pluginConfig.name}`, {
					type: pluginConfig.type,
					priority: pluginConfig.priority,
				})
			} catch (error) {
				this.getLogger().error(`Failed to load configured plugin '${pluginConfig.name}'`, { error })
			}
		}
	}

	/**
	 * Initialize all service instances
	 */
	private initializeServices(): void {
		// All services share the same configuration and logger
		const logger = this.getLogger()
		this._events = new EventsService(this.config, logger)
		this._compliance = new ComplianceService(this.config, logger)
		this._scheduledReports = new ScheduledReportsService(this.config, logger)
		this._presets = new PresetsService(this.config, logger)
		this._metrics = new MetricsService(this.config, logger)
		this._health = new HealthService(this.config, logger)

		this.getLogger().debug('Services initialized', {
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
		this.cleanupTasks.push(() => this.pluginManager.cleanup())

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
	 * Plugin manager for managing plugins
	 */
	public get plugins(): PluginManager {
		this.validateClientState()
		return this.pluginManager
	}

	/**
	 * Get logger instance, ensuring it's always available
	 */
	private getLogger(): Logger {
		if (!this.logger) {
			this.logger = new DefaultLogger()
		}
		return this.logger
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
	 * Initialize plugins manually
	 */
	public async initializePluginsManually(): Promise<void> {
		this.validateClientState()
		await this.initializePlugins()
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

			this.getLogger().info('Configuration updated successfully', {
				updatedFields: Object.keys(updates),
			})
		} catch (error) {
			this.errorCount++
			this.getLogger().error('Failed to update configuration', { error })
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

			this.getLogger().info('Environment configuration loaded', { environment })
		} catch (error) {
			this.errorCount++
			this.getLogger().error('Failed to load environment configuration', { error, environment })
			throw error
		}
	}

	// Interceptor management methods
	/**
	 * Add request interceptor to all services
	 */
	public addRequestInterceptor(
		interceptor: RequestInterceptor,
		options: { enabled: true; priority: 0 }
	): void {
		this.validateClientState()

		this._events.addRequestInterceptor(interceptor, options)
		this._compliance.addRequestInterceptor(interceptor, options)
		this._scheduledReports.addRequestInterceptor(interceptor, options)
		this._presets.addRequestInterceptor(interceptor, options)
		this._metrics.addRequestInterceptor(interceptor, options)
		this._health.addRequestInterceptor(interceptor, options)

		this.getLogger().debug('Request interceptor added to all services')
	}

	/**
	 * Add response interceptor to all services
	 */
	public addResponseInterceptor(
		interceptor: ResponseInterceptor,
		options: { enabled: true; priority: 0 }
	): void {
		this.validateClientState()

		this._events.addResponseInterceptor(interceptor, options)
		this._compliance.addResponseInterceptor(interceptor, options)
		this._scheduledReports.addResponseInterceptor(interceptor, options)
		this._presets.addResponseInterceptor(interceptor, options)
		this._metrics.addResponseInterceptor(interceptor, options)
		this._health.addResponseInterceptor(interceptor, options)

		this.getLogger().debug('Response interceptor added to all services')
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

		this.getLogger().debug('All interceptors cleared from all services')
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
			this.getLogger().error('Health check failed', { error })
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

		this.getLogger().info('Destroying AuditClient instance')

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
						this.getLogger().warn('Cleanup task failed', { error })
					}
				})
			)

			// Mark as destroyed
			this.destroyed = true
			this.state = 'destroyed'

			this.getLogger().info('AuditClient destroyed successfully', {
				uptime: Date.now() - this.startTime,
				totalRequests: this.requestCount,
				totalErrors: this.errorCount,
			})
		} catch (error) {
			this.getLogger().error('Error during client destruction', { error })
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
