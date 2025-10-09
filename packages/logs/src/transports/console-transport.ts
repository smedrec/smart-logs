import { LogLevel, LogLevelUtils } from '../types/logger.js'
import { ConsoleFormatter } from '../utils/console-formatter.js'

import type { ConsoleConfig } from '../types/config.js'
import type { LogEntry } from '../types/log-entry.js'
import type { LogTransport } from '../types/transport.js'
import type { FormatterOptions, SensitiveDataMaskingOptions } from '../utils/console-formatter.js'

/**
 * Console transport implementation with proper formatting
 * Addresses requirements 5.1 and 1.1: Console output with LogTransport interface compliance
 */
export class ConsoleTransport implements LogTransport {
	public readonly name = 'console'
	private readonly config: Required<ConsoleConfig>
	private readonly formatter: ConsoleFormatter
	private isShuttingDown = false

	constructor(
		config: Partial<ConsoleConfig> = {},
		formatterOptions: Partial<FormatterOptions> = {},
		maskingOptions: Partial<SensitiveDataMaskingOptions> = {}
	) {
		// Apply defaults for required configuration
		this.config = {
			name: 'console',
			enabled: true,
			level: undefined,
			format: config.format ?? 'pretty',
			colorize: config.colorize ?? true,
			...config,
		} as Required<ConsoleConfig>

		// Initialize formatter with enhanced options
		this.formatter = new ConsoleFormatter(this.config, formatterOptions, maskingOptions)
	}

	/**
	 * Send log entries to console with appropriate formatting
	 */
	async send(entries: LogEntry[]): Promise<void> {
		if (this.isShuttingDown || !this.config.enabled) {
			return
		}

		try {
			for (const entry of entries) {
				// Check if entry meets minimum log level
				if (this.config.level && !LogLevelUtils.meetsMinimum(entry.level, this.config.level)) {
					continue
				}

				await this.writeEntry(entry)
			}
		} catch (error) {
			// Fallback error handling - write to stderr to avoid infinite loops
			this.writeFallbackError(error, entries.length)
		}
	}

	/**
	 * Flush any pending operations (no-op for console)
	 */
	async flush(): Promise<void> {
		// Console output is synchronous, no flushing needed
		return Promise.resolve()
	}

	/**
	 * Close the transport and cleanup resources
	 */
	async close(): Promise<void> {
		this.isShuttingDown = true
		return Promise.resolve()
	}

	/**
	 * Check if the transport is healthy
	 */
	isHealthy(): boolean {
		return !this.isShuttingDown && this.config.enabled
	}

	/**
	 * Write a single log entry to console
	 */
	private async writeEntry(entry: LogEntry): Promise<void> {
		try {
			const output = this.formatEntry(entry)
			const writeMethod = this.getWriteMethod(entry.level)

			// Use setImmediate to avoid blocking the event loop
			return new Promise<void>((resolve) => {
				setImmediate(() => {
					writeMethod(output)
					resolve()
				})
			})
		} catch (error) {
			this.writeFallbackError(error, 1)
		}
	}

	/**
	 * Format a log entry based on configuration using the enhanced formatter
	 */
	private formatEntry(entry: LogEntry): string {
		if (this.config.format === 'json') {
			return this.formatter.formatJson(entry)
		} else {
			return this.formatter.formatPretty(entry)
		}
	}

	/**
	 * Get the appropriate write method based on log level
	 */
	private getWriteMethod(level: LogLevel | string): (message: string) => void {
		// Use stderr for error and fatal levels, stdout for others
		if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
			return (message: string) => process.stderr.write(message + '\n')
		}
		return (message: string) => process.stdout.write(message + '\n')
	}

	/**
	 * Write fallback error message when normal logging fails
	 */
	private writeFallbackError(error: unknown, entryCount: number): void {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error'
		const fallback = `[CONSOLE TRANSPORT ERROR] Failed to write ${entryCount} log entries: ${errorMessage}\n`

		try {
			process.stderr.write(fallback)
		} catch {
			// If even stderr fails, there's nothing more we can do
		}
	}

	/**
	 * Create a console transport with development-friendly settings
	 */
	static createDevelopmentTransport(options: Partial<FormatterOptions> = {}): ConsoleTransport {
		const config: Partial<ConsoleConfig> = {
			format: 'pretty',
			colorize: true,
		}

		const formatterOptions: Partial<FormatterOptions> = {
			showTimestamp: true,
			showLevel: true,
			showCorrelationId: true,
			showRequestId: true,
			showFields: true,
			showMetadata: true,
			showPerformance: true,
			timestampFormat: 'short',
			...options,
		}

		const maskingOptions: Partial<SensitiveDataMaskingOptions> = {
			maskSensitiveFields: true,
			preserveLength: false,
		}

		return new ConsoleTransport(config, formatterOptions, maskingOptions)
	}

	/**
	 * Create a console transport with production-friendly settings
	 */
	static createProductionTransport(options: Partial<FormatterOptions> = {}): ConsoleTransport {
		const config: Partial<ConsoleConfig> = {
			format: 'json',
			colorize: false,
		}

		const formatterOptions: Partial<FormatterOptions> = {
			showTimestamp: true,
			showLevel: true,
			showCorrelationId: true,
			showRequestId: true,
			showFields: true,
			showMetadata: true,
			showPerformance: false, // Reduce noise in production
			timestampFormat: 'iso',
			maxFieldLength: 500, // Limit field length in production
			maxMessageLength: 2000,
			...options,
		}

		const maskingOptions: Partial<SensitiveDataMaskingOptions> = {
			maskSensitiveFields: true,
			preserveLength: false,
		}

		return new ConsoleTransport(config, formatterOptions, maskingOptions)
	}
}
