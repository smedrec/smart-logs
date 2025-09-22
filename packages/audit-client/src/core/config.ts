import { z } from 'zod'

// Zod schemas for configuration validation
const AuthenticationConfigSchema = z.object({
	type: z.enum(['apiKey', 'session', 'bearer', 'custom']),
	apiKey: z.string().optional(),
	sessionToken: z.string().optional(),
	bearerToken: z.string().optional(),
	customHeaders: z.record(z.string()).optional(),
	autoRefresh: z.boolean().default(false),
	refreshEndpoint: z.string().optional(),
})

const RetryConfigSchema = z.object({
	enabled: z.boolean().default(true),
	maxAttempts: z.number().min(1).max(10).default(3),
	initialDelayMs: z.number().min(100).max(10000).default(1000),
	maxDelayMs: z.number().min(1000).max(60000).default(30000),
	backoffMultiplier: z.number().min(1).max(5).default(2),
	retryableStatusCodes: z.array(z.number()).default([408, 429, 500, 502, 503, 504]),
	retryableErrors: z.array(z.string()).default(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']),
})

const CacheConfigSchema = z.object({
	enabled: z.boolean().default(true),
	defaultTtlMs: z.number().min(1000).max(86400000).default(300000), // 5 minutes default
	maxSize: z.number().min(10).max(10000).default(1000),
	storage: z.enum(['memory', 'localStorage', 'sessionStorage', 'custom']).default('memory'),
	customStorage: z.any().optional(),
	keyPrefix: z.string().default('audit-client'),
	compressionEnabled: z.boolean().default(false),
})

const BatchingConfigSchema = z.object({
	enabled: z.boolean().default(false),
	maxBatchSize: z.number().min(1).max(100).default(10),
	batchTimeoutMs: z.number().min(100).max(10000).default(1000),
	batchableEndpoints: z.array(z.string()).default([]),
})

const PerformanceConfigSchema = z.object({
	enableCompression: z.boolean().default(true),
	enableStreaming: z.boolean().default(true),
	maxConcurrentRequests: z.number().min(1).max(100).default(10),
	requestDeduplication: z.boolean().default(true),
	responseTransformation: z.boolean().default(true),
	metricsCollection: z.boolean().default(true),
	metricsBufferSize: z.number().min(10).max(10000).default(1000),
	compressionThreshold: z.number().min(100).max(100000).default(1024),
	streamingThreshold: z.number().min(1000).max(1000000).default(10240),
})

const LoggingConfigSchema = z.object({
	enabled: z.boolean().default(true),
	level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
	format: z.enum(['json', 'text', 'structured']).default('text'),
	includeRequestBody: z.boolean().default(false),
	includeResponseBody: z.boolean().default(false),
	maskSensitiveData: z.boolean().default(true),
	sensitiveFields: z.array(z.string()).default([]),
	maxLogSize: z.number().min(1000).max(100000).default(10000),
	enableConsole: z.boolean().default(true),
	enableBuffer: z.boolean().default(false),
	bufferSize: z.number().min(10).max(10000).default(1000),
	component: z.string().optional(),
	customLogger: z.any().optional(),
})

const ErrorHandlingConfigSchema = z.object({
	throwOnError: z.boolean().default(true),
	includeStackTrace: z.boolean().default(false),
	transformErrors: z.boolean().default(true),
	sanitizeErrors: z.boolean().default(true),
	enableRecovery: z.boolean().default(true),
	customErrorHandler: z.any().optional(),
})

const InterceptorConfigSchema = z.object({
	request: z.array(z.any()).optional(),
	response: z.array(z.any()).optional(),
})

const PluginConfigSchema = z.object({
	enabled: z.boolean().default(true),
	autoLoad: z.boolean().default(true),
	plugins: z
		.array(
			z.object({
				name: z.string(),
				type: z.enum(['middleware', 'storage', 'auth']).optional(),
				enabled: z.boolean().default(true),
				config: z.any().optional(),
				priority: z.number().default(0),
			})
		)
		.default([]),
	middleware: z
		.object({
			enabled: z.boolean().default(true),
			plugins: z.array(z.string()).default([]),
		})
		.default({}),
	storage: z
		.object({
			enabled: z.boolean().default(true),
			defaultPlugin: z.string().optional(),
			plugins: z.record(z.any()).default({}),
		})
		.default({}),
	auth: z
		.object({
			enabled: z.boolean().default(true),
			defaultPlugin: z.string().optional(),
			plugins: z.record(z.any()).default({}),
		})
		.default({}),
})

// Main configuration schema
const AuditClientConfigSchema = z.object({
	// Connection settings
	baseUrl: z.string().url('Base URL must be a valid URL'),
	apiVersion: z.string().default('v1'),
	timeout: z.number().min(1000).max(300000).default(30000), // 30 seconds default

	// Authentication
	authentication: AuthenticationConfigSchema,

	// Retry configuration
	retry: RetryConfigSchema.default({}),

	// Caching configuration
	cache: CacheConfigSchema.default({}),

	// Request batching
	batching: BatchingConfigSchema.default({}),

	// Performance optimization
	performance: PerformanceConfigSchema.default({}),

	// Logging and debugging
	logging: LoggingConfigSchema.default({}),

	// Error handling
	errorHandling: ErrorHandlingConfigSchema.default({}),

	// Plugin configuration
	plugins: PluginConfigSchema.default({}),

	// Environment-specific settings
	environment: z.enum(['development', 'staging', 'production']).optional(),
	customHeaders: z.record(z.string()).default({}),
	interceptors: InterceptorConfigSchema.default({}),
})

// TypeScript interfaces derived from Zod schemas
export type AuthenticationConfig = z.infer<typeof AuthenticationConfigSchema>
export type RetryConfig = z.infer<typeof RetryConfigSchema>
export type CacheConfig = z.infer<typeof CacheConfigSchema>
export type BatchingConfig = z.infer<typeof BatchingConfigSchema>
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>
export type ErrorHandlingConfig = z.infer<typeof ErrorHandlingConfigSchema>
export type InterceptorConfig = z.infer<typeof InterceptorConfigSchema>
export type PluginConfig = z.infer<typeof PluginConfigSchema>
export type AuditClientConfig = z.infer<typeof AuditClientConfigSchema>

// Partial configuration for updates
export type PartialAuditClientConfig = z.input<typeof AuditClientConfigSchema>

// Environment-specific configuration interfaces
export interface EnvironmentConfig {
	development?: Partial<AuditClientConfig>
	staging?: Partial<AuditClientConfig>
	production?: Partial<AuditClientConfig>
	[key: string]: Partial<AuditClientConfig> | undefined
}

// Configuration validation result
export interface ConfigValidationResult {
	isValid: boolean
	config?: AuditClientConfig
	errors?: z.ZodError
}

// Configuration manager class
export class ConfigManager {
	private config: AuditClientConfig
	private environmentConfigs: EnvironmentConfig = {}

	constructor(config: PartialAuditClientConfig) {
		this.config = this.validateAndNormalizeConfig(config)
	}

	/**
	 * Validates and normalizes the configuration using Zod schemas
	 */
	private validateAndNormalizeConfig(config: PartialAuditClientConfig): AuditClientConfig {
		try {
			return AuditClientConfigSchema.parse(config)
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new ConfigurationError('Invalid configuration provided', error.errors)
			}
			throw error
		}
	}

	/**
	 * Gets the current configuration
	 */
	getConfig(): AuditClientConfig {
		return { ...this.config }
	}

	/**
	 * Updates the configuration with new values
	 */
	updateConfig(updates: Partial<AuditClientConfig>): void {
		const mergedConfig = this.mergeConfigurations(this.config, updates)
		this.config = this.validateAndNormalizeConfig(mergedConfig)
	}

	/**
	 * Loads environment-specific configuration
	 */
	loadEnvironmentConfig(environment: string, envConfig: Partial<AuditClientConfig>): void {
		;(this.environmentConfigs as any)[environment] = envConfig

		// Apply environment config if it matches current environment
		if (this.config.environment === environment) {
			this.applyEnvironmentConfig(environment)
		}
	}

	/**
	 * Applies environment-specific configuration
	 */
	private applyEnvironmentConfig(environment: string): void {
		const envConfig = this.environmentConfigs[environment as keyof EnvironmentConfig]
		if (envConfig) {
			const mergedConfig = this.mergeConfigurations(this.config, envConfig)
			this.config = this.validateAndNormalizeConfig(mergedConfig)
		}
	}

	/**
	 * Merges two configuration objects with deep merge for nested objects
	 */
	private mergeConfigurations(
		base: Partial<AuditClientConfig>,
		override: Partial<AuditClientConfig>
	): PartialAuditClientConfig {
		const result: any = { ...base }

		for (const [key, value] of Object.entries(override)) {
			if (value !== undefined) {
				if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
					// Deep merge for nested objects
					result[key] = {
						...(result[key] || {}),
						...value,
					}
				} else {
					// Direct assignment for primitives and arrays
					result[key] = value
				}
			}
		}

		return result as PartialAuditClientConfig
	}

	/**
	 * Validates a configuration object without applying it
	 */
	static validateConfig(config: PartialAuditClientConfig): ConfigValidationResult {
		try {
			const validatedConfig = AuditClientConfigSchema.parse(config)
			return {
				isValid: true,
				config: validatedConfig,
			}
		} catch (error) {
			if (error instanceof z.ZodError) {
				return {
					isValid: false,
					errors: error,
				}
			}
			throw error
		}
	}

	/**
	 * Creates a configuration from environment variables
	 */
	static fromEnvironment(envPrefix = 'AUDIT_CLIENT_'): PartialAuditClientConfig {
		const config: any = {}

		// Helper function to get environment variable
		const getEnvVar = (key: string): string | undefined => {
			if (typeof process !== 'undefined' && process.env) {
				return process.env[`${envPrefix}${key}`]
			}
			return undefined
		}

		// Helper function to parse boolean
		const parseBoolean = (value: string | undefined): boolean | undefined => {
			if (value === undefined) return undefined
			return value.toLowerCase() === 'true'
		}

		// Helper function to parse number
		const parseNumber = (value: string | undefined): number | undefined => {
			if (value === undefined) return undefined
			const parsed = parseInt(value, 10)
			return isNaN(parsed) ? undefined : parsed
		}

		// Helper function to parse JSON
		const parseJSON = (value: string | undefined): any => {
			if (value === undefined) return undefined
			try {
				return JSON.parse(value)
			} catch {
				return undefined
			}
		}

		// Basic configuration
		const baseUrl = getEnvVar('BASE_URL')
		if (baseUrl) config.baseUrl = baseUrl

		const apiVersion = getEnvVar('API_VERSION')
		if (apiVersion) config.apiVersion = apiVersion

		const timeout = parseNumber(getEnvVar('TIMEOUT'))
		if (timeout) config.timeout = timeout

		const environment = getEnvVar('ENVIRONMENT') as 'development' | 'staging' | 'production'
		if (environment) config.environment = environment

		// Authentication configuration
		const authType = getEnvVar('AUTH_TYPE') as 'apiKey' | 'session' | 'bearer' | 'custom'
		if (authType) {
			config.authentication = {
				type: authType,
				apiKey: getEnvVar('API_KEY'),
				sessionToken: getEnvVar('SESSION_TOKEN'),
				bearerToken: getEnvVar('BEARER_TOKEN'),
				autoRefresh: parseBoolean(getEnvVar('AUTH_AUTO_REFRESH')),
				refreshEndpoint: getEnvVar('AUTH_REFRESH_ENDPOINT'),
				customHeaders: parseJSON(getEnvVar('AUTH_CUSTOM_HEADERS')),
			}
		}

		// Retry configuration
		const retryEnabled = parseBoolean(getEnvVar('RETRY_ENABLED'))
		if (retryEnabled !== undefined) {
			config.retry = {
				enabled: retryEnabled,
				maxAttempts: parseNumber(getEnvVar('RETRY_MAX_ATTEMPTS')),
				initialDelayMs: parseNumber(getEnvVar('RETRY_INITIAL_DELAY_MS')),
				maxDelayMs: parseNumber(getEnvVar('RETRY_MAX_DELAY_MS')),
				backoffMultiplier: parseNumber(getEnvVar('RETRY_BACKOFF_MULTIPLIER')),
				retryableStatusCodes: parseJSON(getEnvVar('RETRY_STATUS_CODES')),
				retryableErrors: parseJSON(getEnvVar('RETRY_ERRORS')),
			}
		}

		// Cache configuration
		const cacheEnabled = parseBoolean(getEnvVar('CACHE_ENABLED'))
		if (cacheEnabled !== undefined) {
			config.cache = {
				enabled: cacheEnabled,
				defaultTtlMs: parseNumber(getEnvVar('CACHE_DEFAULT_TTL_MS')),
				maxSize: parseNumber(getEnvVar('CACHE_MAX_SIZE')),
				storage: getEnvVar('CACHE_STORAGE') as
					| 'memory'
					| 'localStorage'
					| 'sessionStorage'
					| 'custom',
				keyPrefix: getEnvVar('CACHE_KEY_PREFIX'),
				compressionEnabled: parseBoolean(getEnvVar('CACHE_COMPRESSION_ENABLED')),
			}
		}

		// Logging configuration
		const loggingEnabled = parseBoolean(getEnvVar('LOGGING_ENABLED'))
		if (loggingEnabled !== undefined) {
			config.logging = {
				enabled: loggingEnabled,
				level: getEnvVar('LOGGING_LEVEL') as 'debug' | 'info' | 'warn' | 'error',
				format: getEnvVar('LOGGING_FORMAT') as 'json' | 'text' | 'structured',
				includeRequestBody: parseBoolean(getEnvVar('LOGGING_INCLUDE_REQUEST_BODY')),
				includeResponseBody: parseBoolean(getEnvVar('LOGGING_INCLUDE_RESPONSE_BODY')),
				maskSensitiveData: parseBoolean(getEnvVar('LOGGING_MASK_SENSITIVE_DATA')),
				sensitiveFields: parseJSON(getEnvVar('LOGGING_SENSITIVE_FIELDS')),
				maxLogSize: parseNumber(getEnvVar('LOGGING_MAX_LOG_SIZE')),
				enableConsole: parseBoolean(getEnvVar('LOGGING_ENABLE_CONSOLE')),
				enableBuffer: parseBoolean(getEnvVar('LOGGING_ENABLE_BUFFER')),
				bufferSize: parseNumber(getEnvVar('LOGGING_BUFFER_SIZE')),
				component: getEnvVar('LOGGING_COMPONENT'),
			}
		}

		// Custom headers
		const customHeaders = parseJSON(getEnvVar('CUSTOM_HEADERS'))
		if (customHeaders) config.customHeaders = customHeaders

		return config
	}

	/**
	 * Creates default configuration for different environments
	 */
	static createDefaultConfig(
		environment: 'development' | 'staging' | 'production'
	): PartialAuditClientConfig {
		const baseConfig: any = {
			environment,
			authentication: {
				type: 'apiKey',
			},
		}

		switch (environment) {
			case 'development':
				return {
					...baseConfig,
					logging: {
						enabled: true,
						level: 'debug',
						includeRequestBody: true,
						includeResponseBody: true,
					},
					errorHandling: {
						includeStackTrace: true,
					},
					retry: {
						maxAttempts: 2,
					},
				}

			case 'staging':
				return {
					...baseConfig,
					logging: {
						enabled: true,
						level: 'info',
						includeRequestBody: false,
						includeResponseBody: false,
					},
					errorHandling: {
						includeStackTrace: false,
					},
					performance: {
						enableCompression: true,
						enableStreaming: true,
					},
				}

			case 'production':
				return {
					...baseConfig,
					logging: {
						enabled: true,
						level: 'warn',
						includeRequestBody: false,
						includeResponseBody: false,
						maskSensitiveData: true,
					},
					errorHandling: {
						includeStackTrace: false,
					},
					performance: {
						enableCompression: true,
						enableStreaming: true,
						maxConcurrentRequests: 20,
					},
					cache: {
						enabled: true,
						defaultTtlMs: 600000, // 10 minutes
					},
				}

			default:
				return baseConfig
		}
	}
}

// Custom error class for configuration errors
export class ConfigurationError extends Error {
	public readonly errors: z.ZodIssue[]

	constructor(message: string, errors: z.ZodIssue[] = []) {
		super(message)
		this.name = 'ConfigurationError'
		this.errors = errors
	}

	/**
	 * Gets a formatted error message with all validation errors
	 */
	getFormattedErrors(): string {
		if (this.errors.length === 0) {
			return this.message
		}

		const errorMessages = this.errors.map((error) => {
			const path = error.path.join('.')
			return `${path}: ${error.message}`
		})

		return `${this.message}\n${errorMessages.join('\n')}`
	}
}

// Export schemas for external validation if needed
export {
	AuditClientConfigSchema,
	AuthenticationConfigSchema,
	RetryConfigSchema,
	CacheConfigSchema,
	BatchingConfigSchema,
	PerformanceConfigSchema,
	LoggingConfigSchema,
	ErrorHandlingConfigSchema,
	PluginConfigSchema,
}
