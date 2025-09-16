import chalk from 'chalk'

import { Log } from './log.js'

import type { Fields, Logger, LoggingConfig } from './interface.js'
import type { LogSchema } from './log.js'

export class OTPLLogger implements Logger {
	private config: LoggingConfig
	private requestId: LogSchema['requestId']
	private readonly environment: LogSchema['environment']
	private readonly application: LogSchema['application']
	private readonly module: LogSchema['module']
	private readonly version: LogSchema['version']
	private readonly defaultFields: Fields
	// Batch processing for OTLP exports
	private logBatch: Log[] = []
	private batchTimeout: NodeJS.Timeout | null = null
	private readonly BATCH_SIZE = 100
	private readonly BATCH_TIMEOUT_MS = 5000

	constructor(
		opts: {
			environment: LogSchema['environment']
			application: LogSchema['application']
			module: LogSchema['module']
			version?: LogSchema['version']
			requestId?: LogSchema['requestId']
			defaultFields?: Fields
		},
		config: LoggingConfig
	) {
		this.environment = opts.environment
		this.application = opts.application
		this.module = opts.module
		this.version = opts.version || '0.1.0'
		this.requestId = opts.requestId
		this.defaultFields = opts.defaultFields ?? {}
		this.config = config
	}

	private marshal(
		level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
		message: string,
		fields?: Fields
	): Log {
		return new Log({
			type: 'log',
			environment: this.environment,
			application: this.application,
			module: this.module,
			version: this.version,
			requestId: this.requestId,
			time: Date.now(),
			level,
			message,
			context: { ...this.defaultFields, ...fields },
		})
	}

	public debug(message: string, fields?: Fields): void {
		this.sendLogToOTLP(this.marshal('debug', message, fields))
	}
	public info(message: string, fields?: Fields): void {
		this.sendLogToOTLP(this.marshal('info', message, fields))
	}
	public warn(message: string, fields?: Fields): void {
		this.sendLogToOTLP(this.marshal('warn', message, fields))
	}
	public error(message: string, fields?: Fields): void {
		this.sendLogToOTLP(this.marshal('error', message, fields))
	}
	public fatal(message: string, fields?: Fields): void {
		this.sendLogToOTLP(this.marshal('fatal', message, fields))
	}

	public setRequestId(requestId?: string): void {
		this.requestId = requestId || crypto.randomUUID()
	}

	/**
	 * Send logs to OTLP HTTP endpoint
	 */
	private async sendLogToOTLP(log: Log): Promise<void> {
		if (!this.config.exporterEndpoint) {
			throw new Error('OTLP exporter endpoint not configured')
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'User-Agent': `audit-system-tracer/1.0.0`,
			...this.config.exporterHeaders,
		}

		let body = JSON.stringify(log)

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
				const response = await fetch(this.config.exporterEndpoint, requestConfig)

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
