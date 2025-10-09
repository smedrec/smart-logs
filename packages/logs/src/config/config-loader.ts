import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ConfigValidator } from '../types/config.js'

import type { LoggingConfig } from '../types/config.js'

/**
 * Configuration loader with environment variable, file, and runtime support
 * Addresses requirements 7.1, 7.2, 1.3, 1.4: Runtime validation with clear error messages
 */
export class ConfigLoader {
	private static readonly CONFIG_FILE_NAMES = [
		'logging.config.json',
		'logging.config.js',
		'.loggingrc.json',
		'.loggingrc.js',
	]

	/**
	 * Load configuration from multiple sources with proper precedence
	 * Order: defaults < config file < environment variables < provided config
	 */
	static load(providedConfig: Partial<LoggingConfig> = {}): LoggingConfig {
		// Start with defaults
		const defaults = this.getDefaults()

		// Load from configuration file if it exists
		const fileConfig = this.loadFromFile()

		// Extract configuration from environment variables
		const envConfig = this.loadFromEnvironment()

		// Merge configurations with proper precedence
		const mergedConfig = {
			...defaults,
			...fileConfig,
			...envConfig,
			...providedConfig,
		}

		// Validate the final configuration
		return ConfigValidator.validate(mergedConfig)
	}

	/**
	 * Load configuration from file
	 */
	static loadFromFile(configPath?: string): Partial<LoggingConfig> {
		let filePath: string | undefined

		if (configPath) {
			// Use provided path
			filePath = resolve(configPath)
		} else {
			// Search for config files in current directory
			filePath = this.CONFIG_FILE_NAMES.map((name) => resolve(process.cwd(), name)).find((path) =>
				existsSync(path)
			)
		}

		if (!filePath || !existsSync(filePath)) {
			return {}
		}

		try {
			const content = readFileSync(filePath, 'utf-8')

			if (filePath.endsWith('.json')) {
				return JSON.parse(content)
			} else if (filePath.endsWith('.js')) {
				// For .js files, we would need dynamic import, but for now just support JSON
				throw new Error('JavaScript config files are not yet supported. Please use JSON format.')
			}

			return JSON.parse(content)
		} catch (error) {
			throw new Error(
				`Failed to load configuration from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}
	}

	/**
	 * Load configuration from environment variables with proper type conversion
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

		// Reliability settings
		if (process.env.LOG_SHUTDOWN_TIMEOUT_MS) {
			config.shutdownTimeoutMs = this.parseNumber(
				process.env.LOG_SHUTDOWN_TIMEOUT_MS,
				'LOG_SHUTDOWN_TIMEOUT_MS'
			)
		}
		if (process.env.LOG_ENABLE_CORRELATION_IDS !== undefined) {
			config.enableCorrelationIds = this.parseBoolean(process.env.LOG_ENABLE_CORRELATION_IDS)
		}
		if (process.env.LOG_ENABLE_REQUEST_TRACKING !== undefined) {
			config.enableRequestTracking = this.parseBoolean(process.env.LOG_ENABLE_REQUEST_TRACKING)
		}

		// Console transport
		const consoleConfig = this.loadConsoleConfig()
		if (consoleConfig) {
			config.console = consoleConfig
		}

		// File transport
		const fileConfig = this.loadFileConfig()
		if (fileConfig) {
			config.file = fileConfig
		}

		// OTLP transport
		const otlpConfig = this.loadOTLPConfig()
		if (otlpConfig) {
			config.otlp = otlpConfig
		}

		// Redis transport
		const redisConfig = this.loadRedisConfig()
		if (redisConfig) {
			config.redis = redisConfig
		}

		// Performance settings
		const performanceConfig = this.loadPerformanceConfig()
		if (performanceConfig) {
			config.performance = performanceConfig
		}

		// Batch settings
		const batchConfig = this.loadBatchConfig()
		if (batchConfig) {
			config.batch = batchConfig
		}

		// Retry settings
		const retryConfig = this.loadRetryConfig()
		if (retryConfig) {
			config.retry = retryConfig
		}

		// Remove undefined values to allow proper merging
		return this.removeUndefinedValues(config)
	}

	/**
	 * Load console transport configuration from environment
	 */
	private static loadConsoleConfig(): LoggingConfig['console'] | undefined {
		const config: any = {}
		let hasValues = false

		if (process.env.LOG_CONSOLE_ENABLED !== undefined) {
			config.enabled = this.parseBoolean(process.env.LOG_CONSOLE_ENABLED)
			hasValues = true
		}
		if (process.env.LOG_CONSOLE_FORMAT) {
			config.format = process.env.LOG_CONSOLE_FORMAT
			hasValues = true
		}
		if (process.env.LOG_CONSOLE_COLORIZE !== undefined) {
			config.colorize = this.parseBoolean(process.env.LOG_CONSOLE_COLORIZE)
			hasValues = true
		}
		if (process.env.LOG_CONSOLE_LEVEL) {
			config.level = process.env.LOG_CONSOLE_LEVEL
			hasValues = true
		}

		return hasValues ? config : undefined
	}

	/**
	 * Load file transport configuration from environment
	 */
	private static loadFileConfig(): LoggingConfig['file'] | undefined {
		const config: any = {}
		let hasValues = false

		if (process.env.LOG_FILE_ENABLED !== undefined) {
			config.enabled = this.parseBoolean(process.env.LOG_FILE_ENABLED)
			hasValues = true
		}
		if (process.env.LOG_FILE_FILENAME) {
			config.filename = process.env.LOG_FILE_FILENAME
			hasValues = true
		}
		if (process.env.LOG_FILE_MAX_SIZE) {
			config.maxSize = this.parseNumber(process.env.LOG_FILE_MAX_SIZE, 'LOG_FILE_MAX_SIZE')
			hasValues = true
		}
		if (process.env.LOG_FILE_MAX_FILES) {
			config.maxFiles = this.parseNumber(process.env.LOG_FILE_MAX_FILES, 'LOG_FILE_MAX_FILES')
			hasValues = true
		}
		if (process.env.LOG_FILE_ROTATE_DAILY !== undefined) {
			config.rotateDaily = this.parseBoolean(process.env.LOG_FILE_ROTATE_DAILY)
			hasValues = true
		}
		if (process.env.LOG_FILE_COMPRESS !== undefined) {
			config.compress = this.parseBoolean(process.env.LOG_FILE_COMPRESS)
			hasValues = true
		}
		if (process.env.LOG_FILE_RETENTION_DAYS) {
			config.retentionDays = this.parseNumber(
				process.env.LOG_FILE_RETENTION_DAYS,
				'LOG_FILE_RETENTION_DAYS'
			)
			hasValues = true
		}

		return hasValues ? config : undefined
	}

	/**
	 * Load OTLP transport configuration from environment
	 */
	private static loadOTLPConfig(): LoggingConfig['otlp'] | undefined {
		const config: any = {}
		let hasValues = false

		if (process.env.LOG_OTLP_ENABLED !== undefined) {
			config.enabled = this.parseBoolean(process.env.LOG_OTLP_ENABLED)
			hasValues = true
		}
		if (process.env.LOG_OTLP_ENDPOINT) {
			config.endpoint = process.env.LOG_OTLP_ENDPOINT
			hasValues = true
		}
		if (process.env.LOG_OTLP_TIMEOUT_MS) {
			config.timeoutMs = this.parseNumber(process.env.LOG_OTLP_TIMEOUT_MS, 'LOG_OTLP_TIMEOUT_MS')
			hasValues = true
		}
		if (process.env.LOG_OTLP_BATCH_SIZE) {
			config.batchSize = this.parseNumber(process.env.LOG_OTLP_BATCH_SIZE, 'LOG_OTLP_BATCH_SIZE')
			hasValues = true
		}
		if (process.env.LOG_OTLP_BATCH_TIMEOUT_MS) {
			config.batchTimeoutMs = this.parseNumber(
				process.env.LOG_OTLP_BATCH_TIMEOUT_MS,
				'LOG_OTLP_BATCH_TIMEOUT_MS'
			)
			hasValues = true
		}
		if (process.env.LOG_OTLP_MAX_CONCURRENCY) {
			config.maxConcurrency = this.parseNumber(
				process.env.LOG_OTLP_MAX_CONCURRENCY,
				'LOG_OTLP_MAX_CONCURRENCY'
			)
			hasValues = true
		}

		// Parse headers from JSON string
		if (process.env.LOG_OTLP_HEADERS) {
			try {
				config.headers = JSON.parse(process.env.LOG_OTLP_HEADERS)
				hasValues = true
			} catch (error) {
				throw new Error(
					`Invalid JSON in LOG_OTLP_HEADERS: ${error instanceof Error ? error.message : 'Unknown error'}`
				)
			}
		}

		return hasValues ? config : undefined
	}

	/**
	 * Load Redis transport configuration from environment
	 */
	private static loadRedisConfig(): LoggingConfig['redis'] | undefined {
		const config: any = {}
		let hasValues = false

		if (process.env.LOG_REDIS_ENABLED !== undefined) {
			config.enabled = this.parseBoolean(process.env.LOG_REDIS_ENABLED)
			hasValues = true
		}
		if (process.env.LOG_REDIS_HOST) {
			config.host = process.env.LOG_REDIS_HOST
			hasValues = true
		}
		if (process.env.LOG_REDIS_PORT) {
			config.port = this.parseNumber(process.env.LOG_REDIS_PORT, 'LOG_REDIS_PORT')
			hasValues = true
		}
		if (process.env.LOG_REDIS_PASSWORD) {
			config.password = process.env.LOG_REDIS_PASSWORD
			hasValues = true
		}
		if (process.env.LOG_REDIS_DATABASE) {
			config.database = this.parseNumber(process.env.LOG_REDIS_DATABASE, 'LOG_REDIS_DATABASE')
			hasValues = true
		}
		if (process.env.LOG_REDIS_KEY_PREFIX) {
			config.keyPrefix = process.env.LOG_REDIS_KEY_PREFIX
			hasValues = true
		}
		if (process.env.LOG_REDIS_LIST_NAME) {
			config.listName = process.env.LOG_REDIS_LIST_NAME
			hasValues = true
		}

		return hasValues ? config : undefined
	}

	/**
	 * Load performance configuration from environment
	 */
	private static loadPerformanceConfig(): LoggingConfig['performance'] | undefined {
		const config: any = {}
		let hasValues = false

		if (process.env.LOG_PERFORMANCE_ENABLED !== undefined) {
			config.enabled = this.parseBoolean(process.env.LOG_PERFORMANCE_ENABLED)
			hasValues = true
		}
		if (process.env.LOG_PERFORMANCE_SAMPLE_RATE) {
			config.sampleRate = this.parseFloat(
				process.env.LOG_PERFORMANCE_SAMPLE_RATE,
				'LOG_PERFORMANCE_SAMPLE_RATE'
			)
			hasValues = true
		}
		if (process.env.LOG_PERFORMANCE_COLLECT_CPU !== undefined) {
			config.collectCpuUsage = this.parseBoolean(process.env.LOG_PERFORMANCE_COLLECT_CPU)
			hasValues = true
		}
		if (process.env.LOG_PERFORMANCE_COLLECT_MEMORY !== undefined) {
			config.collectMemoryUsage = this.parseBoolean(process.env.LOG_PERFORMANCE_COLLECT_MEMORY)
			hasValues = true
		}

		return hasValues ? config : undefined
	}

	/**
	 * Load batch configuration from environment
	 */
	private static loadBatchConfig(): LoggingConfig['batch'] | undefined {
		const config: any = {}
		let hasValues = false

		if (process.env.LOG_BATCH_MAX_SIZE) {
			config.maxSize = this.parseNumber(process.env.LOG_BATCH_MAX_SIZE, 'LOG_BATCH_MAX_SIZE')
			hasValues = true
		}
		if (process.env.LOG_BATCH_TIMEOUT_MS) {
			config.timeoutMs = this.parseNumber(process.env.LOG_BATCH_TIMEOUT_MS, 'LOG_BATCH_TIMEOUT_MS')
			hasValues = true
		}
		if (process.env.LOG_BATCH_MAX_CONCURRENCY) {
			config.maxConcurrency = this.parseNumber(
				process.env.LOG_BATCH_MAX_CONCURRENCY,
				'LOG_BATCH_MAX_CONCURRENCY'
			)
			hasValues = true
		}
		if (process.env.LOG_BATCH_MAX_QUEUE_SIZE) {
			config.maxQueueSize = this.parseNumber(
				process.env.LOG_BATCH_MAX_QUEUE_SIZE,
				'LOG_BATCH_MAX_QUEUE_SIZE'
			)
			hasValues = true
		}

		return hasValues ? config : undefined
	}

	/**
	 * Load retry configuration from environment
	 */
	private static loadRetryConfig(): LoggingConfig['retry'] | undefined {
		const config: any = {}
		let hasValues = false

		if (process.env.LOG_RETRY_MAX_ATTEMPTS) {
			config.maxAttempts = this.parseNumber(
				process.env.LOG_RETRY_MAX_ATTEMPTS,
				'LOG_RETRY_MAX_ATTEMPTS'
			)
			hasValues = true
		}
		if (process.env.LOG_RETRY_INITIAL_DELAY_MS) {
			config.initialDelayMs = this.parseNumber(
				process.env.LOG_RETRY_INITIAL_DELAY_MS,
				'LOG_RETRY_INITIAL_DELAY_MS'
			)
			hasValues = true
		}
		if (process.env.LOG_RETRY_MAX_DELAY_MS) {
			config.maxDelayMs = this.parseNumber(
				process.env.LOG_RETRY_MAX_DELAY_MS,
				'LOG_RETRY_MAX_DELAY_MS'
			)
			hasValues = true
		}
		if (process.env.LOG_RETRY_MULTIPLIER) {
			config.multiplier = this.parseFloat(process.env.LOG_RETRY_MULTIPLIER, 'LOG_RETRY_MULTIPLIER')
			hasValues = true
		}

		return hasValues ? config : undefined
	}

	/**
	 * Parse boolean value from string
	 */
	private static parseBoolean(value: string): boolean {
		const normalized = value.toLowerCase().trim()
		if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
			return true
		}
		if (normalized === 'false' || normalized === '0' || normalized === 'no') {
			return false
		}
		throw new Error(`Invalid boolean value: ${value}. Expected: true, false, 1, 0, yes, no`)
	}

	/**
	 * Parse number value from string
	 */
	private static parseNumber(value: string, envVarName: string): number {
		const parsed = parseInt(value, 10)
		if (isNaN(parsed)) {
			throw new Error(`Invalid number value for ${envVarName}: ${value}`)
		}
		return parsed
	}

	/**
	 * Parse float value from string
	 */
	private static parseFloat(value: string, envVarName: string): number {
		const parsed = parseFloat(value)
		if (isNaN(parsed)) {
			throw new Error(`Invalid float value for ${envVarName}: ${value}`)
		}
		return parsed
	}

	/**
	 * Remove undefined values from configuration object
	 */
	private static removeUndefinedValues(obj: any): any {
		const result: any = {}
		for (const [key, value] of Object.entries(obj)) {
			if (value !== undefined) {
				if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
					const cleaned = this.removeUndefinedValues(value)
					if (Object.keys(cleaned).length > 0) {
						result[key] = cleaned
					}
				} else {
					result[key] = value
				}
			}
		}
		return result
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
	static getDefaults(): Partial<LoggingConfig> {
		return {
			level: 'info',
			service: 'application',
			environment: 'development',
			version: '1.0.0',
			shutdownTimeoutMs: 30000,
			enableCorrelationIds: true,
			enableRequestTracking: true,
			enableDebugMode: false,
			prettyPrint: true,
		}
	}

	/**
	 * Load and validate configuration from a specific file path
	 */
	static loadFromPath(
		configPath: string,
		providedConfig: Partial<LoggingConfig> = {}
	): LoggingConfig {
		const defaults = this.getDefaults()
		const fileConfig = this.loadFromFile(configPath)
		const envConfig = this.loadFromEnvironment()

		const mergedConfig = {
			...defaults,
			...fileConfig,
			...envConfig,
			...providedConfig,
		}

		return ConfigValidator.validate(mergedConfig)
	}

	/**
	 * Validate partial configuration (useful for updates)
	 */
	static validatePartial(config: unknown): Partial<LoggingConfig> {
		return ConfigValidator.validatePartial(config)
	}
}
