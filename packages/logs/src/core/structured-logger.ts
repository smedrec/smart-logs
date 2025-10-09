import { randomUUID } from 'node:crypto'

import { LogLevel, LogLevelUtils } from '../types/logger.js'
import { registerForShutdown } from './shutdown-manager.js'

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

/**
 * StructuredLogger core class implementation
 * Addresses requirements 1.1, 6.1, 6.2, 6.3
 */
export class StructuredLogger implements InternalLogger {
	private context: LogContext = {}
	private readonly metadata: Partial<LogMetadata>
	private readonly minLevel: LogLevel | LogLevelType
	private readonly pendingOperations = new Set<Promise<void>>()
	private isClosing = false

	constructor(
		private readonly config: {
			minLevel?: LogLevel | LogLevelType
			service: string
			environment: string
			version?: string
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

		// Register for graceful shutdown
		registerForShutdown({
			name: `StructuredLogger-${this.metadata.service}`,
			cleanup: () => this.close(),
			priority: 50, // Medium priority
		})
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
			await this.processLogEntry(entry)
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
	 * Process the log entry (placeholder for transport integration)
	 */
	private async processLogEntry(entry: LogEntry): Promise<void> {
		// This will be integrated with the transport layer in later tasks
		// For now, we'll just ensure the entry is properly structured
		console.log(JSON.stringify(entry, null, 2))
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

		// This will be enhanced when transport layer is added
		await Promise.resolve()
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

			// Additional cleanup will be added when transport layer is implemented
		} catch (error) {
			console.error('Error during logger close:', error)
			throw error
		}
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
