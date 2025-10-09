/**
 * @fileoverview Legacy Logger Compatibility Layer
 *
 * Provides backward compatibility for existing logging API consumers.
 * Wraps the new StructuredLogger to maintain the old interface while
 * providing deprecation warnings and migration guidance.
 */

import { StructuredLogger } from '../core/structured-logger.js'

import type { LogFields } from '../types/logger.js'

// Legacy interface types for backward compatibility
export type Fields = {
	[field: string]: unknown
}

export interface LegacyLogger {
	debug(message: string, fields?: Fields): void
	info(message: string, fields?: Fields): void
	warn(message: string, fields?: Fields): void
	error(message: string, fields?: Fields): void
}

export interface LegacyLoggingConfig {
	/** Log level */
	level: 'debug' | 'info' | 'warn' | 'error'

	/** Enable structured logging */
	structured: boolean

	/** Log format */
	format: 'json' | 'text'

	/** Enable log correlation IDs */
	enableCorrelationIds: boolean

	/** Log retention period in days */
	retentionDays: number

	/** Export type for log messages */
	exporterType: 'console' | 'jaeger' | 'zipkin' | 'otlp'

	/** Exporter endpoint */
	exporterEndpoint?: string

	/** Exporter headers */
	exporterHeaders?: Record<string, string>
}

// Legacy context types
export interface LegacyLogContext {
	requestId?: string
	userId?: string
	sessionId?: string
	organizationId?: string
	endpoint?: string
	method?: string
	userAgent?: string
	ip?: string
	correlationId?: string
	traceId?: string
	spanId?: string
	service?: string
}

export interface LegacyLoggerConfig {
	level: 'debug' | 'info' | 'warn' | 'error'
	enablePerformanceLogging: boolean
	enableErrorTracking: boolean
	enableMetrics: boolean
	format: 'json' | 'pretty'
	outputs: ('console' | 'file' | 'redis' | 'otpl')[]
	redisConfig?: {
		key: string
		maxEntries: number
		ttl: number
	}
	fileConfig?: {
		path: string
		maxSize: number
		maxFiles: number
	}
	otplConfig?: {
		endpoint: string
		headers?: Record<string, string>
	}
}

/**
 * Legacy Logger Wrapper
 *
 * Wraps the new StructuredLogger to provide backward compatibility
 * with the old logging interface while emitting deprecation warnings.
 */
export class LegacyLoggerWrapper implements LegacyLogger {
	private structuredLogger: StructuredLogger
	private deprecationWarnings: Set<string> = new Set()

	constructor(config?: Partial<LegacyLoggingConfig>) {
		// Convert legacy config to new config format
		const newConfig = this.convertLegacyConfig(config)

		this.structuredLogger = new StructuredLogger(newConfig)

		// Emit deprecation warning once
		this.emitDeprecationWarning(
			'LegacyLoggerWrapper',
			'The legacy logging interface is deprecated. Please migrate to the new StructuredLogger.'
		)
	}

	debug(message: string, fields?: Fields): void {
		this.emitDeprecationWarning(
			'debug',
			'The synchronous debug() method is deprecated. Use the async version from StructuredLogger.'
		)

		// Convert fields to new format and call async method
		this.structuredLogger.debug(message, this.convertFields(fields)).catch((error) => {
			console.error('Failed to log debug message:', error)
		})
	}

	info(message: string, fields?: Fields): void {
		this.emitDeprecationWarning(
			'info',
			'The synchronous info() method is deprecated. Use the async version from StructuredLogger.'
		)

		this.structuredLogger.info(message, this.convertFields(fields)).catch((error) => {
			console.error('Failed to log info message:', error)
		})
	}

	warn(message: string, fields?: Fields): void {
		this.emitDeprecationWarning(
			'warn',
			'The synchronous warn() method is deprecated. Use the async version from StructuredLogger.'
		)

		this.structuredLogger.warn(message, this.convertFields(fields)).catch((error) => {
			console.error('Failed to log warn message:', error)
		})
	}

	error(message: string, fields?: Fields): void {
		this.emitDeprecationWarning(
			'error',
			'The synchronous error() method is deprecated. Use the async version from StructuredLogger.'
		)

		this.structuredLogger.error(message, this.convertFields(fields)).catch((error) => {
			console.error('Failed to log error message:', error)
		})
	}

	/**
	 * Get the underlying StructuredLogger for migration
	 */
	getStructuredLogger(): StructuredLogger {
		this.emitDeprecationWarning(
			'getStructuredLogger',
			'Direct access to StructuredLogger is provided for migration. Please update your code to use StructuredLogger directly.'
		)
		return this.structuredLogger
	}

	/**
	 * Flush all pending logs (for graceful shutdown)
	 */
	async flush(): Promise<void> {
		return this.structuredLogger.flush()
	}

	/**
	 * Close the logger and cleanup resources
	 */
	async close(): Promise<void> {
		return this.structuredLogger.close()
	}

	private convertLegacyConfig(config?: Partial<LegacyLoggingConfig>) {
		if (!config) {
			return {
				service: 'legacy-service',
				environment: 'production' as const,
			}
		}

		// Map legacy config to new config format
		return {
			service: 'legacy-service',
			environment: 'production' as const,
			// Note: Full config conversion would require more mapping
			// This is a simplified version for demonstration
		}
	}

	private convertFields(fields?: Fields): LogFields {
		if (!fields) return {}

		// Convert legacy fields format to new format
		const converted: LogFields = {}
		for (const [key, value] of Object.entries(fields)) {
			// Ensure value is compatible with LogFields type
			if (
				typeof value === 'string' ||
				typeof value === 'number' ||
				typeof value === 'boolean' ||
				value === null ||
				value === undefined ||
				(typeof value === 'object' && value !== null)
			) {
				converted[key] = value as LogFields[string]
			} else {
				// Convert other types to string
				converted[key] = String(value)
			}
		}
		return converted
	}

	private emitDeprecationWarning(method: string, message: string): void {
		const key = `${method}:${message}`
		if (!this.deprecationWarnings.has(key)) {
			this.deprecationWarnings.add(key)
			console.warn(`[DEPRECATION WARNING] ${method}: ${message}`)
		}
	}
}

/**
 * Legacy StructuredLogger Wrapper
 *
 * Provides backward compatibility for the old StructuredLogger interface
 */
export class LegacyStructuredLoggerWrapper {
	private structuredLogger: StructuredLogger
	private deprecationWarnings: Set<string> = new Set()

	constructor(config: Partial<LegacyLoggerConfig> = {}, baseContext: LegacyLogContext = {}) {
		// Convert legacy config and context
		const newConfig = this.convertLegacyStructuredConfig(config)
		this.structuredLogger = new StructuredLogger(newConfig)

		this.emitDeprecationWarning(
			'LegacyStructuredLoggerWrapper',
			'The legacy StructuredLogger interface is deprecated. Please migrate to the new StructuredLogger.'
		)
	}

	/**
	 * Create a child logger with additional context
	 */
	child(context: LegacyLogContext): LegacyStructuredLoggerWrapper {
		this.emitDeprecationWarning(
			'child',
			'The child() method signature has changed. Please use the new StructuredLogger.withContext() method.'
		)

		// For backward compatibility, create a new wrapper
		return new LegacyStructuredLoggerWrapper({}, context)
	}

	/**
	 * Start performance timing
	 */
	startTiming(): void {
		this.emitDeprecationWarning(
			'startTiming',
			'Performance timing is now handled automatically. This method is deprecated.'
		)
		// No-op for backward compatibility
	}

	/**
	 * End performance timing and return duration
	 */
	endTiming(): number | undefined {
		this.emitDeprecationWarning(
			'endTiming',
			'Performance timing is now handled automatically. This method is deprecated.'
		)
		return undefined
	}

	/**
	 * Log debug message (legacy sync interface)
	 */
	debug(message: string, metadata?: Record<string, any>, context?: LegacyLogContext): void {
		this.emitDeprecationWarning(
			'debug',
			'The synchronous debug() method is deprecated. Use the async version from StructuredLogger.'
		)

		this.structuredLogger.debug(message, metadata || {}).catch((error) => {
			console.error('Failed to log debug message:', error)
		})
	}

	/**
	 * Log info message (legacy sync interface)
	 */
	info(message: string, metadata?: Record<string, any>, context?: LegacyLogContext): void {
		this.emitDeprecationWarning(
			'info',
			'The synchronous info() method is deprecated. Use the async version from StructuredLogger.'
		)

		this.structuredLogger.info(message, metadata || {}).catch((error) => {
			console.error('Failed to log info message:', error)
		})
	}

	/**
	 * Log warning message (legacy sync interface)
	 */
	warn(message: string, metadata?: Record<string, any>, context?: LegacyLogContext): void {
		this.emitDeprecationWarning(
			'warn',
			'The synchronous warn() method is deprecated. Use the async version from StructuredLogger.'
		)

		this.structuredLogger.warn(message, metadata || {}).catch((error) => {
			console.error('Failed to log warn message:', error)
		})
	}

	/**
	 * Log error message (legacy sync interface)
	 */
	error(
		message: string,
		error?: Error | string,
		metadata?: Record<string, any>,
		context?: LegacyLogContext
	): void {
		this.emitDeprecationWarning(
			'error',
			'The synchronous error() method is deprecated. Use the async version from StructuredLogger.'
		)

		const errorFields = error ? { error: this.extractErrorInfo(error) } : {}
		this.structuredLogger.error(message, { ...metadata, ...errorFields }).catch((err) => {
			console.error('Failed to log error message:', err)
		})
	}

	/**
	 * Log request start (legacy interface)
	 */
	logRequestStart(
		method: string,
		path: string,
		context: LegacyLogContext,
		metadata?: Record<string, any>
	): void {
		this.emitDeprecationWarning(
			'logRequestStart',
			'Request logging methods are deprecated. Use the new structured logging approach.'
		)

		this.structuredLogger
			.info('Request started', {
				...metadata,
				request: { method, path, timestamp: new Date().toISOString() },
			})
			.catch((error) => {
				console.error('Failed to log request start:', error)
			})
	}

	/**
	 * Log request completion (legacy interface)
	 */
	logRequestEnd(
		method: string,
		path: string,
		statusCode: number,
		context: LegacyLogContext,
		metadata?: Record<string, any>
	): void {
		this.emitDeprecationWarning(
			'logRequestEnd',
			'Request logging methods are deprecated. Use the new structured logging approach.'
		)

		const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
		const logMethod = this.structuredLogger[level].bind(this.structuredLogger)

		logMethod('Request completed', {
			...metadata,
			request: { method, path, statusCode, timestamp: new Date().toISOString() },
		}).catch((error) => {
			console.error('Failed to log request end:', error)
		})
	}

	/**
	 * Log database operation (legacy interface)
	 */
	logDatabaseOperation(
		operation: string,
		table: string,
		duration: number,
		context: LegacyLogContext,
		metadata?: Record<string, any>
	): void {
		this.emitDeprecationWarning(
			'logDatabaseOperation',
			'Database logging methods are deprecated. Use the new structured logging approach.'
		)

		this.structuredLogger
			.info('Database operation', {
				...metadata,
				database: { operation, table, duration, timestamp: new Date().toISOString() },
			})
			.catch((error) => {
				console.error('Failed to log database operation:', error)
			})
	}

	/**
	 * Log authentication event (legacy interface)
	 */
	logAuthEvent(
		event: 'login' | 'logout' | 'token_refresh' | 'auth_failure',
		userId?: string,
		context?: LegacyLogContext,
		metadata?: Record<string, any>
	): void {
		this.emitDeprecationWarning(
			'logAuthEvent',
			'Auth logging methods are deprecated. Use the new structured logging approach.'
		)

		const level = event === 'auth_failure' ? 'warn' : 'info'
		const logMethod = this.structuredLogger[level].bind(this.structuredLogger)

		logMethod(`Authentication event: ${event}`, {
			...metadata,
			auth: { event, userId, timestamp: new Date().toISOString() },
		}).catch((error) => {
			console.error('Failed to log auth event:', error)
		})
	}

	/**
	 * Log security event (legacy interface)
	 */
	logSecurityEvent(
		event: string,
		severity: 'low' | 'medium' | 'high' | 'critical',
		context: LegacyLogContext,
		metadata?: Record<string, any>
	): void {
		this.emitDeprecationWarning(
			'logSecurityEvent',
			'Security logging methods are deprecated. Use the new structured logging approach.'
		)

		const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn'
		const logMethod = this.structuredLogger[level].bind(this.structuredLogger)

		logMethod(`Security event: ${event}`, {
			...metadata,
			security: { event, severity, timestamp: new Date().toISOString() },
		}).catch((error) => {
			console.error('Failed to log security event:', error)
		})
	}

	/**
	 * Log performance metrics (legacy interface)
	 */
	logPerformanceMetrics(
		operation: string,
		metrics: Record<string, number>,
		context: LegacyLogContext,
		metadata?: Record<string, any>
	): void {
		this.emitDeprecationWarning(
			'logPerformanceMetrics',
			'Performance logging methods are deprecated. Use the new structured logging approach.'
		)

		this.structuredLogger
			.info('Performance metrics', {
				...metadata,
				performance: { operation, metrics, timestamp: new Date().toISOString() },
			})
			.catch((error) => {
				console.error('Failed to log performance metrics:', error)
			})
	}

	/**
	 * Get the underlying StructuredLogger for migration
	 */
	getStructuredLogger(): StructuredLogger {
		this.emitDeprecationWarning(
			'getStructuredLogger',
			'Direct access to StructuredLogger is provided for migration. Please update your code to use StructuredLogger directly.'
		)
		return this.structuredLogger
	}

	/**
	 * Flush all pending logs
	 */
	async flush(): Promise<void> {
		return this.structuredLogger.flush()
	}

	/**
	 * Close the logger
	 */
	async close(): Promise<void> {
		return this.structuredLogger.close()
	}

	private convertLegacyStructuredConfig(config: Partial<LegacyLoggerConfig>) {
		// Convert legacy structured config to new format
		return {
			service: 'legacy-structured-service',
			environment: 'production' as const,
			// Note: Full config conversion would require more detailed mapping
		}
	}

	private extractErrorInfo(error: Error | string): any {
		if (typeof error === 'string') {
			return { message: error }
		}

		if (error instanceof Error) {
			return {
				name: error.name,
				message: error.message,
				stack: error.stack,
				code: (error as any).code,
			}
		}

		return error
	}

	private emitDeprecationWarning(method: string, message: string): void {
		const key = `${method}:${message}`
		if (!this.deprecationWarnings.has(key)) {
			this.deprecationWarnings.add(key)
			console.warn(`[DEPRECATION WARNING] ${method}: ${message}`)
		}
	}
}

/**
 * Legacy LoggerFactory Wrapper
 */
export class LegacyLoggerFactory {
	private static deprecationWarnings: Set<string> = new Set()

	private static emitDeprecationWarning(method: string, message: string): void {
		const key = `${method}:${message}`
		if (!this.deprecationWarnings.has(key)) {
			this.deprecationWarnings.add(key)
			console.warn(`[DEPRECATION WARNING] LoggerFactory.${method}: ${message}`)
		}
	}

	/**
	 * Set default configuration (legacy)
	 */
	static setDefaultConfig(config: Partial<LegacyLoggerConfig>): void {
		this.emitDeprecationWarning(
			'setDefaultConfig',
			'LoggerFactory is deprecated. Use StructuredLogger directly with configuration.'
		)
	}

	/**
	 * Create a new logger instance (legacy)
	 */
	static createLogger(
		context: LegacyLogContext = {},
		config?: Partial<LegacyLoggerConfig>
	): LegacyStructuredLoggerWrapper {
		this.emitDeprecationWarning(
			'createLogger',
			'LoggerFactory.createLogger is deprecated. Use new StructuredLogger() directly.'
		)

		return new LegacyStructuredLoggerWrapper(config, context)
	}

	/**
	 * Create a request logger with request context (legacy)
	 */
	static createRequestLogger(
		requestId: string,
		method: string,
		path: string,
		additionalContext: LegacyLogContext = {}
	): LegacyStructuredLoggerWrapper {
		this.emitDeprecationWarning(
			'createRequestLogger',
			'LoggerFactory.createRequestLogger is deprecated. Use StructuredLogger with setRequestId().'
		)

		return this.createLogger({
			requestId,
			method,
			endpoint: path,
			...additionalContext,
		})
	}

	/**
	 * Create a service logger with service context (legacy)
	 */
	static createServiceLogger(
		service: string,
		additionalContext: LegacyLogContext = {}
	): LegacyStructuredLoggerWrapper {
		this.emitDeprecationWarning(
			'createServiceLogger',
			'LoggerFactory.createServiceLogger is deprecated. Use StructuredLogger with service configuration.'
		)

		return this.createLogger({
			service,
			...additionalContext,
		})
	}
}

/**
 * Legacy middleware helper (deprecated)
 */
export function createRequestLogger(
	requestId: string,
	method: string,
	path: string,
	context: LegacyLogContext = {}
): LegacyStructuredLoggerWrapper {
	console.warn(
		'[DEPRECATION WARNING] createRequestLogger function is deprecated. Use StructuredLogger with setRequestId().'
	)
	return LegacyLoggerFactory.createRequestLogger(requestId, method, path, context)
}
