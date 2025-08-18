import { ConfigurationLoader } from './loader.js'

import type { Environment, ServerConfig } from './schema.js'

/**
 * Configuration manager for centralized configuration access
 */
export class ConfigurationManager {
	private static instance: ConfigurationManager
	private loader: ConfigurationLoader
	private config: ServerConfig | null = null
	private initialized = false

	constructor(environment?: Environment) {
		this.loader = ConfigurationLoader.getInstance(environment)
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(environment?: Environment): ConfigurationManager {
		if (!ConfigurationManager.instance) {
			ConfigurationManager.instance = new ConfigurationManager(environment)
		}
		return ConfigurationManager.instance
	}

	/**
	 * Initialize configuration manager
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}

		try {
			this.config = await this.loader.loadConfiguration()
			this.initialized = true
			console.log(`Configuration loaded successfully for environment: ${this.getEnvironment()}`)
		} catch (error) {
			console.error('Failed to initialize configuration:', error)
			throw error
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): ServerConfig {
		if (!this.initialized || !this.config) {
			throw new Error('Configuration manager not initialized. Call initialize() first.')
		}
		return this.config
	}

	/**
	 * Get specific configuration section
	 */
	getServerConfig() {
		return this.getConfig().server
	}

	getCorsConfig() {
		return this.getConfig().cors
	}

	getRateLimitConfig() {
		return this.getConfig().rateLimit
	}

	getDatabaseConfig() {
		return this.getConfig().database
	}

	getRedisConfig() {
		return this.getConfig().redis
	}

	getAuthConfig() {
		return this.getConfig().auth
	}

	getMonitoringConfig() {
		return this.getConfig().monitoring
	}

	getSecurityConfig() {
		return this.getConfig().security
	}

	getPerformanceConfig() {
		return this.getConfig().performance
	}

	getApiConfig() {
		return this.getConfig().api
	}

	getExternalServicesConfig() {
		return this.getConfig().externalServices
	}

	/**
	 * Get current environment
	 */
	getEnvironment(): Environment {
		return this.loader.getEnvironment()
	}

	/**
	 * Check if running in production
	 */
	isProduction(): boolean {
		return this.getEnvironment() === 'production'
	}

	/**
	 * Check if running in development
	 */
	isDevelopment(): boolean {
		return this.getEnvironment() === 'development'
	}

	/**
	 * Check if running in test mode
	 */
	isTest(): boolean {
		return this.getEnvironment() === 'test'
	}

	/**
	 * Reload configuration (useful for hot reloading)
	 */
	async reload(): Promise<void> {
		try {
			this.config = await this.loader.reloadConfiguration()
			console.log('Configuration reloaded successfully')
		} catch (error) {
			console.error('Failed to reload configuration:', error)
			throw error
		}
	}

	/**
	 * Validate configuration against schema
	 */
	validateConfiguration(): boolean {
		try {
			if (!this.config) {
				throw new Error('No configuration loaded')
			}
			// Configuration is already validated during loading
			return true
		} catch (error) {
			console.error('Configuration validation failed:', error)
			return false
		}
	}

	/**
	 * Get configuration as JSON string (for debugging)
	 */
	toJSON(): string {
		if (!this.config) {
			return '{}'
		}
		// Remove sensitive information from output
		const sanitizedConfig = this.sanitizeConfig(this.config)
		return JSON.stringify(sanitizedConfig, null, 2)
	}

	/**
	 * Remove sensitive information from configuration for logging/debugging
	 */
	private sanitizeConfig(config: ServerConfig): any {
		const sanitized = JSON.parse(JSON.stringify(config))

		// Remove sensitive fields
		if (sanitized.auth?.sessionSecret) {
			sanitized.auth.sessionSecret = '[REDACTED]'
		}
		if (sanitized.auth?.dbUrl) {
			sanitized.auth.dbUrl = this.sanitizeUrl(sanitized.auth.dbUrl)
		}
		if (sanitized.security?.encryptionKey) {
			sanitized.security.encryptionKey = '[REDACTED]'
		}
		if (sanitized.database?.url) {
			sanitized.database.url = this.sanitizeUrl(sanitized.database.url)
		}
		if (sanitized.redis?.url) {
			sanitized.redis.url = this.sanitizeUrl(sanitized.redis.url)
		}
		if (sanitized.externalServices?.smtp?.pass) {
			sanitized.externalServices.smtp.pass = '[REDACTED]'
		}
		if (sanitized.externalServices?.webhook?.headers?.Authorization) {
			sanitized.externalServices.webhook.headers.Authorization = '[REDACTED]'
		}

		return sanitized
	}

	/**
	 * Sanitize URL by removing credentials
	 */
	private sanitizeUrl(url: string): string {
		try {
			const urlObj = new URL(url)
			if (urlObj.username || urlObj.password) {
				urlObj.username = '[REDACTED]'
				urlObj.password = '[REDACTED]'
			}
			return urlObj.toString()
		} catch {
			return '[INVALID_URL]'
		}
	}
}

// Export singleton instance
export const configManager = ConfigurationManager.getInstance()

// Validate configuration on initialization in non-production environments
if (process.env.NODE_ENV !== 'production') {
	import('./validator.js').then(({ ConfigValidator }) => {
		configManager
			.initialize()
			.then(() => {
				const config = configManager.getConfig()
				const result = ConfigValidator.validate(config)
				ConfigValidator.printValidationResults(result, configManager.getEnvironment())
			})
			.catch(() => {
				// Ignore validation errors during module loading
			})
	})
}
