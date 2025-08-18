import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import {
	ConfigValidationError,
	getDefaultConfig,
	validateCompleteConfig,
	validateConfig,
} from './schema.js'

import type { CompleteConfig, Environment, ServerConfig } from './schema.js'

/**
 * Configuration loader with environment-specific overrides and validation
 */

// Environment variable mapping interface
interface EnvVarMapping {
	// Server configuration
	PORT?: number
	HOST?: string
	NODE_ENV?: Environment

	// CORS configuration
	CORS_ORIGIN?: string
	CORS_CREDENTIALS?: boolean

	// Rate limiting
	RATE_LIMIT_WINDOW_MS?: number
	RATE_LIMIT_MAX_REQUESTS?: number

	// Database configuration
	DATABASE_URL?: string
	DB_POOL_SIZE?: number
	DB_CONNECTION_TIMEOUT?: number
	DB_IDLE_TIMEOUT?: number
	DB_SSL?: boolean

	// Redis configuration
	REDIS_URL?: string
	REDIS_MAX_RETRIES?: number
	REDIS_RETRY_DELAY?: number

	// Authentication configuration
	BETTER_AUTH_SECRET?: string
	BETTER_AUTH_URL?: string
	BETTER_AUTH_REDIS_URL?: string
	BETTER_AUTH_DB_URL?: string
	BETTER_AUTH_DB_POOL_SIZE?: number
	SESSION_MAX_AGE?: number

	// Security configuration
	ENCRYPTION_KEY?: string
	API_KEY_HEADER?: string
	ENABLE_API_KEY_AUTH?: boolean

	// Monitoring configuration
	LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error'
	ENABLE_METRICS?: boolean
	METRICS_PATH?: string
	HEALTH_CHECK_PATH?: string

	// Performance configuration
	ENABLE_COMPRESSION?: boolean
	COMPRESSION_LEVEL?: number
	ENABLE_CACHING?: boolean
	CACHE_MAX_AGE?: number

	// API configuration
	ENABLE_TRPC?: boolean
	ENABLE_REST?: boolean
	ENABLE_GRAPHQL?: boolean
	ENABLE_OPENAPI?: boolean

	// External services
	SMTP_HOST?: string
	SMTP_PORT?: number
	SMTP_SECURE?: boolean
	SMTP_USER?: string
	SMTP_PASS?: string
	SMTP_FROM?: string
	WEBHOOK_URL?: string
	WEBHOOK_TOKEN?: string
	STORAGE_PATH?: string
}

export class ConfigurationLoader {
	private static instance: ConfigurationLoader
	private config: ServerConfig | null = null
	private environment: Environment

	constructor(environment?: Environment) {
		this.environment = environment || this.detectEnvironment()
	}

	static getInstance(environment?: Environment): ConfigurationLoader {
		if (!ConfigurationLoader.instance) {
			ConfigurationLoader.instance = new ConfigurationLoader(environment)
		}
		return ConfigurationLoader.instance
	}

	/**
	 * Load configuration from multiple sources with priority:
	 * 1. Environment variables (highest priority)
	 * 2. Environment-specific config file
	 * 3. Base config file
	 * 4. Default values (lowest priority)
	 */
	async loadConfiguration(): Promise<ServerConfig> {
		if (this.config) {
			return this.config
		}

		try {
			// Load base configuration
			const baseConfig = this.loadBaseConfiguration()

			// Load environment-specific overrides
			const envOverrides = this.loadEnvironmentOverrides()

			// Load environment variables
			const envVarOverrides = this.loadEnvironmentVariables()

			// Merge configurations with proper precedence
			const mergedConfig = this.mergeConfigurations(baseConfig, envOverrides, envVarOverrides)

			// Validate final configuration
			this.config = validateConfig(mergedConfig)

			return this.config
		} catch (error) {
			if (error instanceof ConfigValidationError) {
				console.error('Configuration validation failed:')
				console.error(JSON.stringify(error.errors.format(), null, 2))
			}
			throw error
		}
	}

	/**
	 * Get current configuration (must call loadConfiguration first)
	 */
	getConfiguration(): ServerConfig {
		if (!this.config) {
			throw new Error('Configuration not loaded. Call loadConfiguration() first.')
		}
		return this.config
	}

	/**
	 * Reload configuration (useful for hot reloading in development)
	 */
	async reloadConfiguration(): Promise<ServerConfig> {
		this.config = null
		return this.loadConfiguration()
	}

	/**
	 * Get current environment
	 */
	getEnvironment(): Environment {
		return this.environment
	}

	/**
	 * Detect environment from NODE_ENV or default to development
	 */
	private detectEnvironment(): Environment {
		const nodeEnv = process.env.NODE_ENV as Environment
		return ['development', 'staging', 'production', 'test'].includes(nodeEnv)
			? nodeEnv
			: 'development'
	}

	/**
	 * Load base configuration from file or return defaults
	 */
	private loadBaseConfiguration(): Partial<ServerConfig> {
		const configPaths = [
			join(process.cwd(), 'config', 'server.json'),
			join(process.cwd(), 'config', 'base.json'),
			join(process.cwd(), 'server.config.json'),
		]

		for (const configPath of configPaths) {
			if (existsSync(configPath)) {
				try {
					const configContent = readFileSync(configPath, 'utf-8')
					const parsedConfig = JSON.parse(configContent)

					// If it's a complete config with environments, extract base
					if (parsedConfig.base) {
						const completeConfig = validateCompleteConfig(parsedConfig)
						return completeConfig.base
					}

					// Otherwise treat as base config
					return parsedConfig
				} catch (error) {
					console.warn(`Failed to load config from ${configPath}:`, error)
				}
			}
		}

		// Return minimal default configuration
		return this.getDefaultConfiguration()
	}

	/**
	 * Load environment-specific configuration overrides
	 */
	private loadEnvironmentOverrides(): Partial<ServerConfig> {
		const envConfigPaths = [
			join(process.cwd(), 'config', `${this.environment}.json`),
			join(process.cwd(), 'config', 'environments', `${this.environment}.json`),
		]

		for (const configPath of envConfigPaths) {
			if (existsSync(configPath)) {
				try {
					const configContent = readFileSync(configPath, 'utf-8')
					return JSON.parse(configContent)
				} catch (error) {
					console.warn(`Failed to load environment config from ${configPath}:`, error)
				}
			}
		}

		return {}
	}

	/**
	 * Load configuration from environment variables
	 */
	private loadEnvironmentVariables(): Partial<ServerConfig> {
		try {
			const envVars = this.parseEnvironmentVariables()
			return this.mapEnvironmentVariables(envVars)
		} catch (error) {
			console.warn('Failed to parse environment variables:', error)
			return {}
		}
	}

	/**
	 * Parse environment variables with type conversion
	 */
	private parseEnvironmentVariables(): EnvVarMapping {
		const env = process.env
		const parsed: EnvVarMapping = {}

		// Helper functions for type conversion
		const parseNumber = (value: string | undefined): number | undefined => {
			if (!value) return undefined
			const num = Number(value)
			return isNaN(num) ? undefined : num
		}

		const parseBoolean = (value: string | undefined): boolean | undefined => {
			if (!value) return undefined
			return value.toLowerCase() === 'true'
		}

		// Parse all environment variables
		parsed.PORT = parseNumber(env.PORT)
		parsed.HOST = env.HOST
		parsed.NODE_ENV = env.NODE_ENV as Environment

		parsed.CORS_ORIGIN = env.CORS_ORIGIN
		parsed.CORS_CREDENTIALS = parseBoolean(env.CORS_CREDENTIALS)

		parsed.RATE_LIMIT_WINDOW_MS = parseNumber(env.RATE_LIMIT_WINDOW_MS)
		parsed.RATE_LIMIT_MAX_REQUESTS = parseNumber(env.RATE_LIMIT_MAX_REQUESTS)

		parsed.DATABASE_URL = env.DATABASE_URL
		parsed.DB_POOL_SIZE = parseNumber(env.DB_POOL_SIZE)
		parsed.DB_CONNECTION_TIMEOUT = parseNumber(env.DB_CONNECTION_TIMEOUT)
		parsed.DB_IDLE_TIMEOUT = parseNumber(env.DB_IDLE_TIMEOUT)
		parsed.DB_SSL = parseBoolean(env.DB_SSL)

		parsed.REDIS_URL = env.REDIS_URL
		parsed.REDIS_MAX_RETRIES = parseNumber(env.REDIS_MAX_RETRIES)
		parsed.REDIS_RETRY_DELAY = parseNumber(env.REDIS_RETRY_DELAY)

		parsed.BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET
		parsed.BETTER_AUTH_URL = env.BETTER_AUTH_URL
		parsed.BETTER_AUTH_REDIS_URL = env.BETTER_AUTH_REDIS_URL
		parsed.BETTER_AUTH_DB_URL = env.BETTER_AUTH_DB_URL
		parsed.BETTER_AUTH_DB_POOL_SIZE = parseNumber(env.BETTER_AUTH_DB_POOL_SIZE)
		parsed.SESSION_MAX_AGE = parseNumber(env.SESSION_MAX_AGE)

		parsed.ENCRYPTION_KEY = env.ENCRYPTION_KEY
		parsed.API_KEY_HEADER = env.API_KEY_HEADER
		parsed.ENABLE_API_KEY_AUTH = parseBoolean(env.ENABLE_API_KEY_AUTH)

		parsed.LOG_LEVEL = env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error'
		parsed.ENABLE_METRICS = parseBoolean(env.ENABLE_METRICS)
		parsed.METRICS_PATH = env.METRICS_PATH
		parsed.HEALTH_CHECK_PATH = env.HEALTH_CHECK_PATH

		parsed.ENABLE_COMPRESSION = parseBoolean(env.ENABLE_COMPRESSION)
		parsed.COMPRESSION_LEVEL = parseNumber(env.COMPRESSION_LEVEL)
		parsed.ENABLE_CACHING = parseBoolean(env.ENABLE_CACHING)
		parsed.CACHE_MAX_AGE = parseNumber(env.CACHE_MAX_AGE)

		parsed.ENABLE_TRPC = parseBoolean(env.ENABLE_TRPC)
		parsed.ENABLE_REST = parseBoolean(env.ENABLE_REST)
		parsed.ENABLE_GRAPHQL = parseBoolean(env.ENABLE_GRAPHQL)
		parsed.ENABLE_OPENAPI = parseBoolean(env.ENABLE_OPENAPI)

		parsed.SMTP_HOST = env.SMTP_HOST
		parsed.SMTP_PORT = parseNumber(env.SMTP_PORT)
		parsed.SMTP_SECURE = parseBoolean(env.SMTP_SECURE)
		parsed.SMTP_USER = env.SMTP_USER
		parsed.SMTP_PASS = env.SMTP_PASS
		parsed.SMTP_FROM = env.SMTP_FROM
		parsed.WEBHOOK_URL = env.WEBHOOK_URL
		parsed.WEBHOOK_TOKEN = env.WEBHOOK_TOKEN
		parsed.STORAGE_PATH = env.STORAGE_PATH

		return parsed
	}

	/**
	 * Map environment variables to configuration structure
	 */
	private mapEnvironmentVariables(envVars: EnvVarMapping): Partial<ServerConfig> {
		const config: Partial<ServerConfig> = {}

		// Server configuration
		if (
			envVars.PORT !== undefined ||
			envVars.HOST !== undefined ||
			envVars.NODE_ENV !== undefined
		) {
			config.server = {
				...(envVars.PORT !== undefined && { port: envVars.PORT }),
				...(envVars.HOST !== undefined && { host: envVars.HOST }),
				...(envVars.NODE_ENV !== undefined && { environment: envVars.NODE_ENV }),
			}
		}

		// CORS configuration
		if (envVars.CORS_ORIGIN !== undefined || envVars.CORS_CREDENTIALS !== undefined) {
			config.cors = {
				...(envVars.CORS_ORIGIN !== undefined && {
					origin: envVars.CORS_ORIGIN.includes(',')
						? envVars.CORS_ORIGIN.split(',').map((o) => o.trim())
						: envVars.CORS_ORIGIN,
				}),
				...(envVars.CORS_CREDENTIALS !== undefined && { credentials: envVars.CORS_CREDENTIALS }),
			}
		}

		// Rate limiting configuration
		if (
			envVars.RATE_LIMIT_WINDOW_MS !== undefined ||
			envVars.RATE_LIMIT_MAX_REQUESTS !== undefined
		) {
			config.rateLimit = {
				...(envVars.RATE_LIMIT_WINDOW_MS !== undefined && {
					windowMs: envVars.RATE_LIMIT_WINDOW_MS,
				}),
				...(envVars.RATE_LIMIT_MAX_REQUESTS !== undefined && {
					maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
				}),
			}
		}

		// Database configuration
		if (
			envVars.DATABASE_URL !== undefined ||
			envVars.DB_POOL_SIZE !== undefined ||
			envVars.DB_CONNECTION_TIMEOUT !== undefined ||
			envVars.DB_IDLE_TIMEOUT !== undefined ||
			envVars.DB_SSL !== undefined
		) {
			config.database = {
				...(envVars.DATABASE_URL !== undefined && { url: envVars.DATABASE_URL }),
				...(envVars.DB_POOL_SIZE !== undefined && { poolSize: envVars.DB_POOL_SIZE }),
				...(envVars.DB_CONNECTION_TIMEOUT !== undefined && {
					connectionTimeout: envVars.DB_CONNECTION_TIMEOUT,
				}),
				...(envVars.DB_IDLE_TIMEOUT !== undefined && { idleTimeout: envVars.DB_IDLE_TIMEOUT }),
				...(envVars.DB_SSL !== undefined && { ssl: envVars.DB_SSL }),
			}
		}

		// Redis configuration
		if (
			envVars.REDIS_URL !== undefined ||
			envVars.REDIS_MAX_RETRIES !== undefined ||
			envVars.REDIS_RETRY_DELAY !== undefined
		) {
			config.redis = {
				...(envVars.REDIS_URL !== undefined && { url: envVars.REDIS_URL }),
				...(envVars.REDIS_MAX_RETRIES !== undefined && {
					maxRetriesPerRequest: envVars.REDIS_MAX_RETRIES,
				}),
				...(envVars.REDIS_RETRY_DELAY !== undefined && {
					retryDelayOnFailover: envVars.REDIS_RETRY_DELAY,
				}),
			}
		}

		// Authentication configuration
		if (
			envVars.BETTER_AUTH_SECRET !== undefined ||
			envVars.BETTER_AUTH_URL !== undefined ||
			envVars.BETTER_AUTH_DB_URL !== undefined ||
			envVars.BETTER_AUTH_DB_POOL_SIZE !== undefined ||
			envVars.BETTER_AUTH_REDIS_URL !== undefined ||
			envVars.SESSION_MAX_AGE !== undefined
		) {
			config.auth = {
				...(envVars.BETTER_AUTH_SECRET !== undefined && {
					sessionSecret: envVars.BETTER_AUTH_SECRET,
				}),
				...(envVars.BETTER_AUTH_URL !== undefined && { betterAuthUrl: envVars.BETTER_AUTH_URL }),
				...(envVars.BETTER_AUTH_DB_URL !== undefined && {
					dbUrl: envVars.BETTER_AUTH_DB_URL,
				}),
				...(envVars.BETTER_AUTH_DB_POOL_SIZE !== undefined && {
					dbPoolSize: envVars.BETTER_AUTH_DB_POOL_SIZE,
				}),
				...(envVars.BETTER_AUTH_REDIS_URL !== undefined && {
					redisUrl: envVars.BETTER_AUTH_REDIS_URL,
				}),
				...(envVars.SESSION_MAX_AGE !== undefined && { sessionMaxAge: envVars.SESSION_MAX_AGE }),
			}
		}

		// Security configuration
		if (
			envVars.ENCRYPTION_KEY !== undefined ||
			envVars.API_KEY_HEADER !== undefined ||
			envVars.ENABLE_API_KEY_AUTH !== undefined
		) {
			config.security = {
				...(envVars.ENCRYPTION_KEY !== undefined && { encryptionKey: envVars.ENCRYPTION_KEY }),
				...(envVars.API_KEY_HEADER !== undefined && { apiKeyHeader: envVars.API_KEY_HEADER }),
				...(envVars.ENABLE_API_KEY_AUTH !== undefined && {
					enableApiKeyAuth: envVars.ENABLE_API_KEY_AUTH,
				}),
			}
		}

		// Monitoring configuration
		if (
			envVars.LOG_LEVEL !== undefined ||
			envVars.ENABLE_METRICS !== undefined ||
			envVars.METRICS_PATH !== undefined ||
			envVars.HEALTH_CHECK_PATH !== undefined
		) {
			config.monitoring = {
				...(envVars.LOG_LEVEL !== undefined && { logLevel: envVars.LOG_LEVEL }),
				...(envVars.ENABLE_METRICS !== undefined && { enableMetrics: envVars.ENABLE_METRICS }),
				...(envVars.METRICS_PATH !== undefined && { metricsPath: envVars.METRICS_PATH }),
				...(envVars.HEALTH_CHECK_PATH !== undefined && {
					healthCheckPath: envVars.HEALTH_CHECK_PATH,
				}),
			}
		}

		// Performance configuration
		if (
			envVars.ENABLE_COMPRESSION !== undefined ||
			envVars.COMPRESSION_LEVEL !== undefined ||
			envVars.ENABLE_CACHING !== undefined ||
			envVars.CACHE_MAX_AGE !== undefined
		) {
			config.performance = {
				...(envVars.ENABLE_COMPRESSION !== undefined && {
					enableCompression: envVars.ENABLE_COMPRESSION,
				}),
				...(envVars.COMPRESSION_LEVEL !== undefined && {
					compressionLevel: envVars.COMPRESSION_LEVEL,
				}),
				...(envVars.ENABLE_CACHING !== undefined && { enableCaching: envVars.ENABLE_CACHING }),
				...(envVars.CACHE_MAX_AGE !== undefined && { cacheMaxAge: envVars.CACHE_MAX_AGE }),
			}
		}

		// API configuration
		if (
			envVars.ENABLE_TRPC !== undefined ||
			envVars.ENABLE_REST !== undefined ||
			envVars.ENABLE_GRAPHQL !== undefined ||
			envVars.ENABLE_OPENAPI !== undefined
		) {
			config.api = {
				...(envVars.ENABLE_TRPC !== undefined && { enableTrpc: envVars.ENABLE_TRPC }),
				...(envVars.ENABLE_REST !== undefined && { enableRest: envVars.ENABLE_REST }),
				...(envVars.ENABLE_GRAPHQL !== undefined && { enableGraphql: envVars.ENABLE_GRAPHQL }),
				...(envVars.ENABLE_OPENAPI !== undefined && { enableOpenApi: envVars.ENABLE_OPENAPI }),
			}
		}

		// External services configuration
		const externalServices: any = {}

		// SMTP configuration
		if (
			envVars.SMTP_HOST !== undefined ||
			envVars.SMTP_PORT !== undefined ||
			envVars.SMTP_SECURE !== undefined ||
			envVars.SMTP_USER !== undefined ||
			envVars.SMTP_PASS !== undefined ||
			envVars.SMTP_FROM !== undefined
		) {
			externalServices.smtp = {
				...(envVars.SMTP_HOST !== undefined && { host: envVars.SMTP_HOST }),
				...(envVars.SMTP_PORT !== undefined && { port: envVars.SMTP_PORT }),
				...(envVars.SMTP_SECURE !== undefined && { secure: envVars.SMTP_SECURE }),
				...(envVars.SMTP_USER !== undefined && { user: envVars.SMTP_USER }),
				...(envVars.SMTP_PASS !== undefined && { pass: envVars.SMTP_PASS }),
				...(envVars.SMTP_FROM !== undefined && { from: envVars.SMTP_FROM }),
			}
		}

		// Webhook configuration
		if (envVars.WEBHOOK_URL !== undefined || envVars.WEBHOOK_TOKEN !== undefined) {
			externalServices.webhook = {
				...(envVars.WEBHOOK_URL !== undefined && { url: envVars.WEBHOOK_URL }),
				...(envVars.WEBHOOK_TOKEN !== undefined && {
					headers: { Authorization: `Bearer ${envVars.WEBHOOK_TOKEN}` },
				}),
			}
		}

		// Storage configuration
		if (envVars.STORAGE_PATH !== undefined) {
			externalServices.storage = {
				config: { basePath: envVars.STORAGE_PATH },
			}
		}

		if (Object.keys(externalServices).length > 0) {
			config.externalServices = externalServices
		}

		return config
	}

	/**
	 * Merge multiple configuration objects with proper precedence
	 */
	private mergeConfigurations(...configs: Array<Partial<ServerConfig>>): Partial<ServerConfig> {
		return configs.reduce((merged, config) => {
			return this.deepMerge(merged, config)
		}, {})
	}

	/**
	 * Deep merge two objects
	 */
	private deepMerge(target: any, source: any): any {
		const result = { ...target }

		for (const key in source) {
			if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
				result[key] = this.deepMerge(result[key] || {}, source[key])
			} else {
				result[key] = source[key]
			}
		}

		return result
	}

	/**
	 * Get default configuration values
	 */
	private getDefaultConfiguration(): Partial<ServerConfig> {
		return getDefaultConfig()
	}
}

// Export singleton instance
export const configLoader = ConfigurationLoader.getInstance()
