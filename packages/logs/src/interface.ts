/**
 * Deprecated: use src/types instead.
 * Defines interfaces and types for the logging system.
 */

export type Fields = {
	[field: string]: unknown
}

export interface Logger {
	debug(message: string, fields?: Fields): void
	info(message: string, fields?: Fields): void
	warn(message: string, fields?: Fields): void
	error(message: string, fields?: Fields): void
}

export interface LoggingConfig {
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
