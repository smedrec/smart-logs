import { promisify } from 'node:util'
import { gzip } from 'node:zlib'

import { DefaultBatchManager } from '../core/batch-manager.js'

import type { BatchManager, CircuitBreaker, RetryManager } from '../types/batch.js'
import type { OTLPConfig } from '../types/config.js'
import type { LogEntry } from '../types/log-entry.js'
import type { LogTransport } from '../types/transport.js'

const gzipAsync = promisify(gzip)

/**
 * OTLP-specific export error with status code information
 */
class OTLPExportError extends Error {
	constructor(
		message: string,
		public readonly statusCode: number,
		public readonly isRetryable: boolean
	) {
		super(message)
		this.name = 'OTLPExportError'
	}
}

/**
 * OTLP log record structure for export
 */
interface OTLPLogRecord {
	timeUnixNano: string
	observedTimeUnixNano: string
	severityNumber: number
	severityText: string
	body: {
		stringValue: string
	}
	attributes: Array<{
		key: string
		value: {
			stringValue?: string
			intValue?: string
			doubleValue?: number
			boolValue?: boolean
		}
	}>
	resource: {
		attributes: Array<{
			key: string
			value: {
				stringValue?: string
				intValue?: string
				doubleValue?: number
				boolValue?: boolean
			}
		}>
	}
}

/**
 * OTLP (OpenTelemetry Protocol) transport implementation
 * Addresses requirements 4.1, 4.2, 1.1: Proper OTLP naming, standard compliance, consistent interface
 * Addresses requirements 4.3, 4.5, 2.5: Batching, compression, concurrency limiting
 */
export class OTLPTransport implements LogTransport {
	public readonly name = 'otlp'
	private readonly batchManager: BatchManager
	private isHealthyState = true
	private lastError: Error | null = null
	private readonly compressionThreshold = 1024 // Compress payloads larger than 1KB

	constructor(
		private readonly config: OTLPConfig,
		private readonly circuitBreaker?: CircuitBreaker,
		private readonly retryManager?: RetryManager
	) {
		// Validate required configuration
		if (!config.endpoint) {
			throw new Error('OTLP transport requires an endpoint to be configured')
		}

		// Initialize batch manager with OTLP-specific configuration
		this.batchManager = new DefaultBatchManager(
			{
				maxSize: config.batchSize,
				timeoutMs: config.batchTimeoutMs,
				maxConcurrency: config.maxConcurrency,
				maxQueueSize: config.batchSize * 10, // Allow 10x batch size in queue
			},
			(entries) => this.processBatch(entries)
		)
	}

	/**
	 * Send log entries to OTLP endpoint using batching
	 * Implements proper format conversion without extra envelope wrapping
	 */
	async send(entries: LogEntry[]): Promise<void> {
		if (entries.length === 0) {
			return
		}

		// Add entries to batch manager for processing
		for (const entry of entries) {
			await this.batchManager.add(entry)
		}
	}

	/**
	 * Flush any pending logs
	 */
	async flush(): Promise<void> {
		await this.batchManager.flush()
	}

	/**
	 * Close the transport and cleanup resources
	 */
	async close(): Promise<void> {
		await this.batchManager.close()
	}

	/**
	 * Check if the transport is healthy
	 */
	isHealthy(): boolean {
		const batchHealthy = this.batchManager.isHealthy()
		const circuitHealthy = this.circuitBreaker ? this.circuitBreaker.getState() !== 'open' : true
		return this.isHealthyState && batchHealthy && circuitHealthy
	}

	/**
	 * Get the last error that occurred
	 */
	getLastError(): Error | null {
		return this.lastError
	}

	/**
	 * Perform health check on OTLP endpoint
	 * Used by circuit breaker for automatic failover
	 */
	async performHealthCheck(): Promise<boolean> {
		try {
			// Send a minimal health check request to the OTLP endpoint
			// Endpoint is guaranteed to be present after validation in constructor
			const response = await fetch(this.config.endpoint!, {
				method: 'HEAD', // Use HEAD to minimize overhead
				headers: {
					'User-Agent': 'structured-logger/1.0.0',
					...this.config.headers,
				},
				signal: AbortSignal.timeout(5000), // 5 second timeout for health checks
			})

			// Consider 2xx and 405 (Method Not Allowed) as healthy
			// 405 is acceptable because some OTLP endpoints don't support HEAD
			return response.ok || response.status === 405
		} catch (error) {
			// Any network error indicates unhealthy endpoint
			return false
		}
	}

	/**
	 * Get circuit breaker state for monitoring
	 */
	getCircuitBreakerState(): 'closed' | 'open' | 'half-open' | 'not-configured' {
		return this.circuitBreaker?.getState() || 'not-configured'
	}

	/**
	 * Get batch manager statistics for monitoring
	 */
	getBatchStats(): {
		pendingCount: number
		isHealthy: boolean
	} {
		return {
			pendingCount: this.batchManager.getPendingCount(),
			isHealthy: this.batchManager.isHealthy(),
		}
	}

	/**
	 * Determine if an HTTP status code indicates a retryable error
	 * Based on OTLP specification and common HTTP practices
	 */
	private isRetryableStatus(statusCode: number): boolean {
		// 2xx - Success (not an error)
		if (statusCode >= 200 && statusCode < 300) {
			return false
		}

		// 4xx - Client errors (generally not retryable)
		if (statusCode >= 400 && statusCode < 500) {
			// Exception: 429 Too Many Requests is retryable
			// Exception: 408 Request Timeout is retryable
			return statusCode === 429 || statusCode === 408
		}

		// 5xx - Server errors (generally retryable)
		if (statusCode >= 500 && statusCode < 600) {
			return true
		}

		// Other status codes (1xx, 3xx) - treat as non-retryable
		return false
	}

	/**
	 * Process a batch of log entries with retry logic and circuit breaker integration
	 * This is called by the batch manager when a batch is ready to send
	 * Addresses requirements 4.4, 9.1, 9.2: Retry policies, circuit breaker integration
	 */
	private async processBatch(entries: LogEntry[]): Promise<void> {
		if (entries.length === 0) {
			return
		}

		// Check circuit breaker before attempting to send
		if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
			const error = new Error('Circuit breaker is open, OTLP endpoint is unavailable')
			this.isHealthyState = false
			this.lastError = error
			throw error
		}

		try {
			// Convert log entries to OTLP format
			const logRecords = entries.map((entry) => this.convertToOTLPFormat(entry))

			// Execute with retry logic if retry manager is available
			if (this.retryManager) {
				await this.retryManager.executeWithRetry(() => this.sendToOTLPEndpoint(logRecords), {
					maxAttempts: 3,
					initialDelayMs: 1000,
					maxDelayMs: 30000,
					multiplier: 2,
				})
			} else {
				// Send directly without retry
				await this.sendToOTLPEndpoint(logRecords)
			}

			// Notify circuit breaker of success
			if (this.circuitBreaker) {
				this.circuitBreaker.onSuccess()
			}

			this.isHealthyState = true
			this.lastError = null
		} catch (error) {
			// Notify circuit breaker of failure
			if (this.circuitBreaker) {
				this.circuitBreaker.onFailure()
			}

			this.isHealthyState = false
			this.lastError = error as Error
			throw error
		}
	}

	/**
	 * Send OTLP log records to the endpoint using direct HTTP with compression
	 * Addresses requirement 4.5: gzip compression with proper Content-Encoding headers
	 */
	private async sendToOTLPEndpoint(logRecords: OTLPLogRecord[]): Promise<void> {
		const payload = {
			resourceLogs: [
				{
					resource: {
						attributes: [
							{
								key: 'service.name',
								value: { stringValue: this.config.name || 'otlp-transport' },
							},
							{
								key: 'service.version',
								value: { stringValue: '1.0.0' },
							},
						],
					},
					scopeLogs: [
						{
							scope: {
								name: 'structured-logger',
								version: '1.0.0',
							},
							logRecords,
						},
					],
				},
			],
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'User-Agent': 'structured-logger/1.0.0',
			...this.config.headers,
		}

		// Serialize payload
		const jsonPayload = JSON.stringify(payload)
		let body: string | ArrayBuffer = jsonPayload

		// Apply gzip compression if payload is large enough
		if (jsonPayload.length > this.compressionThreshold) {
			try {
				const compressed = await gzipAsync(Buffer.from(jsonPayload, 'utf8'))
				// Convert Buffer to ArrayBuffer for fetch API
				const arrayBuffer = new ArrayBuffer(compressed.length)
				const view = new Uint8Array(arrayBuffer)
				view.set(compressed)
				body = arrayBuffer
				headers['Content-Encoding'] = 'gzip'
			} catch (compressionError) {
				// If compression fails, send uncompressed
				console.warn('OTLP compression failed, sending uncompressed:', compressionError)
			}
		}

		// Endpoint is guaranteed to be present after validation in constructor
		const response = await fetch(this.config.endpoint!, {
			method: 'POST',
			headers,
			body,
			signal: AbortSignal.timeout(this.config.timeoutMs),
		})

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unable to read response')

			// Create OTLP-specific error with proper categorization
			const error = new OTLPExportError(
				`OTLP export failed: ${response.status} ${response.statusText} - ${errorText}`,
				response.status,
				this.isRetryableStatus(response.status)
			)

			throw error
		}
	}

	/**
	 * Convert LogEntry to OTLP LogRecord format
	 * Ensures correct format without extra envelope wrapping
	 */
	private convertToOTLPFormat(entry: LogEntry): OTLPLogRecord {
		// Convert timestamp to nanoseconds
		const timeNanos = (entry.timestamp.getTime() * 1000000).toString()

		// Create attributes array
		const attributes: Array<{
			key: string
			value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean }
		}> = []

		// Add core attributes
		attributes.push(
			{ key: 'log.id', value: { stringValue: entry.id } },
			{ key: 'log.source', value: { stringValue: entry.source } },
			{ key: 'log.version', value: { stringValue: entry.version } }
		)

		// Add context attributes
		if (entry.requestId) {
			attributes.push({ key: 'request.id', value: { stringValue: entry.requestId } })
		}
		if (entry.correlationId) {
			attributes.push({ key: 'correlation.id', value: { stringValue: entry.correlationId } })
		}
		if (entry.traceId) {
			attributes.push({ key: 'trace.id', value: { stringValue: entry.traceId } })
		}
		if (entry.spanId) {
			attributes.push({ key: 'span.id', value: { stringValue: entry.spanId } })
		}

		// Add metadata attributes
		attributes.push(
			{ key: 'service.name', value: { stringValue: entry.metadata.service } },
			{ key: 'service.environment', value: { stringValue: entry.metadata.environment } },
			{ key: 'host.name', value: { stringValue: entry.metadata.hostname } },
			{ key: 'process.pid', value: { intValue: entry.metadata.pid.toString() } }
		)

		// Add request metadata
		if (entry.metadata.request) {
			const req = entry.metadata.request
			if (req.method) attributes.push({ key: 'http.method', value: { stringValue: req.method } })
			if (req.url) attributes.push({ key: 'http.url', value: { stringValue: req.url } })
			if (req.userAgent)
				attributes.push({ key: 'http.user_agent', value: { stringValue: req.userAgent } })
			if (req.ip) attributes.push({ key: 'http.client_ip', value: { stringValue: req.ip } })
			if (req.duration)
				attributes.push({ key: 'http.request.duration', value: { doubleValue: req.duration } })
			if (req.statusCode)
				attributes.push({ key: 'http.status_code', value: { intValue: req.statusCode.toString() } })
		}

		// Add database metadata
		if (entry.metadata.database) {
			const db = entry.metadata.database
			attributes.push(
				{ key: 'db.operation', value: { stringValue: db.operation } },
				{ key: 'db.duration', value: { doubleValue: db.duration } }
			)
			if (db.table) attributes.push({ key: 'db.table', value: { stringValue: db.table } })
			if (db.rowsAffected)
				attributes.push({
					key: 'db.rows_affected',
					value: { intValue: db.rowsAffected.toString() },
				})
		}

		// Add security metadata
		if (entry.metadata.security) {
			const sec = entry.metadata.security
			attributes.push(
				{ key: 'security.event', value: { stringValue: sec.event } },
				{ key: 'security.severity', value: { stringValue: sec.severity } }
			)
			if (sec.userId)
				attributes.push({ key: 'security.user_id', value: { stringValue: sec.userId } })
			if (sec.action)
				attributes.push({ key: 'security.action', value: { stringValue: sec.action } })
			if (sec.resource)
				attributes.push({ key: 'security.resource', value: { stringValue: sec.resource } })
		}

		// Add performance metrics
		if (entry.performance) {
			const perf = entry.performance
			if (perf.cpuUsage)
				attributes.push({ key: 'performance.cpu_usage', value: { doubleValue: perf.cpuUsage } })
			if (perf.memoryUsage)
				attributes.push({
					key: 'performance.memory_usage',
					value: { doubleValue: perf.memoryUsage },
				})
			if (perf.duration)
				attributes.push({ key: 'performance.duration', value: { doubleValue: perf.duration } })
			if (perf.operationCount)
				attributes.push({
					key: 'performance.operation_count',
					value: { intValue: perf.operationCount.toString() },
				})
		}

		// Add custom fields (flatten nested objects)
		this.addFieldsToAttributes(entry.fields, attributes, 'field')

		// Create the log record with proper OTLP structure
		const logRecord: OTLPLogRecord = {
			timeUnixNano: timeNanos,
			observedTimeUnixNano: timeNanos,
			severityNumber: this.mapLogLevelToSeverity(entry.level),
			severityText: entry.level.toString().toUpperCase(),
			body: {
				stringValue: entry.message,
			},
			attributes,
			resource: {
				attributes: [
					{ key: 'service.name', value: { stringValue: entry.metadata.service } },
					{ key: 'service.environment', value: { stringValue: entry.metadata.environment } },
				],
			},
		}

		return logRecord
	}

	/**
	 * Add fields to attributes array with proper type conversion
	 */
	private addFieldsToAttributes(
		fields: Record<string, any>,
		attributes: Array<{
			key: string
			value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean }
		}>,
		prefix: string = ''
	): void {
		for (const [key, value] of Object.entries(fields)) {
			if (value === null || value === undefined) {
				continue
			}

			const fullKey = prefix ? `${prefix}.${key}` : key

			if (typeof value === 'string') {
				attributes.push({ key: fullKey, value: { stringValue: value } })
			} else if (typeof value === 'number') {
				if (Number.isInteger(value)) {
					attributes.push({ key: fullKey, value: { intValue: value.toString() } })
				} else {
					attributes.push({ key: fullKey, value: { doubleValue: value } })
				}
			} else if (typeof value === 'boolean') {
				attributes.push({ key: fullKey, value: { boolValue: value } })
			} else if (typeof value === 'object' && !Array.isArray(value)) {
				// Recursively flatten nested objects
				this.addFieldsToAttributes(value, attributes, fullKey)
			} else {
				// Convert arrays and other types to JSON strings
				attributes.push({ key: fullKey, value: { stringValue: JSON.stringify(value) } })
			}
		}
	}

	/**
	 * Map log level to OTLP severity number
	 */
	private mapLogLevelToSeverity(level: string): number {
		const severityMap: Record<string, number> = {
			debug: 5, // DEBUG
			info: 9, // INFO
			warn: 13, // WARN
			error: 17, // ERROR
			fatal: 21, // FATAL
		}

		return severityMap[level.toLowerCase()] || 9 // Default to INFO
	}
}
