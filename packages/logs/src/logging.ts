/**
 * @fileoverview Enhanced Structured Logging Service
 *
 * Provides comprehensive structured logging with:
 * - Correlation ID tracking
 * - Contextual information
 * - Performance metrics
 * - Error tracking
 * - Log aggregation support
 *
 * Requirements: 6.3, 6.4
 */

export interface LogContext {
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

export interface LogEntry {
	timestamp: string
	level: 'debug' | 'info' | 'warn' | 'error'
	message: string
	context: LogContext
	metadata?: Record<string, any>
	duration?: number
	error?: {
		name: string
		message: string
		stack?: string
		code?: string
	}
	performance?: {
		memoryUsage: NodeJS.MemoryUsage
		cpuUsage: NodeJS.CpuUsage
	}
}

export interface LoggerConfig {
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
 * Enhanced structured logger
 */
export class StructuredLogger {
	private readonly config: LoggerConfig
	private readonly baseContext: LogContext
	private performanceStart?: [number, number]

	constructor(config: Partial<LoggerConfig> = {}, baseContext: LogContext = {}) {
		this.config = {
			level: 'info',
			enablePerformanceLogging: true,
			enableErrorTracking: true,
			enableMetrics: true,
			format: 'json',
			outputs: ['console'],
			...config,
		}
		this.baseContext = baseContext
	}

	/**
	 * Create a child logger with additional context
	 */
	child(context: LogContext): StructuredLogger {
		return new StructuredLogger(this.config, {
			...this.baseContext,
			...context,
		})
	}

	/**
	 * Start performance timing
	 */
	startTiming(): void {
		if (this.config.enablePerformanceLogging) {
			this.performanceStart = process.hrtime()
		}
	}

	/**
	 * End performance timing and return duration
	 */
	endTiming(): number | undefined {
		if (this.performanceStart) {
			const [seconds, nanoseconds] = process.hrtime(this.performanceStart)
			const duration = seconds * 1000 + nanoseconds / 1000000 // Convert to milliseconds
			this.performanceStart = undefined
			return duration
		}
		return undefined
	}

	/**
	 * Log debug message
	 */
	debug(message: string, metadata?: Record<string, any>, context?: LogContext): void {
		this.log('debug', message, metadata, context)
	}

	/**
	 * Log info message
	 */
	info(message: string, metadata?: Record<string, any>, context?: LogContext): void {
		this.log('info', message, metadata, context)
	}

	/**
	 * Log warning message
	 */
	warn(message: string, metadata?: Record<string, any>, context?: LogContext): void {
		this.log('warn', message, metadata, context)
	}

	/**
	 * Log error message
	 */
	error(
		message: string,
		error?: Error | string,
		metadata?: Record<string, any>,
		context?: LogContext
	): void {
		const errorInfo = this.extractErrorInfo(error)
		this.log('error', message, { ...metadata, error: errorInfo }, context)
	}

	/**
	 * Log request start
	 */
	logRequestStart(
		method: string,
		path: string,
		context: LogContext,
		metadata?: Record<string, any>
	): void {
		this.startTiming()
		this.info(
			'Request started',
			{
				...metadata,
				request: {
					method,
					path,
					timestamp: new Date().toISOString(),
				},
			},
			context
		)
	}

	/**
	 * Log request completion
	 */
	logRequestEnd(
		method: string,
		path: string,
		statusCode: number,
		context: LogContext,
		metadata?: Record<string, any>
	): void {
		const duration = this.endTiming()
		const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'

		this.log(
			level,
			'Request completed',
			{
				...metadata,
				request: {
					method,
					path,
					statusCode,
					duration,
					timestamp: new Date().toISOString(),
				},
			},
			context
		)
	}

	/**
	 * Log database operation
	 */
	logDatabaseOperation(
		operation: string,
		table: string,
		duration: number,
		context: LogContext,
		metadata?: Record<string, any>
	): void {
		this.info(
			'Database operation',
			{
				...metadata,
				database: {
					operation,
					table,
					duration,
					timestamp: new Date().toISOString(),
				},
			},
			context
		)
	}

	/**
	 * Log authentication event
	 */
	logAuthEvent(
		event: 'login' | 'logout' | 'token_refresh' | 'auth_failure',
		userId?: string,
		context?: LogContext,
		metadata?: Record<string, any>
	): void {
		const level = event === 'auth_failure' ? 'warn' : 'info'
		this.log(
			level,
			`Authentication event: ${event}`,
			{
				...metadata,
				auth: {
					event,
					userId,
					timestamp: new Date().toISOString(),
				},
			},
			context
		)
	}

	/**
	 * Log security event
	 */
	logSecurityEvent(
		event: string,
		severity: 'low' | 'medium' | 'high' | 'critical',
		context: LogContext,
		metadata?: Record<string, any>
	): void {
		const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn'
		this.log(
			level,
			`Security event: ${event}`,
			{
				...metadata,
				security: {
					event,
					severity,
					timestamp: new Date().toISOString(),
				},
			},
			context
		)
	}

	/**
	 * Log performance metrics
	 */
	logPerformanceMetrics(
		operation: string,
		metrics: Record<string, number>,
		context: LogContext,
		metadata?: Record<string, any>
	): void {
		if (this.config.enablePerformanceLogging) {
			this.info(
				'Performance metrics',
				{
					...metadata,
					performance: {
						operation,
						metrics,
						timestamp: new Date().toISOString(),
					},
				},
				context
			)
		}
	}

	/**
	 * Core logging method
	 */
	private log(
		level: 'debug' | 'info' | 'warn' | 'error',
		message: string,
		metadata?: Record<string, any>,
		context?: LogContext
	): void {
		// Check if log level is enabled
		if (!this.shouldLog(level)) {
			return
		}

		// Build log entry
		const logEntry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			context: {
				...this.baseContext,
				...context,
				correlationId:
					context?.correlationId || this.baseContext.correlationId || this.generateCorrelationId(),
			},
			metadata,
		}

		// Add performance information if enabled
		if (this.config.enablePerformanceLogging) {
			logEntry.performance = {
				memoryUsage: process.memoryUsage(),
				cpuUsage: process.cpuUsage(),
			}
		}

		// Add duration if available
		if (metadata?.request?.duration) {
			logEntry.duration = metadata.request.duration
		}

		// Output log entry
		this.output(logEntry)
	}

	/**
	 * Check if log level should be logged
	 */
	private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
		const levels = ['debug', 'info', 'warn', 'error']
		const currentLevelIndex = levels.indexOf(this.config.level)
		const logLevelIndex = levels.indexOf(level)
		return logLevelIndex >= currentLevelIndex
	}

	/**
	 * Extract error information
	 */
	private extractErrorInfo(error?: Error | string): any {
		if (!error) return undefined

		if (typeof error === 'string') {
			return { message: error }
		}

		if (error instanceof Error) {
			return {
				name: error.name,
				message: error.message,
				stack: this.config.enableErrorTracking ? error.stack : undefined,
				code: (error as any).code,
			}
		}

		return error
	}

	/**
	 * Generate correlation ID
	 */
	private generateCorrelationId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Output log entry to configured outputs
	 */
	private output(logEntry: LogEntry): void {
		for (const output of this.config.outputs) {
			try {
				switch (output) {
					case 'console':
						this.outputToConsole(logEntry)
						break
					case 'file':
						this.outputToFile(logEntry)
						break
					case 'redis':
						this.outputToRedis(logEntry)
						break
					case 'otpl':
						this.outputToOtpl(logEntry)
						break
				}
			} catch (error) {
				// Fallback to console if other outputs fail
				console.error('Failed to output log entry:', error)
				console.log(JSON.stringify(logEntry))
			}
		}
	}

	/**
	 * Output to console
	 */
	private outputToConsole(logEntry: LogEntry): void {
		if (this.config.format === 'pretty') {
			const timestamp = new Date(logEntry.timestamp).toLocaleString()
			const level = logEntry.level.toUpperCase().padEnd(5)
			const context = logEntry.context.requestId ? `[${logEntry.context.requestId}]` : ''

			console.log(`${timestamp} ${level} ${context} ${logEntry.message}`)

			if (logEntry.metadata) {
				console.log('  Metadata:', JSON.stringify(logEntry.metadata, null, 2))
			}

			if (logEntry.context && Object.keys(logEntry.context).length > 0) {
				console.log('  Context:', JSON.stringify(logEntry.context, null, 2))
			}
		} else {
			console.log(JSON.stringify(logEntry))
		}
	}

	/**
	 * Output to file (placeholder - would need file system integration)
	 */
	private async outputToOtpl(logEntry: LogEntry): Promise<void> {
		if (!this.config.otplConfig) {
			throw new Error('OTLP exporter not configured')
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'User-Agent': `audit-system-tracer/1.0.0`,
			...this.config.otplConfig.headers,
		}

		let body = JSON.stringify(logEntry)

		// Add compression if large payload
		if (body.length > 1024) {
			const compressed = await this.compressPayload(body)
			if (compressed) {
				body = compressed.data
				headers['Content-Encoding'] = compressed.encoding
			}
		}

		const requestConfig: RequestInit = {
			method: 'POST',
			headers,
			body,
		}

		const maxRetries = 3
		let retryDelay = 1000

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const response = await fetch(this.config.otplConfig.endpoint, requestConfig)

				if (response.ok) {
					console.debug(`Successfully exported log to OTLP`)
					return
				}

				// Handle different error scenarios
				if (response.status === 429) {
					// Rate limited - implement backoff
					const retryAfter = response.headers.get('Retry-After')
					retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay * 2
				} else if (response.status >= 400 && response.status < 500) {
					// Client error - don't retry
					throw new Error(`Client error: ${response.status} ${response.statusText}`)
				}

				if (attempt === maxRetries) {
					throw new Error(
						`Failed after ${maxRetries} attempts: ${response.status} ${response.statusText}`
					)
				}

				// Wait before retry
				await new Promise((resolve) => setTimeout(resolve, retryDelay))
				retryDelay *= 2 // Exponential backoff
			} catch (error) {
				if (attempt === maxRetries) {
					throw error
				}

				// Wait before retry for network errors
				await new Promise((resolve) => setTimeout(resolve, retryDelay))
				retryDelay *= 2
			}
		}
	}

	/**
	 * Output to file (placeholder - would need file system integration)
	 */
	private outputToFile(logEntry: LogEntry): void {
		// This would write to a log file
		// For now, just output to console as JSON
		console.log(JSON.stringify(logEntry))
	}

	/**
	 * Output to Redis (placeholder - would need Redis integration)
	 */
	private outputToRedis(logEntry: LogEntry): void {
		// This would send to Redis for log aggregation
		// For now, just output to console as JSON
		console.log(JSON.stringify(logEntry))
	}

	/**
	 * Compress payload if beneficial
	 */
	private async compressPayload(data: string): Promise<{ data: string; encoding: string } | null> {
		// For now, return null (no compression)
		// In a full implementation, you could use zlib:
		// const compressed = await gzip(Buffer.from(data))
		// return { data: compressed.toString('base64'), encoding: 'gzip' }
		return null
	}
}

/**
 * Create a logger factory for consistent logger creation
 */
export class LoggerFactory {
	private static defaultConfig: LoggerConfig = {
		level: 'info',
		enablePerformanceLogging: true,
		enableErrorTracking: true,
		enableMetrics: true,
		format: 'json',
		outputs: ['console'],
	}

	/**
	 * Set default configuration
	 */
	static setDefaultConfig(config: Partial<LoggerConfig>): void {
		this.defaultConfig = { ...this.defaultConfig, ...config }
	}

	/**
	 * Create a new logger instance
	 */
	static createLogger(context: LogContext = {}, config?: Partial<LoggerConfig>): StructuredLogger {
		return new StructuredLogger({ ...this.defaultConfig, ...config }, context)
	}

	/**
	 * Create a request logger with request context
	 */
	static createRequestLogger(
		requestId: string,
		method: string,
		path: string,
		additionalContext: LogContext = {}
	): StructuredLogger {
		return this.createLogger({
			requestId,
			method,
			endpoint: path,
			...additionalContext,
		})
	}

	/**
	 * Create a service logger with service context
	 */
	static createServiceLogger(
		service: string,
		additionalContext: LogContext = {}
	): StructuredLogger {
		return this.createLogger({
			service,
			...additionalContext,
		})
	}
}

/**
 * Middleware helper for request logging
 */
export function createRequestLogger(
	requestId: string,
	method: string,
	path: string,
	context: LogContext = {}
): StructuredLogger {
	return LoggerFactory.createRequestLogger(requestId, method, path, context)
}
