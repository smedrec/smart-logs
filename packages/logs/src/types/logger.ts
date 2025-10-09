/**
 * Core Logger interface with complete method signatures
 * Addresses requirement 1.1: Complete and consistent Logger interface
 */

export enum LogLevel {
	DEBUG = 'debug',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
	FATAL = 'fatal',
}

// Type alias for backward compatibility
export type LogLevelType = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * Log level priority mapping for comparison
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	[LogLevel.DEBUG]: 0,
	[LogLevel.INFO]: 1,
	[LogLevel.WARN]: 2,
	[LogLevel.ERROR]: 3,
	[LogLevel.FATAL]: 4,
}

/**
 * Utility functions for log level comparison
 */
export class LogLevelUtils {
	/**
	 * Compare two log levels
	 * @param level1 First log level
	 * @param level2 Second log level
	 * @returns Negative if level1 < level2, 0 if equal, positive if level1 > level2
	 */
	static compare(level1: LogLevel | LogLevelType, level2: LogLevel | LogLevelType): number {
		const priority1 = LOG_LEVEL_PRIORITY[level1 as LogLevel]
		const priority2 = LOG_LEVEL_PRIORITY[level2 as LogLevel]
		return priority1 - priority2
	}

	/**
	 * Check if a log level meets the minimum threshold
	 * @param level Log level to check
	 * @param minLevel Minimum required level
	 * @returns True if level meets or exceeds minimum level
	 */
	static meetsMinimum(level: LogLevel | LogLevelType, minLevel: LogLevel | LogLevelType): boolean {
		return this.compare(level, minLevel) >= 0
	}

	/**
	 * Get all log levels at or above the specified level
	 * @param minLevel Minimum level
	 * @returns Array of log levels that meet the minimum
	 */
	static getLevelsAtOrAbove(minLevel: LogLevel | LogLevelType): LogLevel[] {
		return Object.values(LogLevel).filter((level) => this.meetsMinimum(level, minLevel))
	}

	/**
	 * Validate if a string is a valid log level
	 * @param level String to validate
	 * @returns True if valid log level
	 */
	static isValidLevel(level: string): level is LogLevel {
		return Object.values(LogLevel).includes(level as LogLevel)
	}

	/**
	 * Parse a string to LogLevel with validation
	 * @param level String to parse
	 * @returns LogLevel if valid, throws error if invalid
	 */
	static parseLevel(level: string): LogLevel {
		if (!this.isValidLevel(level)) {
			throw new Error(
				`Invalid log level: ${level}. Valid levels are: ${Object.values(LogLevel).join(', ')}`
			)
		}
		return level as LogLevel
	}
}

export interface LogFields {
	[key: string]: string | number | boolean | null | undefined | LogFields
}

export interface LogContext {
	requestId?: string
	correlationId?: string
	traceId?: string
	spanId?: string
	userId?: string
	sessionId?: string
}

export interface PerformanceMetrics {
	cpuUsage?: number
	memoryUsage?: number
	duration?: number
	operationCount?: number
}

/**
 * Main Logger interface that all logger implementations must follow
 * Includes all required methods with proper async signatures
 */
export interface Logger {
	// Core logging methods with async signatures
	debug(message: string, fields?: LogFields): Promise<void>
	info(message: string, fields?: LogFields): Promise<void>
	warn(message: string, fields?: LogFields): Promise<void>
	error(message: string, fields?: LogFields): Promise<void>
	fatal(message: string, fields?: LogFields): Promise<void>

	// Context and correlation management
	setRequestId(requestId: string): void
	setCorrelationId(correlationId: string): void
	withContext(context: LogContext): Logger

	// Lifecycle management for proper async handling
	flush(): Promise<void>
	close(): Promise<void>
}

/**
 * Extended logger interface for internal implementations
 */
export interface InternalLogger extends Logger {
	shouldLog(level: LogLevel): boolean
	getContext(): LogContext
}
