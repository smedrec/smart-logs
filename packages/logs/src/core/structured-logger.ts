import { randomUUID } from 'node:crypto'

import { ConsoleTransport } from '../transports/console-transport.js'
import { FileTransport } from '../transports/file-transport.js'
import { OTLPTransport } from '../transports/otlp-transport.js'
import { RedisTransport } from '../transports/redis-transport.js'
import { LogLevel, LogLevelUtils } from '../types/logger.js'
import { DefaultLogProcessor } from './log-processor.js'
import { getGlobalPerformanceMonitor } from './perf-monitor-registry.js'
import { registerForShutdown } from './shutdown-manager.js'
import { getGlobalTransports } from './transport-registry.js'

import type {
	ConsoleConfig,
	FileConfig,
	LoggingConfig,
	OTLPConfig,
	RedisConfig,
} from '../types/config.js'
import type {
	InternalLogger,
	LogContext,
	LogEntry,
	LogFields,
	Logger,
	LogLevelType,
	LogMetadata,
	PerformanceMetrics,
} from '../types/index.js'
import type { LogProcessor } from './log-processor.js'

/**
 * StructuredLogger core class implementation with multi-transport support
 * Addresses requirements 1.1, 6.1, 6.2, 6.3
 */
export class StructuredLogger implements InternalLogger {
	private context: LogContext = {}
	private readonly metadata: Partial<LogMetadata>
	private readonly minLevel: LogLevel | LogLevelType
	private readonly pendingOperations = new Set<Promise<void>>()
	private readonly processor: LogProcessor
	private isClosing = false

	constructor(
		private readonly config: {
			// Optional injected transports for tests or advanced wiring. When
			// provided the logger will use these instances instead of creating
			// new transports from config objects. This keeps behaviour
			// backwards-compatible while allowing tests to share transport
			// instances with the logger.
			transports?: Array<any>
			// Optional externally provided performance monitor instance used
			// for instrumentation. If not provided the logger/batching code
			// will create its own internal monitor as before.
			performanceMonitor?: any

			minLevel?: LogLevel | LogLevelType
			service: string
			environment: string
			version?: string
			// Transport configurations
			console?: Partial<ConsoleConfig>
			file?: Partial<FileConfig>
			otlp?: Partial<OTLPConfig>
			redis?: Partial<RedisConfig>
		},
		metadata?: Partial<LogMetadata>
	) {
		this.minLevel = config.minLevel || LogLevel.INFO
		this.metadata = {
			service: config.service,
			environment: config.environment,
			hostname: process.env.HOSTNAME || 'unknown',
			pid: process.pid,
			...metadata,
		}

		// Generate initial correlation ID
		this.context.correlationId = randomUUID()

		// Initialize LogProcessor with configured transports. Pass the
		// entire config object so createLogProcessor can use injected
		// transport instances or build transports from the provided
		// transport configs when needed.
		this.processor = this.createLogProcessor(this.config)

		// Note: some transports may require async initialization. Callers can
		// optionally call `await logger.init()` to ensure transports are ready.

		// Register for graceful shutdown
		registerForShutdown({
			name: `StructuredLogger-${this.metadata.service}`,
			cleanup: () => this.close(),
			priority: 50, // Medium priority
		})
	}

	/**
	 * Create and configure the LogProcessor with transports
	 */
	private createLogProcessor(config: any): LogProcessor {
		const processor = new DefaultLogProcessor({
			enableFallbackLogging: true,
			maxConcurrentTransports: 10,
		})

		// If transports were injected directly (tests or advanced wiring), register them
		// instead of creating new transport instances.
		if (Array.isArray(config.transports) && config.transports.length > 0) {
			for (const t of config.transports) {
				try {
					processor.addTransport(t)
				} catch (err) {
					console.error('Failed to add injected transport to StructuredLogger:', err)
				}
			}
			return processor
		}

		// If no injected transports, pick up any global transports (tests may
		// create a FileTransport directly). This preserves the test pattern
		// where tests construct a FileTransport and expect StructuredLogger to
		// write to the same file.
		const global = getGlobalTransports()
		if (global && global.length > 0) {
			for (const t of global) {
				try {
					processor.addTransport(t)
				} catch (err) {
					console.error('Failed to add global transport to StructuredLogger:', err)
				}
			}
			// If global transports are present (test or advanced wiring), avoid
			// adding default console transport to prevent duplicate sinks and
			// excessive output during tests.
			// Continue: still allow config-based explicit transports to be added
		}

		// Add Console transport (enabled by default unless explicitly disabled)
		// Skip adding the console transport in test mode if global transports
		// were registered to avoid duplicated outputs that can inflate memory
		// usage in tests.
		if (
			config.console?.enabled !== false &&
			process.env.NODE_ENV !== 'test' &&
			(!global || global.length === 0)
		) {
			const consoleConfig = {
				name: 'console',
				enabled: true,
				format: 'pretty' as const,
				colorize: true,
				...config.console,
			}
			processor.addTransport(new ConsoleTransport(consoleConfig))
		}

		// Add File transport if enabled
		if (config.file?.enabled) {
			const fileConfig = {
				name: 'file',
				enabled: true,
				filename: 'application.log',
				maxSize: 10 * 1024 * 1024, // 10MB
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: (config.file && (config.file as any).rotationInterval) || 'daily',
				compress: true,
				retentionDays: 30,
				...config.file,
			}
			processor.addTransport(new FileTransport(fileConfig))
		}

		// Add OTLP transport if enabled and endpoint provided
		if (config.otlp?.enabled && config.otlp?.endpoint) {
			const otlpConfig = {
				name: 'otlp',
				enabled: true,
				timeoutMs: 30000,
				batchSize: 100,
				batchTimeoutMs: 5000,
				maxConcurrency: 10,
				circuitBreakerThreshold: (config.otlp && (config.otlp as any).circuitBreakerThreshold) || 5,
				circuitBreakerResetMs: (config.otlp && (config.otlp as any).circuitBreakerResetMs) || 60000,
				...config.otlp,
			}
			processor.addTransport(new OTLPTransport(otlpConfig))
		}

		// Add Redis transport if enabled
		if (config.redis?.enabled) {
			const redisConfig = {
				name: 'redis',
				enabled: true,
				host: 'localhost',
				port: 6379,
				database: 0,
				keyPrefix: 'logs:',
				listName: `${config.service}-logs`,
				maxRetries: (config.redis && (config.redis as any).maxRetries) || 3,
				connectTimeoutMs: (config.redis && (config.redis as any).connectTimeoutMs) || 10000,
				commandTimeoutMs: (config.redis && (config.redis as any).commandTimeoutMs) || 10000,
				enableAutoPipelining: (config.redis && (config.redis as any).enableAutoPipelining) || false,
				enableOfflineQueue: (config.redis && (config.redis as any).enableOfflineQueue) !== false,
				dataStructure: (config.redis && (config.redis as any).dataStructure) || 'list',
				enableCluster: (config.redis && (config.redis as any).enableCluster) || false,
				enableTLS: (config.redis && (config.redis as any).enableTLS) || false,
				...config.redis,
			}
			processor.addTransport(new RedisTransport(redisConfig))
		}

		return processor
	}

	/**
	 * Async init that ensures transports' async initializers run and completes.
	 * Call this after construction if you need guaranteed readiness.
	 */
	async init(): Promise<void> {
		// If transports expose init(), processor.addTransport already called transport.init()
		// when adding; however some transports may start async work in constructor.
		// We provide a best-effort readiness check: wait briefly for healthy transports.
		const deadline = Date.now() + 5000 // 5s max wait
		while (Date.now() < deadline) {
			if (this.processor.isHealthy()) return
			await new Promise((r) => setTimeout(r, 100))
		}
	}

	/**
	 * Check if a log level should be processed
	 * Implements proper level validation and error handling
	 */
	shouldLog(level: LogLevel | LogLevelType): boolean {
		try {
			// First validate if the level is valid
			if (!LogLevelUtils.isValidLevel(level as string)) {
				console.error('Invalid log level validation:', `Invalid level: ${level}`)
				return true // Default to allowing the log to prevent application crashes
			}
			return LogLevelUtils.meetsMinimum(level, this.minLevel)
		} catch (error) {
			// If level validation fails, default to allowing the log
			// This prevents logging failures from breaking the application
			console.error('Invalid log level validation:', error)
			return true
		}
	}

	/**
	 * Get current logging context
	 */
	getContext(): LogContext {
		return { ...this.context }
	}

	/**
	 * Set request ID for correlation tracking
	 */
	setRequestId(requestId: string): void {
		this.context.requestId = requestId
	}

	/**
	 * Set correlation ID for distributed tracing
	 */
	setCorrelationId(correlationId: string): void {
		this.context.correlationId = correlationId
	}

	/**
	 * Create a new logger instance with additional context
	 */
	withContext(context: LogContext): Logger {
		const newLogger = new StructuredLogger(
			{
				minLevel: this.minLevel,
				service: this.metadata.service!,
				environment: this.metadata.environment!,
				version: this.config.version,
			},
			this.metadata
		)
		newLogger.context = { ...this.context, ...context }
		return newLogger
	}

	/**
	 * Core logging method that creates structured log entries
	 */
	private async logEntry(
		level: LogLevel | LogLevelType,
		message: string,
		fields?: LogFields
	): Promise<void> {
		if (!this.shouldLog(level) || this.isClosing) {
			return
		}

		const operation = this.processLogEntryWithTracking(level, message, fields)
		this.pendingOperations.add(operation)

		try {
			await operation
		} finally {
			this.pendingOperations.delete(operation)
		}
	}

	/**
	 * Process log entry with proper tracking for shutdown
	 */
	private async processLogEntryWithTracking(
		level: LogLevel | LogLevelType,
		message: string,
		fields?: LogFields
	): Promise<void> {
		try {
			const entry = this.createLogEntry(level, message, fields)

			// Use injected performance monitor or global monitor if present to
			// time the processing of this log entry. This supports tests that
			// create their own PerformanceMonitor instance.
			const monitor = (this.config as any).performanceMonitor || getGlobalPerformanceMonitor()
			if (monitor && typeof monitor.startTiming === 'function') {
				const end = monitor.startTiming()
				try {
					await this.processLogEntry(entry)
				} finally {
					if (end) end()
				}
			} else {
				await this.processLogEntry(entry)
			}
		} catch (error) {
			// Handle logging errors gracefully to prevent application crashes
			console.error('Failed to process log entry:', error)
		}
	}

	/**
	 * Create a structured log entry with all metadata
	 */
	private createLogEntry(
		level: LogLevel | LogLevelType,
		message: string,
		fields?: LogFields
	): LogEntry {
		const entry: LogEntry = {
			id: randomUUID(),
			timestamp: new Date(),
			level,
			message,
			correlationId: this.context.correlationId || randomUUID(),
			fields: this.validateAndNormalizeFields(fields || {}),
			metadata: this.collectMetadata(),
			source: this.metadata.service || 'unknown',
			version: this.config.version || '1.0.0',
		}

		// Add optional context fields
		if (this.context.requestId) entry.requestId = this.context.requestId
		if (this.context.traceId) entry.traceId = this.context.traceId
		if (this.context.spanId) entry.spanId = this.context.spanId

		return entry
	}

	/**
	 * Validate and normalize log fields to prevent serialization issues
	 */
	private validateAndNormalizeFields(fields: LogFields): LogFields {
		const normalized: LogFields = {}

		for (const [key, value] of Object.entries(fields)) {
			// Skip undefined values and functions
			if (value === undefined || typeof value === 'function') {
				continue
			}

			// Handle circular references and complex objects
			try {
				// Test serialization to catch circular references
				JSON.stringify(value)
				normalized[key] = value
			} catch (error) {
				// Replace problematic values with safe representations
				normalized[key] = '[Circular Reference or Non-Serializable]'
			}
		}

		return normalized
	}

	/**
	 * Collect structured metadata for the log entry
	 */
	private collectMetadata(): LogMetadata {
		const metadata: LogMetadata = {
			service: this.metadata.service!,
			environment: this.metadata.environment!,
			hostname: this.metadata.hostname!,
			pid: this.metadata.pid!,
		}

		// Add request metadata if available in context
		if (this.context.requestId) {
			metadata.request = {
				// Additional request metadata can be added here
			}
		}

		return metadata
	}

	/**
	 * Process the log entry using the configured transports
	 */
	private async processLogEntry(entry: LogEntry): Promise<void> {
		await this.processor.processLogEntry(entry)
	}

	// Public logging methods with proper async signatures

	async debug(message: string, fields?: LogFields): Promise<void> {
		await this.logEntry(LogLevel.DEBUG, message, fields)
	}

	async info(message: string, fields?: LogFields): Promise<void> {
		await this.logEntry(LogLevel.INFO, message, fields)
	}

	async warn(message: string, fields?: LogFields): Promise<void> {
		await this.logEntry(LogLevel.WARN, message, fields)
	}

	async error(message: string, fields?: LogFields): Promise<void> {
		await this.logEntry(LogLevel.ERROR, message, fields)
	}

	async fatal(message: string, fields?: LogFields): Promise<void> {
		await this.logEntry(LogLevel.FATAL, message, fields)
	}

	/**
	 * Flush all pending log operations
	 * Waits for all pending async operations to complete
	 */
	async flush(): Promise<void> {
		// Wait for all pending operations to complete
		if (this.pendingOperations.size > 0) {
			await Promise.all(Array.from(this.pendingOperations))
		}

		// Flush all transports through the processor
		await this.processor.flush()
	}

	/**
	 * Close the logger and cleanup resources
	 * Implements graceful shutdown with proper resource cleanup
	 */
	async close(): Promise<void> {
		if (this.isClosing) {
			return
		}

		this.isClosing = true

		try {
			// Flush all pending operations first
			await this.flush()

			// Close the processor and all transports
			await this.processor.close()
		} catch (error) {
			console.error('Error during logger close:', error)
			throw error
		}
	}

	/**
	 * Get transport health status for monitoring
	 */
	getTransportHealth(): Array<{ name: string; healthy: boolean; lastError?: Error }> {
		return this.processor.getHealthStatus()
	}

	/**
	 * Check if the logger has at least one healthy transport
	 */
	hasHealthyTransports(): boolean {
		return this.processor.isHealthy()
	}

	/**
	 * Get the number of pending operations
	 */
	getPendingOperationCount(): number {
		return this.pendingOperations.size
	}

	/**
	 * Check if the logger is healthy and not closing
	 */
	isHealthy(): boolean {
		return !this.isClosing && this.pendingOperations.size < 1000 // Reasonable threshold
	}
}
