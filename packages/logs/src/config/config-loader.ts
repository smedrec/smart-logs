import { ConfigValidator } from '../types/config.js'

import type { LoggingConfig } from '../types/config.js'

/**
 * Configuration loader with environment variable support
 * Addresses requirement 1.3: Runtime validation with clear error messages
 */
export class ConfigLoader {
	/**
	 * Load configuration from environment variables and provided config
	 */
	static load(providedConfig: Partial<LoggingConfig> = {}): LoggingConfig {
		// Extract configuration from environment variables
		const envConfig = this.loadFromEnvironment()

		// Merge configurations: defaults < environment < provided
		const mergedConfig = {
			...envConfig,
			...providedConfig,
		}

		// Validate the final configuration
		return ConfigValidator.validate(mergedConfig)
	}

	/**
	 * Load configuration from environment variables
	 */
	private static loadFromEnvironment(): Partial<LoggingConfig> {
		const config: Partial<LoggingConfig> = {}

		// Core settings
		if (process.env.LOG_LEVEL) {
			config.level = process.env.LOG_LEVEL as any
		}
		if (process.env.LOG_SERVICE) {
			config.service = process.env.LOG_SERVICE
		}
		if (process.env.LOG_ENVIRONMENT) {
			config.environment = process.env.LOG_ENVIRONMENT
		}
		if (process.env.LOG_VERSION) {
			config.version = process.env.LOG_VERSION
		}

		// Console transport
		if (process.env.LOG_CONSOLE_ENABLED !== undefined) {
			config.console = {
				enabled: process.env.LOG_CONSOLE_ENABLED === 'true',
			} as any
		}
		if (process.env.LOG_CONSOLE_FORMAT) {
			config.console = {
				...config.console,
				format: process.env.LOG_CONSOLE_FORMAT as 'json' | 'pretty',
			} as any
		}

		// File transport
		if (process.env.LOG_FILE_ENABLED !== undefined) {
			config.file = {
				enabled: process.env.LOG_FILE_ENABLED === 'true',
			} as any
		}
		if (process.env.LOG_FILE_FILENAME) {
			config.file = {
				...config.file,
				filename: process.env.LOG_FILE_FILENAME,
			} as any
		}

		// OTLP transport
		if (process.env.LOG_OTLP_ENABLED !== undefined) {
			config.otlp = {
				enabled: process.env.LOG_OTLP_ENABLED === 'true',
			} as any
		}
		if (process.env.LOG_OTLP_ENDPOINT) {
			config.otlp = {
				...config.otlp,
				endpoint: process.env.LOG_OTLP_ENDPOINT,
			} as any
		}

		// Redis transport
		if (process.env.LOG_REDIS_ENABLED !== undefined) {
			config.redis = {
				enabled: process.env.LOG_REDIS_ENABLED === 'true',
			} as any
		}
		if (process.env.LOG_REDIS_HOST) {
			config.redis = {
				...config.redis,
				host: process.env.LOG_REDIS_HOST,
			} as any
		}
		if (process.env.LOG_REDIS_PORT) {
			config.redis = {
				...config.redis,
				port: parseInt(process.env.LOG_REDIS_PORT, 10),
			} as any
		}

		// Performance settings
		if (process.env.LOG_PERFORMANCE_ENABLED !== undefined) {
			config.performance = {
				enabled: process.env.LOG_PERFORMANCE_ENABLED === 'true',
			} as any
		}
		if (process.env.LOG_PERFORMANCE_SAMPLE_RATE) {
			config.performance = {
				...config.performance,
				sampleRate: parseFloat(process.env.LOG_PERFORMANCE_SAMPLE_RATE),
			} as any
		}

		return config
	}

	/**
	 * Validate configuration without loading defaults
	 */
	static validate(config: unknown): LoggingConfig {
		return ConfigValidator.validate(config)
	}

	/**
	 * Get default configuration
	 */
	static getDefaults(): LoggingConfig {
		return ConfigValidator.validate({})
	}
}
