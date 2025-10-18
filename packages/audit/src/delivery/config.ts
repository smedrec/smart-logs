/**
 * Configuration Management System - Environment-specific settings and validation
 * Requirements 1.1, 10.5: Configuration management and security
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { StructuredLogger } from '@repo/logs'

import type { DeliveryServiceFactoryConfig } from './factory.js'
import type { HealthMonitorConfig } from './health-monitor.js'
import type { DeliveryObservabilityConfig } from './observability/index.js'
import type { RetryManagerConfig } from './retry-manager.js'

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production' | 'test'

/**
 * Configuration source types
 */
export type ConfigSource = 'environment' | 'file' | 'default' | 'override'

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
	valid: boolean
	errors: string[]
	warnings: string[]
}

/**
 * Configuration metadata
 */
export interface ConfigMetadata {
	source: ConfigSource
	loadedAt: string
	environment: Environment
	version: string
	checksum?: string
}

/**
 * Complete delivery service configuration
 */
export interface DeliveryServiceConfiguration {
	// Environment settings
	environment: Environment
	logLevel: 'debug' | 'info' | 'warn' | 'error'

	// Core service settings
	service: {
		name: string
		version: string
		port?: number
		host?: string
		timeout: number
		maxConcurrency: number
	}

	// Database settings
	database: {
		connectionString?: string
		poolSize: number
		timeout: number
		retryAttempts: number
		ssl: boolean
	}

	// Delivery settings
	delivery: {
		maxPayloadSize: number // bytes
		defaultPriority: number
		maxDestinations: number
		enableFanout: boolean
		enableIdempotency: boolean
	}

	// Queue settings
	queue: {
		maxConcurrentDeliveries: number
		processingInterval: number // milliseconds
		cleanupInterval: number // milliseconds
		maxCompletedAge: number // milliseconds
		enableMetrics: boolean
	}

	// Retry settings
	retry: RetryManagerConfig

	// Health monitoring settings
	healthMonitoring: HealthMonitorConfig & {
		enabled: boolean
	}

	// Observability settings
	observability: DeliveryObservabilityConfig & {
		enabled: boolean
	}

	// Alerting settings
	alerting: {
		enabled: boolean
		channels: {
			email?: {
				enabled: boolean
				smtpHost?: string
				smtpPort?: number
				smtpUser?: string
				smtpPassword?: string
				fromAddress?: string
				toAddresses: string[]
			}
			webhook?: {
				enabled: boolean
				url?: string
				secret?: string
				timeout: number
			}
			slack?: {
				enabled: boolean
				webhookUrl?: string
				channel?: string
			}
		}
		debouncing: {
			enabled: boolean
			windowMinutes: number
			cooldownMinutes: number
		}
	}

	// Security settings
	security: {
		encryptionKey?: string
		webhookSecrets: {
			rotationEnabled: boolean
			rotationIntervalDays: number
			keyLength: number
		}
		rateLimiting: {
			enabled: boolean
			requestsPerMinute: number
			burstLimit: number
		}
	}

	// Feature flags
	features: {
		enableScheduler: boolean
		enableCircuitBreaker: boolean
		enableMetrics: boolean
		enableTracing: boolean
		enableHealthChecks: boolean
		enableAPI: boolean
	}
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: DeliveryServiceConfiguration = {
	environment: 'development',
	logLevel: 'info',

	service: {
		name: 'delivery-service',
		version: '1.0.0',
		timeout: 30000,
		maxConcurrency: 100,
	},

	database: {
		poolSize: 10,
		timeout: 5000,
		retryAttempts: 3,
		ssl: false,
	},

	delivery: {
		maxPayloadSize: 10 * 1024 * 1024, // 10MB
		defaultPriority: 5,
		maxDestinations: 50,
		enableFanout: true,
		enableIdempotency: true,
	},

	queue: {
		maxConcurrentDeliveries: 10,
		processingInterval: 5000,
		cleanupInterval: 300000,
		maxCompletedAge: 86400000,
		enableMetrics: true,
	},

	retry: {
		maxRetries: 5,
		baseDelay: 1000,
		maxDelay: 300000,
		backoffMultiplier: 2,
		jitterEnabled: true,
		jitterMaxPercent: 10,
		nonRetryableErrors: [
			'INVALID_CONFIG',
			'AUTHENTICATION_FAILED',
			'AUTHORIZATION_DENIED',
			'INVALID_PAYLOAD',
			'DESTINATION_NOT_FOUND',
		],
		retryableStatusCodes: [408, 429, 500, 502, 503, 504],
	},

	healthMonitoring: {
		enabled: true,
		degradedThreshold: 3,
		unhealthyThreshold: 5,
		disableThreshold: 10,
		circuitBreakerThreshold: 5,
		circuitBreakerTimeout: 300000,
		halfOpenMaxAttempts: 3,
		healthCheckInterval: 300000,
		unhealthyCheckInterval: 60000,
		minSuccessRate: 95.0,
	},

	observability: {
		enabled: true,
		tracing: {
			enabled: true,
			serviceName: 'delivery-service',
			sampleRate: 1.0,
			exporterType: 'otlp',
			exporterEndpoint: 'http://localhost:4318/v1/traces',
		},
		metrics: {
			enabled: true,
			serviceName: 'delivery-service',
			exporterType: 'otlp',
			exporterEndpoint: 'http://localhost:4318/v1/metrics',
			collectionInterval: 15000,
		},
		performance: {
			enabled: true,
			trackingEnabled: true,
			slowOperationThreshold: 5000,
			memoryTrackingEnabled: false,
		},
	},

	alerting: {
		enabled: true,
		channels: {
			email: {
				enabled: false,
				smtpPort: 587,
				toAddresses: [],
			},
			webhook: {
				enabled: false,
				timeout: 5000,
			},
			slack: {
				enabled: false,
			},
		},
		debouncing: {
			enabled: true,
			windowMinutes: 15,
			cooldownMinutes: 60,
		},
	},

	security: {
		webhookSecrets: {
			rotationEnabled: true,
			rotationIntervalDays: 30,
			keyLength: 32,
		},
		rateLimiting: {
			enabled: true,
			requestsPerMinute: 1000,
			burstLimit: 100,
		},
	},

	features: {
		enableScheduler: true,
		enableCircuitBreaker: true,
		enableMetrics: true,
		enableTracing: true,
		enableHealthChecks: true,
		enableAPI: true,
	},
}

/**
 * Environment-specific configuration overrides
 */
const ENVIRONMENT_OVERRIDES: Record<Environment, Partial<DeliveryServiceConfiguration>> = {
	development: {
		logLevel: 'debug',
		observability: {
			enabled: true,
			tracing: {
				enabled: true,
				serviceName: 'delivery-service',
				sampleRate: 1.0,
				exporterType: 'console',
			},
			metrics: {
				enabled: true,
				serviceName: 'delivery-service',
				exporterType: 'console',
				collectionInterval: 15000,
			},
			performance: {
				enabled: true,
				trackingEnabled: true,
				slowOperationThreshold: 5000,
				memoryTrackingEnabled: false,
			},
		},
		security: {
			webhookSecrets: {
				rotationEnabled: true,
				rotationIntervalDays: 30,
				keyLength: 32,
			},
			rateLimiting: {
				enabled: false,
				requestsPerMinute: 1000,
				burstLimit: 100,
			},
		},
	},

	staging: {
		logLevel: 'info',
		database: {
			connectionString: undefined,
			poolSize: 10,
			timeout: 5000,
			retryAttempts: 3,
			ssl: true,
		},
		observability: {
			enabled: true,
			tracing: {
				enabled: true,
				serviceName: 'delivery-service',
				sampleRate: 0.1,
				exporterType: 'otlp',
			},
			metrics: {
				enabled: true,
				serviceName: 'delivery-service',
				exporterType: 'otlp',
				collectionInterval: 15000,
			},
			performance: {
				enabled: true,
				trackingEnabled: true,
				slowOperationThreshold: 5000,
				memoryTrackingEnabled: false,
			},
		},
	},

	production: {
		logLevel: 'warn',
		database: {
			connectionString: undefined,
			poolSize: 20,
			timeout: 5000,
			retryAttempts: 3,
			ssl: true,
		},
		queue: {
			maxConcurrentDeliveries: 50,
			processingInterval: 5000,
			cleanupInterval: 300000,
			maxCompletedAge: 86400000,
			enableMetrics: true,
		},
		observability: {
			enabled: true,
			tracing: {
				enabled: true,
				serviceName: 'delivery-service',
				sampleRate: 0.01,
				exporterType: 'otlp',
			},
			metrics: {
				enabled: true,
				serviceName: 'delivery-service',
				exporterType: 'otlp',
				collectionInterval: 15000,
			},
			performance: {
				enabled: true,
				trackingEnabled: true,
				slowOperationThreshold: 5000,
				memoryTrackingEnabled: false,
			},
		},
		security: {
			webhookSecrets: {
				rotationEnabled: true,
				rotationIntervalDays: 30,
				keyLength: 32,
			},
			rateLimiting: {
				enabled: true,
				requestsPerMinute: 500,
				burstLimit: 100,
			},
		},
	},

	test: {
		logLevel: 'error',
		features: {
			enableScheduler: false,
			enableCircuitBreaker: true,
			enableMetrics: false,
			enableTracing: false,
			enableHealthChecks: true,
			enableAPI: true,
		},
		observability: {
			enabled: false,
			tracing: {
				enabled: false,
				serviceName: 'delivery-service',
				sampleRate: 0,
				exporterType: 'console',
			},
			metrics: {
				enabled: false,
				serviceName: 'delivery-service',
				exporterType: 'console',
				collectionInterval: 15000,
			},
			performance: {
				enabled: false,
				trackingEnabled: false,
				slowOperationThreshold: 5000,
				memoryTrackingEnabled: false,
			},
		},
		alerting: {
			enabled: false,
			channels: {
				email: {
					enabled: false,
					smtpPort: 587,
					toAddresses: [],
				},
				webhook: {
					enabled: false,
					timeout: 5000,
				},
				slack: {
					enabled: false,
				},
			},
			debouncing: {
				enabled: true,
				windowMinutes: 15,
				cooldownMinutes: 60,
			},
		},
	},
}

/**
 * Configuration manager for loading and validating settings
 */
export class ConfigurationManager {
	private readonly logger: StructuredLogger
	private config: DeliveryServiceConfiguration
	private metadata: ConfigMetadata
	private watchers: Array<(config: DeliveryServiceConfiguration) => void> = []

	constructor(
		private readonly environment: Environment = 'development',
		private readonly configPath?: string
	) {
		this.logger = new StructuredLogger({
			service: '@repo/audit - ConfigurationManager',
			environment: this.environment === 'test' ? 'development' : this.environment,
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})

		// Initialize with default configuration
		this.config = this.loadConfiguration()
		this.metadata = {
			source: 'default',
			loadedAt: new Date().toISOString(),
			environment: this.environment,
			version: '1.0.0',
		}
	}

	/**
	 * Load configuration from multiple sources
	 */
	private loadConfiguration(): DeliveryServiceConfiguration {
		let config = { ...DEFAULT_CONFIG }

		// Apply environment-specific overrides
		const envOverrides = ENVIRONMENT_OVERRIDES[this.environment]
		if (envOverrides) {
			config = this.mergeConfig(config, envOverrides)
		}

		// Load from file if specified
		if (this.configPath) {
			try {
				const fileConfig = this.loadFromFile(this.configPath)
				config = this.mergeConfig(config, fileConfig)
				this.metadata.source = 'file'
			} catch (error) {
				this.logger.warn('Failed to load configuration from file', {
					configPath: this.configPath,
					error: error instanceof Error ? error.message : 'Unknown error',
				})
			}
		}

		// Load from environment variables
		const envConfig = this.loadFromEnvironment()
		config = this.mergeConfig(config, envConfig)

		// Set environment in config
		config.environment = this.environment

		return config
	}

	/**
	 * Load configuration from file
	 */
	private loadFromFile(filePath: string): Partial<DeliveryServiceConfiguration> {
		try {
			const fullPath = join(process.cwd(), filePath)
			const content = readFileSync(fullPath, 'utf-8')

			if (filePath.endsWith('.json')) {
				return JSON.parse(content)
			} else if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
				// For JS/TS files, we'd need to use dynamic import
				// For now, just support JSON
				throw new Error('JS/TS configuration files not supported yet')
			}

			throw new Error('Unsupported configuration file format')
		} catch (error) {
			this.logger.error('Failed to load configuration file', {
				filePath,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Load configuration from environment variables
	 */
	private loadFromEnvironment(): Partial<DeliveryServiceConfiguration> {
		const config: any = {}

		// Database configuration
		if (process.env.DATABASE_URL) {
			config.database = { ...config.database, connectionString: process.env.DATABASE_URL }
		}
		if (process.env.DATABASE_POOL_SIZE) {
			config.database = {
				...config.database,
				poolSize: parseInt(process.env.DATABASE_POOL_SIZE, 10),
			}
		}

		// Service configuration
		if (process.env.SERVICE_PORT) {
			config.service = { ...config.service, port: parseInt(process.env.SERVICE_PORT, 10) }
		}
		if (process.env.SERVICE_HOST) {
			config.service = { ...config.service, host: process.env.SERVICE_HOST }
		}

		// Log level
		if (process.env.LOG_LEVEL) {
			config.logLevel = process.env.LOG_LEVEL
		}

		// Security configuration
		if (process.env.ENCRYPTION_KEY) {
			config.security = { ...config.security, encryptionKey: process.env.ENCRYPTION_KEY }
		}

		// Observability configuration
		if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
			config.observability = {
				...config.observability,
				tracing: {
					...config.observability?.tracing,
					endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
				},
				metrics: {
					...config.observability?.metrics,
					endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
				},
			}
		}

		// Feature flags
		if (process.env.ENABLE_SCHEDULER !== undefined) {
			config.features = {
				...config.features,
				enableScheduler: process.env.ENABLE_SCHEDULER === 'true',
			}
		}
		if (process.env.ENABLE_METRICS !== undefined) {
			config.features = { ...config.features, enableMetrics: process.env.ENABLE_METRICS === 'true' }
		}

		return config
	}

	/**
	 * Deep merge configuration objects
	 */
	private mergeConfig(
		base: DeliveryServiceConfiguration,
		override: Partial<DeliveryServiceConfiguration>
	): DeliveryServiceConfiguration {
		// Use JSON parse/stringify for deep merge to avoid type issues
		const merged = JSON.parse(JSON.stringify(base))

		for (const [key, value] of Object.entries(override)) {
			if (value !== undefined) {
				if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
					merged[key] = { ...merged[key], ...value }
				} else {
					merged[key] = value
				}
			}
		}

		return merged as DeliveryServiceConfiguration
	}

	/**
	 * Get current configuration
	 */
	getConfig(): DeliveryServiceConfiguration {
		return { ...this.config }
	}

	/**
	 * Get configuration metadata
	 */
	getMetadata(): ConfigMetadata {
		return { ...this.metadata }
	}

	/**
	 * Update configuration at runtime
	 */
	updateConfig(updates: Partial<DeliveryServiceConfiguration>): void {
		const validation = this.validateConfig({ ...this.config, ...updates })

		if (!validation.valid) {
			throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`)
		}

		const oldConfig = { ...this.config }
		this.config = this.mergeConfig(this.config, updates)

		this.metadata = {
			...this.metadata,
			source: 'override',
			loadedAt: new Date().toISOString(),
		}

		this.logger.info('Configuration updated', {
			changes: this.getConfigDiff(oldConfig, this.config),
		})

		// Notify watchers
		this.watchers.forEach((watcher) => {
			try {
				watcher(this.config)
			} catch (error) {
				this.logger.error('Configuration watcher error', {
					error: error instanceof Error ? error.message : 'Unknown error',
				})
			}
		})
	}

	/**
	 * Validate configuration
	 */
	validateConfig(config: DeliveryServiceConfiguration): ConfigValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		// Validate environment
		if (!['development', 'staging', 'production', 'test'].includes(config.environment)) {
			errors.push('Invalid environment')
		}

		// Validate service settings
		if (config.service.port && (config.service.port < 1 || config.service.port > 65535)) {
			errors.push('Service port must be between 1 and 65535')
		}

		if (config.service.timeout < 1000) {
			warnings.push('Service timeout is very low (< 1 second)')
		}

		// Validate delivery settings
		if (config.delivery.maxPayloadSize < 1024) {
			warnings.push('Max payload size is very small (< 1KB)')
		}

		if (config.delivery.maxPayloadSize > 100 * 1024 * 1024) {
			warnings.push('Max payload size is very large (> 100MB)')
		}

		if (config.delivery.defaultPriority < 0 || config.delivery.defaultPriority > 10) {
			errors.push('Default priority must be between 0 and 10')
		}

		// Validate retry settings
		if (config.retry.maxRetries < 0 || config.retry.maxRetries > 20) {
			errors.push('Max retries must be between 0 and 20')
		}

		if (config.retry.baseDelay < 100) {
			warnings.push('Base retry delay is very low (< 100ms)')
		}

		// Validate database settings
		if (config.database.poolSize < 1 || config.database.poolSize > 100) {
			errors.push('Database pool size must be between 1 and 100')
		}

		// Validate security settings
		if (config.environment === 'production') {
			if (!config.security.encryptionKey) {
				errors.push('Encryption key is required in production')
			}

			if (!config.database.ssl) {
				warnings.push('SSL is recommended for production database connections')
			}
		}

		// Validate observability settings
		if (config.observability.enabled) {
			if (
				config.observability.tracing?.sampleRate &&
				(config.observability.tracing.sampleRate < 0 || config.observability.tracing.sampleRate > 1)
			) {
				errors.push('Tracing sample rate must be between 0 and 1')
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Watch for configuration changes
	 */
	watch(callback: (config: DeliveryServiceConfiguration) => void): () => void {
		this.watchers.push(callback)

		// Return unwatch function
		return () => {
			const index = this.watchers.indexOf(callback)
			if (index > -1) {
				this.watchers.splice(index, 1)
			}
		}
	}

	/**
	 * Reload configuration from sources
	 */
	async reload(): Promise<void> {
		try {
			const oldConfig = { ...this.config }
			this.config = this.loadConfiguration()

			this.metadata = {
				...this.metadata,
				loadedAt: new Date().toISOString(),
			}

			const validation = this.validateConfig(this.config)
			if (!validation.valid) {
				this.logger.error('Configuration validation failed after reload', {
					errors: validation.errors.join(', '),
				})
				// Revert to old config
				this.config = oldConfig
				throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`)
			}

			if (validation.warnings.length > 0) {
				this.logger.warn('Configuration warnings after reload', {
					warnings: validation.warnings.join(', '),
				})
			}

			this.logger.info('Configuration reloaded successfully', {
				changes: this.getConfigDiff(oldConfig, this.config),
			})

			// Notify watchers
			this.watchers.forEach((watcher) => {
				try {
					watcher(this.config)
				} catch (error) {
					this.logger.error('Configuration watcher error during reload', {
						error: error instanceof Error ? error.message : 'Unknown error',
					})
				}
			})
		} catch (error) {
			this.logger.error('Failed to reload configuration', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Convert to factory configuration
	 */
	toFactoryConfig(): DeliveryServiceFactoryConfig {
		return {
			deliveryService: {
				healthMonitor: this.config.healthMonitoring,
				enableHealthMonitoring: this.config.healthMonitoring.enabled,
				observability: this.config.observability,
				enableObservability: this.config.observability.enabled,
			},
			healthMonitor: this.config.healthMonitoring,
			retryManager: this.config.retry,
			enableHealthMonitoring: this.config.healthMonitoring.enabled,
			enableObservability: this.config.observability.enabled,
			enableAlerting: this.config.alerting.enabled,
			enableScheduler: this.config.features.enableScheduler,
			observability: this.config.observability,
			environment: this.config.environment === 'test' ? 'development' : this.config.environment,
			logLevel: this.config.logLevel,
		}
	}

	/**
	 * Get configuration differences
	 */
	private getConfigDiff(
		oldConfig: DeliveryServiceConfiguration,
		newConfig: DeliveryServiceConfiguration
	): any {
		const changes: any = {}

		for (const key of Object.keys(newConfig) as Array<keyof DeliveryServiceConfiguration>) {
			if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
				changes[key] = {
					old: oldConfig[key],
					new: newConfig[key],
				}
			}
		}

		return changes
	}
}

/**
 * Factory function for creating configuration manager
 */
export function createConfigurationManager(
	environment?: Environment,
	configPath?: string
): ConfigurationManager {
	return new ConfigurationManager(environment, configPath)
}

/**
 * Load configuration from environment
 */
export function loadConfigFromEnvironment(): DeliveryServiceConfiguration {
	const environment = (process.env.NODE_ENV as Environment) || 'development'
	const configManager = createConfigurationManager(environment)
	return configManager.getConfig()
}

/**
 * Load configuration from file
 */
export function loadConfigFromFile(
	filePath: string,
	environment?: Environment
): DeliveryServiceConfiguration {
	const env = environment || (process.env.NODE_ENV as Environment) || 'development'
	const configManager = createConfigurationManager(env, filePath)
	return configManager.getConfig()
}
