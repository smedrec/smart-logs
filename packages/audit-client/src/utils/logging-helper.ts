import type { Logger, LogLevel } from '../infrastructure/logger'

/**
 * Logging configuration interface
 */
export interface LoggingConfig {
	enabled?: boolean
	level?: LogLevel
	includeTimestamp?: boolean
	includeContext?: boolean
}

/**
 * LoggingHelper - Centralized logging utility
 *
 * Provides common logging patterns and utilities to reduce code duplication
 * across services and ensure consistent logging behavior.
 *
 * Features:
 * - Automatic log level determination based on context
 * - Correlation ID and request ID management
 * - Factory pattern for creating bound loggers
 * - Respects logging configuration (enabled/disabled)
 *
 * Requirements:
 * - 10.1: Provide static logRequest method for common logging
 * - 10.2: Automatically set correlation IDs and request IDs
 * - 10.3: Determine appropriate log levels based on error status
 * - 10.4: Provide factory method for creating request loggers
 * - 10.5: Skip logging when disabled in configuration
 * - 10.7: Support all log levels (debug, info, warn, error)
 */
export class LoggingHelper {
	/**
	 * Log a request with automatic level determination and correlation ID handling
	 *
	 * @param logger - Logger instance to use
	 * @param config - Logging configuration
	 * @param message - Log message
	 * @param meta - Metadata to include in the log
	 *
	 * Requirements: 10.1, 10.2, 10.3, 10.5, 10.7
	 */
	static logRequest(
		logger: Logger | undefined,
		config: LoggingConfig,
		message: string,
		meta: Record<string, any> = {}
	): void {
		// Skip logging if disabled or logger not available
		if (!config.enabled || !logger) {
			return
		}

		// Set correlation IDs if available
		this.setCorrelationIds(logger, meta)

		// Determine appropriate log level
		const level = this.determineLogLevel(meta)

		// Log at the determined level
		switch (level) {
			case 'error':
				logger.error(message, meta)
				break
			case 'warn':
				logger.warn(message, meta)
				break
			case 'info':
				logger.info(message, meta)
				break
			case 'debug':
			default:
				logger.debug(message, meta)
				break
		}
	}

	/**
	 * Create a request logger bound to specific configuration
	 *
	 * This factory method creates a logging function that's pre-configured
	 * with the logger and config, making it easier to use throughout a service.
	 *
	 * @param logger - Logger instance to use
	 * @param config - Logging configuration
	 * @returns Bound logging function
	 *
	 * Requirements: 10.4
	 *
	 * @example
	 * ```typescript
	 * class MyService extends BaseResource {
	 *   private logRequest = LoggingHelper.createRequestLogger(this.logger, this.config.logging)
	 *
	 *   async myMethod() {
	 *     this.logRequest('Processing request', { userId: '123' })
	 *   }
	 * }
	 * ```
	 */
	static createRequestLogger(
		logger: Logger | undefined,
		config: LoggingConfig
	): (message: string, meta?: Record<string, any>) => void {
		return (message: string, meta: Record<string, any> = {}) => {
			this.logRequest(logger, config, message, meta)
		}
	}

	/**
	 * Determine the appropriate log level based on metadata
	 *
	 * Logic:
	 * - If error is present -> 'error'
	 * - If warning is present or status >= 400 -> 'warn'
	 * - Otherwise -> 'info'
	 *
	 * @param meta - Metadata to analyze
	 * @returns Determined log level
	 *
	 * Requirements: 10.3
	 */
	private static determineLogLevel(meta: Record<string, any>): LogLevel {
		// Check for explicit error
		if (meta.error) {
			return 'error'
		}

		// Check for warning or HTTP error status
		if (meta.warning || (meta.status && meta.status >= 400)) {
			return 'warn'
		}

		// Default to info level
		return 'info'
	}

	/**
	 * Set correlation IDs in the logger context
	 *
	 * This method extracts correlation ID and request ID from metadata
	 * and sets them in the logger context for request tracing.
	 *
	 * @param logger - Logger instance
	 * @param meta - Metadata containing potential correlation IDs
	 *
	 * Requirements: 10.2
	 */
	private static setCorrelationIds(logger: Logger, meta: Record<string, any>): void {
		// Set correlation ID if available
		if (meta.correlationId && typeof logger.setCorrelationId === 'function') {
			logger.setCorrelationId(meta.correlationId)
		}

		// Set request ID if available
		if (meta.requestId && typeof logger.setRequestId === 'function') {
			logger.setRequestId(meta.requestId)
		}
	}
}
