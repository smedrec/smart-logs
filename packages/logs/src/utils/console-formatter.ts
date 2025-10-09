import chalk from 'chalk'

import { LogLevel } from '../types/logger.js'
import { LogSerializer } from './serializer.js'

import type { ConsoleConfig } from '../types/config.js'
import type { LogEntry } from '../types/log-entry.js'
import type { LogFields } from '../types/logger.js'

/**
 * Console formatting options and utilities
 * Addresses requirement 5.1: Configurable formatting for different environments
 */

export interface FormatterOptions {
	colorize: boolean
	showTimestamp: boolean
	showLevel: boolean
	showCorrelationId: boolean
	showRequestId: boolean
	showFields: boolean
	showMetadata: boolean
	showPerformance: boolean
	timestampFormat: 'iso' | 'local' | 'short'
	fieldFilter?: string[]
	sensitiveFields?: string[]
	maxFieldLength?: number
	maxMessageLength?: number
}

export interface SensitiveDataMaskingOptions {
	maskSensitiveFields: boolean
	sensitiveFieldPatterns: RegExp[]
	maskingChar: string
	preserveLength: boolean
}

/**
 * Console formatter for development and production environments
 */
export class ConsoleFormatter {
	private readonly options: FormatterOptions
	private readonly maskingOptions: SensitiveDataMaskingOptions

	constructor(
		config: ConsoleConfig,
		options: Partial<FormatterOptions> = {},
		maskingOptions: Partial<SensitiveDataMaskingOptions> = {}
	) {
		this.options = {
			colorize: config.colorize,
			showTimestamp: true,
			showLevel: true,
			showCorrelationId: true,
			showRequestId: true,
			showFields: true,
			showMetadata: true,
			showPerformance: true,
			timestampFormat: 'iso',
			maxFieldLength: 1000,
			maxMessageLength: 5000,
			...options,
		}

		this.maskingOptions = {
			maskSensitiveFields: true,
			sensitiveFieldPatterns: [
				/password/i,
				/secret/i,
				/token/i,
				/key/i,
				/auth/i,
				/credential/i,
				/ssn/i,
				/social.security/i,
				/credit.card/i,
				/card.number/i,
			],
			maskingChar: '*',
			preserveLength: false,
			...maskingOptions,
		}
	}

	/**
	 * Format entry for pretty-print development output
	 */
	formatPretty(entry: LogEntry): string {
		const parts: string[] = []

		// Timestamp
		if (this.options.showTimestamp) {
			parts.push(this.formatTimestamp(entry.timestamp))
		}

		// Log level
		if (this.options.showLevel) {
			parts.push(this.formatLevel(entry.level))
		}

		// Message
		const message = this.truncateText(entry.message, this.options.maxMessageLength)
		parts.push(this.formatMessage(message))

		// Correlation ID
		if (this.options.showCorrelationId && entry.correlationId) {
			parts.push(this.formatCorrelationId(entry.correlationId))
		}

		// Request ID
		if (this.options.showRequestId && entry.requestId) {
			parts.push(this.formatRequestId(entry.requestId))
		}

		let output = parts.join(' ')

		// Add structured fields
		if (this.options.showFields && entry.fields && Object.keys(entry.fields).length > 0) {
			const fields = this.formatFields(entry.fields)
			if (fields) {
				output += `\n  ${fields}`
			}
		}

		// Add metadata
		if (this.options.showMetadata && entry.metadata) {
			const metadata = this.formatMetadata(entry.metadata)
			if (metadata) {
				output += `\n  ${metadata}`
			}
		}

		// Add performance metrics
		if (this.options.showPerformance && entry.performance) {
			const performance = this.formatPerformance(entry.performance)
			if (performance) {
				output += `\n  ${performance}`
			}
		}

		return output
	}

	/**
	 * Format entry as JSON for production log aggregation
	 */
	formatJson(entry: LogEntry): string {
		try {
			// Create a copy of the entry for potential field filtering
			const filteredEntry = this.applyFieldFiltering(entry)
			return LogSerializer.serialize(filteredEntry)
		} catch (error) {
			// Fallback to basic JSON structure
			return JSON.stringify({
				'@timestamp': entry.timestamp.toISOString(),
				level: entry.level,
				message: this.truncateText(entry.message, this.options.maxMessageLength),
				correlationId: entry.correlationId,
				'@error': `Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			})
		}
	}

	/**
	 * Format timestamp based on configuration
	 */
	private formatTimestamp(timestamp: Date): string {
		let formatted: string

		switch (this.options.timestampFormat) {
			case 'local':
				formatted = timestamp.toLocaleString()
				break
			case 'short':
				formatted = timestamp.toTimeString().split(' ')[0] // HH:MM:SS
				break
			case 'iso':
			default:
				formatted = timestamp.toISOString().replace('T', ' ').replace('Z', '')
				break
		}

		return this.colorize(formatted, 'gray')
	}

	/**
	 * Format log level with appropriate colors and indicators
	 */
	private formatLevel(level: LogLevel | string): string {
		const levelStr = String(level).toUpperCase()
		const paddedLevel = levelStr.padEnd(5)
		const indicator = this.getLevelIndicator(level)

		if (!this.options.colorize) {
			return `${indicator}[${paddedLevel}]`
		}

		switch (level) {
			case LogLevel.DEBUG:
				return this.colorize(`${indicator}[${paddedLevel}]`, 'gray')
			case LogLevel.INFO:
				return this.colorize(`${indicator}[${paddedLevel}]`, 'blue')
			case LogLevel.WARN:
				return this.colorize(`${indicator}[${paddedLevel}]`, 'yellow')
			case LogLevel.ERROR:
				return this.colorize(`${indicator}[${paddedLevel}]`, 'red')
			case LogLevel.FATAL:
				return chalk.bgRed.white(`${indicator}[${paddedLevel}]`) // Keep special formatting for fatal
			default:
				return `${indicator}[${paddedLevel}]`
		}
	}

	/**
	 * Get visual indicator for log level
	 */
	private getLevelIndicator(level: LogLevel | string): string {
		switch (level) {
			case LogLevel.DEBUG:
				return '🔍 '
			case LogLevel.INFO:
				return 'ℹ️  '
			case LogLevel.WARN:
				return '⚠️  '
			case LogLevel.ERROR:
				return '❌ '
			case LogLevel.FATAL:
				return '💀 '
			default:
				return '📝 '
		}
	}

	/**
	 * Format message with potential truncation
	 */
	private formatMessage(message: string): string {
		return message
	}

	/**
	 * Format correlation ID with short display
	 */
	private formatCorrelationId(correlationId: string): string {
		const shortId = correlationId.slice(0, 8)
		return this.colorize(`[${shortId}]`, 'magenta')
	}

	/**
	 * Format request ID
	 */
	private formatRequestId(requestId: string): string {
		const shortId = requestId.slice(0, 8)
		return this.colorize(`[req:${shortId}]`, 'cyan')
	}

	/**
	 * Format structured fields with filtering and masking
	 */
	private formatFields(fields: LogFields): string {
		const filteredFields = this.filterAndMaskFields(fields)

		if (Object.keys(filteredFields).length === 0) {
			return ''
		}

		const formatted = Object.entries(filteredFields)
			.map(([key, value]) => {
				const keyStr = this.colorize(key, 'cyan')
				const valueStr = this.formatFieldValue(value)
				return `${keyStr}=${valueStr}`
			})
			.join(' ')

		return `Fields: ${formatted}`
	}

	/**
	 * Format a field value with appropriate handling for different types
	 */
	private formatFieldValue(value: unknown): string {
		if (value === null) return this.colorize('null', 'gray')
		if (value === undefined) return this.colorize('undefined', 'gray')

		if (typeof value === 'string') {
			const truncated = this.truncateText(value, this.options.maxFieldLength)
			return this.colorize(`"${truncated}"`, 'green')
		}

		if (typeof value === 'number') {
			return this.colorize(String(value), 'yellow')
		}

		if (typeof value === 'boolean') {
			return this.colorize(String(value), 'blue')
		}

		if (typeof value === 'object') {
			try {
				const json = JSON.stringify(value)
				const truncated = this.truncateText(json, this.options.maxFieldLength)
				return this.colorize(truncated, 'white')
			} catch {
				return this.colorize('[Object]', 'gray')
			}
		}

		return String(value)
	}

	/**
	 * Format metadata for display
	 */
	private formatMetadata(metadata: any): string {
		if (!metadata || typeof metadata !== 'object') return ''

		const parts: string[] = []

		// Format request metadata
		if (metadata.request) {
			const reqStr = this.formatRequestMetadata(metadata.request)
			if (reqStr) parts.push(reqStr)
		}

		// Format database metadata
		if (metadata.database) {
			const dbStr = this.formatDatabaseMetadata(metadata.database)
			if (dbStr) parts.push(dbStr)
		}

		// Format security metadata
		if (metadata.security) {
			const secStr = this.formatSecurityMetadata(metadata.security)
			if (secStr) parts.push(secStr)
		}

		// Format service metadata
		if (metadata.service || metadata.environment || metadata.hostname) {
			const serviceStr = this.formatServiceMetadata(metadata)
			if (serviceStr) parts.push(serviceStr)
		}

		return parts.join('\n  ')
	}

	/**
	 * Format request metadata
	 */
	private formatRequestMetadata(request: any): string {
		let reqStr = this.colorize('Request:', 'blue')

		if (request.method && request.url) {
			reqStr += ` ${request.method} ${request.url}`
		}

		if (request.duration) {
			const durationColor =
				request.duration > 1000 ? 'red' : request.duration > 500 ? 'yellow' : 'green'
			reqStr += ` ${this.colorize(`(${request.duration}ms)`, durationColor)}`
		}

		if (request.statusCode) {
			const statusColor =
				request.statusCode >= 500 ? 'red' : request.statusCode >= 400 ? 'yellow' : 'green'
			reqStr += ` ${this.colorize(`[${request.statusCode}]`, statusColor)}`
		}

		if (request.ip) {
			reqStr += ` from ${this.colorize(request.ip, 'cyan')}`
		}

		return reqStr
	}

	/**
	 * Format database metadata
	 */
	private formatDatabaseMetadata(database: any): string {
		let dbStr = this.colorize('Database:', 'blue')
		dbStr += ` ${database.operation}`

		if (database.table) {
			dbStr += ` on ${this.colorize(database.table, 'cyan')}`
		}

		if (database.duration) {
			const durationColor =
				database.duration > 1000 ? 'red' : database.duration > 100 ? 'yellow' : 'green'
			dbStr += ` ${this.colorize(`(${database.duration}ms)`, durationColor)}`
		}

		if (database.rowsAffected) {
			dbStr += ` ${this.colorize(`[${database.rowsAffected} rows]`, 'yellow')}`
		}

		return dbStr
	}

	/**
	 * Format security metadata
	 */
	private formatSecurityMetadata(security: any): string {
		let secStr = this.colorize('Security:', 'red')
		secStr += ` ${security.event}`

		if (security.severity) {
			const severityColor =
				security.severity === 'critical' ? 'red' : security.severity === 'high' ? 'yellow' : 'blue'
			secStr += ` ${this.colorize(`[${security.severity}]`, severityColor)}`
		}

		if (security.userId) {
			secStr += ` user:${this.colorize(security.userId, 'cyan')}`
		}

		if (security.action) {
			secStr += ` action:${security.action}`
		}

		return secStr
	}

	/**
	 * Format service metadata
	 */
	private formatServiceMetadata(metadata: any): string {
		const parts: string[] = []

		if (metadata.service) {
			parts.push(`service:${this.colorize(metadata.service, 'cyan')}`)
		}

		if (metadata.environment) {
			const envColor = metadata.environment === 'production' ? 'red' : 'blue'
			parts.push(`env:${this.colorize(metadata.environment, envColor)}`)
		}

		if (metadata.hostname) {
			parts.push(`host:${this.colorize(metadata.hostname, 'gray')}`)
		}

		if (parts.length === 0) return ''

		return `${this.colorize('Service:', 'blue')} ${parts.join(' | ')}`
	}

	/**
	 * Format performance metrics
	 */
	private formatPerformance(performance: any): string {
		if (!performance || typeof performance !== 'object') return ''

		const parts: string[] = []

		if (typeof performance.cpuUsage === 'number') {
			const cpuColor =
				performance.cpuUsage > 80 ? 'red' : performance.cpuUsage > 50 ? 'yellow' : 'green'
			parts.push(`CPU: ${this.colorize(`${performance.cpuUsage.toFixed(2)}%`, cpuColor)}`)
		}

		if (typeof performance.memoryUsage === 'number') {
			const mb = (performance.memoryUsage / 1024 / 1024).toFixed(2)
			const memColor =
				performance.memoryUsage > 500 * 1024 * 1024
					? 'red'
					: performance.memoryUsage > 100 * 1024 * 1024
						? 'yellow'
						: 'green'
			parts.push(`Memory: ${this.colorize(`${mb}MB`, memColor)}`)
		}

		if (typeof performance.duration === 'number') {
			const durationColor =
				performance.duration > 1000 ? 'red' : performance.duration > 500 ? 'yellow' : 'green'
			parts.push(`Duration: ${this.colorize(`${performance.duration}ms`, durationColor)}`)
		}

		if (typeof performance.operationCount === 'number') {
			parts.push(`Operations: ${this.colorize(String(performance.operationCount), 'blue')}`)
		}

		if (parts.length === 0) return ''

		const perfStr = parts.join(' | ')
		return `${this.colorize('Performance:', 'yellow')} ${perfStr}`
	}

	/**
	 * Apply field filtering based on configuration
	 */
	private applyFieldFiltering(entry: LogEntry): LogEntry {
		if (!this.options.fieldFilter || this.options.fieldFilter.length === 0) {
			return entry
		}

		const filteredFields: LogFields = {}

		for (const [key, value] of Object.entries(entry.fields)) {
			if (this.options.fieldFilter.includes(key)) {
				filteredFields[key] = value
			}
		}

		return {
			...entry,
			fields: filteredFields,
		}
	}

	/**
	 * Filter and mask sensitive fields
	 */
	private filterAndMaskFields(fields: LogFields): LogFields {
		const filtered: LogFields = {}

		for (const [key, value] of Object.entries(fields)) {
			// Apply field filtering if configured
			if (this.options.fieldFilter && !this.options.fieldFilter.includes(key)) {
				continue
			}

			// Apply sensitive data masking
			if (this.maskingOptions.maskSensitiveFields && this.isSensitiveField(key)) {
				filtered[key] = this.maskValue(value) as LogFields[string]
			} else {
				filtered[key] = value as LogFields[string]
			}
		}

		return filtered
	}

	/**
	 * Check if a field name matches sensitive patterns
	 */
	private isSensitiveField(fieldName: string): boolean {
		// Check explicit sensitive fields list
		if (this.options.sensitiveFields?.includes(fieldName)) {
			return true
		}

		// Check against patterns
		return this.maskingOptions.sensitiveFieldPatterns.some((pattern) => pattern.test(fieldName))
	}

	/**
	 * Mask a sensitive value
	 */
	private maskValue(value: unknown): string {
		if (typeof value !== 'string') {
			return '[MASKED]'
		}

		if (this.maskingOptions.preserveLength) {
			return this.maskingOptions.maskingChar.repeat(value.length)
		}

		return '[MASKED]'
	}

	/**
	 * Truncate text to maximum length
	 */
	private truncateText(text: string, maxLength?: number): string {
		if (!maxLength || text.length <= maxLength) {
			return text
		}

		return text.slice(0, maxLength - 3) + '...'
	}

	/**
	 * Apply color if colorization is enabled
	 */
	private colorize(text: string, color: string): string {
		if (!this.options.colorize) return text

		// Store original chalk level and force colors for this operation
		const originalLevel = chalk.level
		chalk.level = 1 // Force basic color support

		let result: string
		switch (color) {
			case 'gray':
				result = chalk.gray(text)
				break
			case 'cyan':
				result = chalk.cyan(text)
				break
			case 'magenta':
				result = chalk.magenta(text)
				break
			case 'yellow':
				result = chalk.yellow(text)
				break
			case 'red':
				result = chalk.red(text)
				break
			case 'green':
				result = chalk.green(text)
				break
			case 'blue':
				result = chalk.blue(text)
				break
			case 'white':
				result = chalk.white(text)
				break
			default:
				result = text
				break
		}

		// Restore original chalk level
		chalk.level = originalLevel
		return result
	}
}
