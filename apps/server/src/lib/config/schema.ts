/**
 * Configuration schema and types with validation
 */

// Environment type
export type Environment = 'development' | 'staging' | 'production' | 'test'

// Configuration interfaces
export interface ServerConfig {
	server: {
		port: number
		host: string
		environment: Environment
	}
	cors: {
		origin: string | string[]
		credentials: boolean
		allowedMethods: string[]
		allowedHeaders: string[]
	}
	rateLimit: {
		windowMs: number
		maxRequests: number
		skipSuccessfulRequests: boolean
		keyGenerator: 'ip' | 'user' | 'session'
	}
	database: {
		url: string
		poolSize: number
		connectionTimeout: number
		idleTimeout: number
		maxLifetime: number
		ssl: boolean
	}
	redis: {
		url: string
		maxRetriesPerRequest: number
		retryDelayOnFailover: number
		connectTimeout: number
		lazyConnect: boolean
		keepAlive: number
	}
	auth: {
		sessionSecret: string
		sessionMaxAge: number
		trustedOrigins: string[]
		betterAuthUrl: string
		redisUrl?: string
	}
	monitoring: {
		enableMetrics: boolean
		metricsPath: string
		healthCheckPath: string
		logLevel: 'debug' | 'info' | 'warn' | 'error'
		enableTracing: boolean
		tracingEndpoint?: string
	}
	security: {
		encryptionKey: string
		apiKeyHeader: string
		enableApiKeyAuth: boolean
		trustedProxies: string[]
		maxRequestSize: string
	}
	performance: {
		enableCompression: boolean
		compressionLevel: number
		enableCaching: boolean
		cacheMaxAge: number
		enableEtag: boolean
	}
	api: {
		enableTrpc: boolean
		enableRest: boolean
		enableGraphql: boolean
		trpcPath: string
		restPath: string
		graphqlPath: string
		enableOpenApi: boolean
		openApiPath: string
	}
	externalServices: {
		smtp?: {
			host: string
			port: number
			secure: boolean
			user: string
			pass: string
			from: string
		}
		webhook?: {
			url: string
			method: 'GET' | 'POST' | 'PUT' | 'PATCH'
			headers: Record<string, string>
			timeout: number
			retryConfig: {
				maxRetries: number
				backoffMultiplier: number
				maxBackoffDelay: number
			}
		}
		storage?: {
			provider: 'local' | 's3' | 'gcs'
			config: Record<string, any>
			path: string
			retention: {
				days: number
				autoCleanup: boolean
			}
		}
	}
}

export type EnvironmentOverrides = {
	development?: Partial<ServerConfig>
	staging?: Partial<ServerConfig>
	production?: Partial<ServerConfig>
	test?: Partial<ServerConfig>
}

export type CompleteConfig = {
	base: ServerConfig
	environments?: EnvironmentOverrides
}

// Configuration validation errors
export class ConfigValidationError extends Error {
	constructor(
		message: string,
		public readonly errors: string[]
	) {
		super(message)
		this.name = 'ConfigValidationError'
	}
}

// Validation functions
export function validateConfig(config: unknown): ServerConfig {
	const errors: string[] = []

	if (!config || typeof config !== 'object') {
		throw new ConfigValidationError('Configuration must be an object', [
			'Invalid configuration type',
		])
	}

	const cfg = config as any

	// Validate server section
	if (!cfg.server) {
		errors.push('server configuration is required')
	} else {
		if (typeof cfg.server.port !== 'number' || cfg.server.port < 1 || cfg.server.port > 65535) {
			errors.push('server.port must be a number between 1 and 65535')
		}
		if (typeof cfg.server.host !== 'string') {
			errors.push('server.host must be a string')
		}
		if (!['development', 'staging', 'production', 'test'].includes(cfg.server.environment)) {
			errors.push('server.environment must be one of: development, staging, production, test')
		}
	}

	// Validate database section
	if (!cfg.database) {
		errors.push('database configuration is required')
	} else {
		if (typeof cfg.database.url !== 'string' || !cfg.database.url.startsWith('postgresql://')) {
			errors.push('database.url must be a valid PostgreSQL connection string')
		}
	}

	// Validate redis section
	if (!cfg.redis) {
		errors.push('redis configuration is required')
	} else {
		if (typeof cfg.redis.url !== 'string' || !cfg.redis.url.startsWith('redis://')) {
			errors.push('redis.url must be a valid Redis connection string')
		}
	}

	// Validate auth section
	if (!cfg.auth) {
		errors.push('auth configuration is required')
	} else {
		if (typeof cfg.auth.sessionSecret !== 'string' || cfg.auth.sessionSecret.length < 32) {
			errors.push('auth.sessionSecret must be at least 32 characters long')
		}
		if (typeof cfg.auth.betterAuthUrl !== 'string') {
			errors.push('auth.betterAuthUrl must be a string')
		}
	}

	// Validate security section
	if (!cfg.security) {
		errors.push('security configuration is required')
	} else {
		if (typeof cfg.security.encryptionKey !== 'string' || cfg.security.encryptionKey.length < 32) {
			errors.push('security.encryptionKey must be at least 32 characters long')
		}
	}

	if (errors.length > 0) {
		throw new ConfigValidationError('Configuration validation failed', errors)
	}

	return cfg as ServerConfig
}

export function validateCompleteConfig(config: unknown): CompleteConfig {
	const errors: string[] = []

	if (!config || typeof config !== 'object') {
		throw new ConfigValidationError('Configuration must be an object', [
			'Invalid configuration type',
		])
	}

	const cfg = config as any

	if (!cfg.base) {
		errors.push('base configuration is required')
	} else {
		try {
			validateConfig(cfg.base)
		} catch (error) {
			if (error instanceof ConfigValidationError) {
				errors.push(...error.errors.map((e) => `base.${e}`))
			}
		}
	}

	if (errors.length > 0) {
		throw new ConfigValidationError('Complete configuration validation failed', errors)
	}

	return cfg as CompleteConfig
}

// Default configuration values
export function getDefaultConfig(): Partial<ServerConfig> {
	return {
		server: {
			port: 3000,
			host: '0.0.0.0',
			environment: 'development',
		},
		cors: {
			origin: '*',
			credentials: true,
			allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
			allowedHeaders: [
				'Content-Type',
				'Authorization',
				'x-application',
				'x-requestid',
				'x-version',
			],
		},
		rateLimit: {
			windowMs: 60000,
			maxRequests: 100,
			skipSuccessfulRequests: false,
			keyGenerator: 'ip',
		},
		monitoring: {
			enableMetrics: true,
			metricsPath: '/metrics',
			healthCheckPath: '/health',
			logLevel: 'info',
			enableTracing: false,
		},
		performance: {
			enableCompression: true,
			compressionLevel: 6,
			enableCaching: true,
			cacheMaxAge: 300,
			enableEtag: true,
		},
		api: {
			enableTrpc: true,
			enableRest: true,
			enableGraphql: true,
			trpcPath: '/trpc',
			restPath: '/api',
			graphqlPath: '/graphql',
			enableOpenApi: true,
			openApiPath: '/api/docs',
		},
		security: {
			apiKeyHeader: 'x-api-key',
			enableApiKeyAuth: false,
			trustedProxies: [],
			maxRequestSize: '10mb',
		},
		externalServices: {},
	}
}
