import { AuditClientConfig, ConfigManager, PartialAuditClientConfig } from '../core/config'

/**
 * Configuration helper utilities for common configuration patterns
 */

/**
 * Creates a configuration builder for fluent configuration setup
 */
export class ConfigBuilder {
	private config: any = {}

	/**
	 * Sets the base URL for the API
	 */
	baseUrl(url: string): ConfigBuilder {
		this.config.baseUrl = url
		return this
	}

	/**
	 * Sets the API version
	 */
	apiVersion(version: string): ConfigBuilder {
		this.config.apiVersion = version
		return this
	}

	/**
	 * Sets the request timeout
	 */
	timeout(ms: number): ConfigBuilder {
		this.config.timeout = ms
		return this
	}

	/**
	 * Sets the environment
	 */
	environment(env: 'development' | 'staging' | 'production'): ConfigBuilder {
		this.config.environment = env
		return this
	}

	/**
	 * Configures API key authentication
	 */
	withApiKey(apiKey: string): ConfigBuilder {
		this.config.authentication = {
			type: 'apiKey',
			apiKey,
		}
		return this
	}

	/**
	 * Configures bearer token authentication
	 */
	withBearerToken(token: string, autoRefresh = false): ConfigBuilder {
		this.config.authentication = {
			type: 'bearer',
			bearerToken: token,
			autoRefresh,
		}
		return this
	}

	/**
	 * Configures session token authentication
	 */
	withSessionToken(token: string): ConfigBuilder {
		this.config.authentication = {
			type: 'session',
			sessionToken: token,
		}
		return this
	}

	/**
	 * Configures custom authentication headers
	 */
	withCustomAuth(headers: Record<string, string>): ConfigBuilder {
		this.config.authentication = {
			type: 'custom',
			customHeaders: headers,
		}
		return this
	}

	/**
	 * Configures retry settings
	 */
	withRetry(options: {
		enabled?: boolean
		maxAttempts?: number
		initialDelayMs?: number
		maxDelayMs?: number
		backoffMultiplier?: number
	}): ConfigBuilder {
		this.config.retry = {
			...this.config.retry,
			...options,
		}
		return this
	}

	/**
	 * Configures caching settings
	 */
	withCache(options: {
		enabled?: boolean
		defaultTtlMs?: number
		maxSize?: number
		storage?: 'memory' | 'localStorage' | 'sessionStorage' | 'custom'
		keyPrefix?: string
	}): ConfigBuilder {
		this.config.cache = {
			...this.config.cache,
			...options,
		}
		return this
	}

	/**
	 * Configures logging settings
	 */
	withLogging(options: {
		enabled?: boolean
		level?: 'debug' | 'info' | 'warn' | 'error'
		includeRequestBody?: boolean
		includeResponseBody?: boolean
		maskSensitiveData?: boolean
	}): ConfigBuilder {
		this.config.logging = {
			...this.config.logging,
			...options,
		}
		return this
	}

	/**
	 * Configures performance settings
	 */
	withPerformance(options: {
		enableCompression?: boolean
		enableStreaming?: boolean
		maxConcurrentRequests?: number
		requestDeduplication?: boolean
	}): ConfigBuilder {
		this.config.performance = {
			...this.config.performance,
			...options,
		}
		return this
	}

	/**
	 * Adds custom headers
	 */
	withHeaders(headers: Record<string, string>): ConfigBuilder {
		this.config.customHeaders = {
			...this.config.customHeaders,
			...headers,
		}
		return this
	}

	/**
	 * Builds the configuration
	 */
	build(): PartialAuditClientConfig {
		return { ...this.config }
	}

	/**
	 * Builds and creates a ConfigManager instance
	 */
	createManager(): ConfigManager {
		return new ConfigManager(this.config)
	}
}

/**
 * Configuration presets for common use cases
 */
export class ConfigPresets {
	/**
	 * Creates a minimal configuration for quick setup
	 */
	static minimal(baseUrl: string, apiKey: string): PartialAuditClientConfig {
		return {
			baseUrl,
			authentication: {
				type: 'apiKey',
				apiKey,
			},
		}
	}

	/**
	 * Creates a development-friendly configuration
	 */
	static development(baseUrl: string, apiKey: string): PartialAuditClientConfig {
		return {
			...ConfigManager.createDefaultConfig('development'),
			baseUrl,
			authentication: {
				type: 'apiKey',
				apiKey,
			},
		}
	}

	/**
	 * Creates a production-ready configuration
	 */
	static production(baseUrl: string, apiKey: string): PartialAuditClientConfig {
		return {
			...ConfigManager.createDefaultConfig('production'),
			baseUrl,
			authentication: {
				type: 'apiKey',
				apiKey,
			},
		}
	}

	/**
	 * Creates a high-performance configuration
	 */
	static highPerformance(baseUrl: string, apiKey: string): PartialAuditClientConfig {
		return {
			baseUrl,
			authentication: {
				type: 'apiKey',
				apiKey,
			},
			performance: {
				enableCompression: true,
				enableStreaming: true,
				maxConcurrentRequests: 50,
				requestDeduplication: true,
				responseTransformation: true,
			},
			cache: {
				enabled: true,
				defaultTtlMs: 300000, // 5 minutes
				maxSize: 5000,
				storage: 'memory',
				compressionEnabled: true,
			},
			batching: {
				enabled: true,
				maxBatchSize: 20,
				batchTimeoutMs: 500,
			},
		}
	}

	/**
	 * Creates a configuration optimized for debugging
	 */
	static debugging(baseUrl: string, apiKey: string): PartialAuditClientConfig {
		return {
			baseUrl,
			authentication: {
				type: 'apiKey',
				apiKey,
			},
			logging: {
				enabled: true,
				level: 'debug',
				includeRequestBody: true,
				includeResponseBody: true,
				maskSensitiveData: false,
			},
			errorHandling: {
				throwOnError: true,
				includeStackTrace: true,
				errorTransformation: false,
			},
			retry: {
				enabled: false, // Disable retry for debugging
			},
			cache: {
				enabled: false, // Disable cache for debugging
			},
		}
	}

	/**
	 * Creates a configuration for mobile/React Native environments
	 */
	static mobile(baseUrl: string, apiKey: string): PartialAuditClientConfig {
		return {
			baseUrl,
			authentication: {
				type: 'apiKey',
				apiKey,
			},
			timeout: 15000, // Shorter timeout for mobile
			retry: {
				enabled: true,
				maxAttempts: 2, // Fewer retries for mobile
				initialDelayMs: 500,
				maxDelayMs: 5000,
			},
			cache: {
				enabled: true,
				defaultTtlMs: 600000, // 10 minutes
				storage: 'memory', // Use memory storage for mobile
				maxSize: 500, // Smaller cache for mobile
			},
			performance: {
				enableCompression: true,
				maxConcurrentRequests: 5, // Limit concurrent requests
			},
			logging: {
				enabled: true,
				level: 'warn', // Less verbose logging
				maskSensitiveData: true,
			},
		}
	}
}

/**
 * Configuration validation helpers
 */
export class ConfigValidators {
	/**
	 * Validates that required authentication is present
	 */
	static validateAuthentication(config: PartialAuditClientConfig): string[] {
		const errors: string[] = []

		if (!config.authentication) {
			errors.push('Authentication configuration is required')
			return errors
		}

		const { type, apiKey, sessionToken, bearerToken, customHeaders } = config.authentication

		switch (type) {
			case 'apiKey':
				if (!apiKey) {
					errors.push('API key is required for apiKey authentication')
				}
				break
			case 'session':
				if (!sessionToken) {
					errors.push('Session token is required for session authentication')
				}
				break
			case 'bearer':
				if (!bearerToken) {
					errors.push('Bearer token is required for bearer authentication')
				}
				break
			case 'custom':
				if (!customHeaders || Object.keys(customHeaders).length === 0) {
					errors.push('Custom headers are required for custom authentication')
				}
				break
		}

		return errors
	}

	/**
	 * Validates performance configuration for potential issues
	 */
	static validatePerformance(config: PartialAuditClientConfig): string[] {
		const warnings: string[] = []

		if (
			config.performance?.maxConcurrentRequests &&
			config.performance.maxConcurrentRequests > 100
		) {
			warnings.push('High concurrent request limit may cause performance issues')
		}

		if (config.cache?.maxSize && config.cache.maxSize > 10000) {
			warnings.push('Large cache size may consume significant memory')
		}

		if (config.retry?.maxAttempts && config.retry.maxAttempts > 5) {
			warnings.push('High retry attempts may cause long delays')
		}

		return warnings
	}

	/**
	 * Validates environment-specific configuration
	 */
	static validateEnvironment(config: PartialAuditClientConfig): string[] {
		const warnings: string[] = []

		if (config.environment === 'production') {
			if (config.logging?.level === 'debug') {
				warnings.push('Debug logging is not recommended for production')
			}

			if (config.logging?.includeRequestBody || config.logging?.includeResponseBody) {
				warnings.push('Including request/response bodies in logs is not recommended for production')
			}

			if (config.errorHandling?.includeStackTrace) {
				warnings.push('Including stack traces is not recommended for production')
			}

			if (!config.logging?.maskSensitiveData) {
				warnings.push('Sensitive data masking should be enabled in production')
			}
		}

		return warnings
	}
}

/**
 * Configuration migration helpers for version upgrades
 */
export class ConfigMigration {
	/**
	 * Migrates legacy configuration to new format
	 */
	static migrateLegacyConfig(legacyConfig: any): PartialAuditClientConfig {
		const migratedConfig: any = {}

		// Map legacy fields to new structure
		if (legacyConfig.baseUrl) {
			migratedConfig.baseUrl = legacyConfig.baseUrl
		}

		if (legacyConfig.apiKey) {
			migratedConfig.authentication = {
				type: 'apiKey',
				apiKey: legacyConfig.apiKey,
			}
		}

		if (legacyConfig.version) {
			migratedConfig.apiVersion = legacyConfig.version
		}

		if (legacyConfig.retries !== undefined) {
			migratedConfig.retry = {
				enabled: legacyConfig.retries > 0,
				maxAttempts: legacyConfig.retries,
			}
		}

		if (legacyConfig.backoffMs !== undefined) {
			migratedConfig.retry = {
				...migratedConfig.retry,
				initialDelayMs: legacyConfig.backoffMs,
			}
		}

		if (legacyConfig.maxBackoffMs !== undefined) {
			migratedConfig.retry = {
				...migratedConfig.retry,
				maxDelayMs: legacyConfig.maxBackoffMs,
			}
		}

		if (legacyConfig.headers) {
			migratedConfig.customHeaders = legacyConfig.headers
		}

		return migratedConfig
	}

	/**
	 * Gets migration warnings for deprecated configuration options
	 */
	static getMigrationWarnings(legacyConfig: any): string[] {
		const warnings: string[] = []

		if (legacyConfig.retries !== undefined) {
			warnings.push('The "retries" option has been moved to "retry.maxAttempts"')
		}

		if (legacyConfig.backoffMs !== undefined) {
			warnings.push('The "backoffMs" option has been moved to "retry.initialDelayMs"')
		}

		if (legacyConfig.maxBackoffMs !== undefined) {
			warnings.push('The "maxBackoffMs" option has been moved to "retry.maxDelayMs"')
		}

		if (legacyConfig.version !== undefined) {
			warnings.push('The "version" option has been renamed to "apiVersion"')
		}

		if (legacyConfig.headers !== undefined) {
			warnings.push('The "headers" option has been moved to "customHeaders"')
		}

		return warnings
	}
}
