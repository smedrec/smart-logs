/**
 * Distributed tracing implementation for audit event lifecycle tracking
 */
import { randomBytes } from 'crypto'

import { ObservabilityConfig } from '../config/types.js'

import type { Span, SpanLog, SpanStatus, TraceContext } from './types.js'

/**
 * Tracer interface for distributed tracing
 */
export interface Tracer {
	startSpan(operationName: string, parentContext?: TraceContext): Span
	finishSpan(span: Span): void
	injectContext(span: Span): TraceContext
	extractContext(headers: Record<string, string>): TraceContext | null
	createChildSpan(parentSpan: Span, operationName: string): Span
}

/**
 * Span implementation
 */
export class AuditSpan implements Span {
	public traceId: string
	public spanId: string
	public parentSpanId?: string
	public operationName: string
	public startTime: number
	public endTime?: number
	public duration?: number
	public tags: Record<string, any> = {}
	public logs: SpanLog[] = []
	public status: SpanStatus = { code: 'OK' }
	public component: string = 'audit-system'

	constructor(operationName: string, traceId?: string, parentSpanId?: string) {
		this.operationName = operationName
		this.traceId = traceId || this.generateTraceId()
		this.spanId = this.generateSpanId()
		this.parentSpanId = parentSpanId
		this.startTime = Date.now()
	}

	/**
	 * Add a tag to the span
	 */
	setTag(key: string, value: any): void {
		this.tags[key] = value
	}

	/**
	 * Add multiple tags to the span
	 */
	setTags(tags: Record<string, any>): void {
		Object.assign(this.tags, tags)
	}

	/**
	 * Add a log entry to the span
	 */
	log(
		level: 'debug' | 'info' | 'warn' | 'error',
		message: string,
		fields?: Record<string, any>
	): void {
		this.logs.push({
			timestamp: Date.now(),
			level,
			message,
			fields,
		})
	}

	/**
	 * Set the span status
	 */
	setStatus(code: 'OK' | 'ERROR' | 'TIMEOUT' | 'CANCELLED', message?: string): void {
		this.status = { code, message }
	}

	/**
	 * Finish the span
	 */
	finish(): void {
		this.endTime = Date.now()
		this.duration = this.endTime - this.startTime
	}

	/**
	 * Generate a unique trace ID
	 */
	private generateTraceId(): string {
		return randomBytes(16).toString('hex')
	}

	/**
	 * Generate a unique span ID
	 */
	private generateSpanId(): string {
		return randomBytes(8).toString('hex')
	}
}

/**
 * Audit tracer implementation
 */
export class AuditTracer implements Tracer {
	private spans: Map<string, Span> = new Map()
	private config: ObservabilityConfig['tracing']
	private activeSpans: Map<string, Span> = new Map()

	constructor(config: ObservabilityConfig['tracing']) {
		this.config = config
	}

	/**
	 * Start a new span
	 */
	startSpan(operationName: string, parentContext?: TraceContext): Span {
		const span = new AuditSpan(operationName, parentContext?.traceId, parentContext?.spanId)

		// Add service information
		span.setTags({
			'service.name': this.config.serviceName,
			'service.version': process.env.npm_package_version || '1.0.0',
			'span.kind': 'internal',
		})

		this.spans.set(span.spanId, span)
		this.activeSpans.set(span.spanId, span)

		return span
	}

	/**
	 * Finish a span
	 */
	finishSpan(span: Span): void {
		if (span instanceof AuditSpan) {
			span.finish()
		} else {
			// For generic Span interface, set end time manually
			span.endTime = Date.now()
			span.duration = span.endTime - span.startTime
		}
		this.activeSpans.delete(span.spanId)

		// Export span based on configuration
		this.exportSpan(span)
	}

	/**
	 * Inject trace context into headers
	 */
	injectContext(span: Span): TraceContext {
		return {
			traceId: span.traceId,
			spanId: span.spanId,
			parentSpanId: span.parentSpanId,
		}
	}

	/**
	 * Extract trace context from headers
	 */
	extractContext(headers: Record<string, string>): TraceContext | null {
		const traceId = headers['x-trace-id'] || headers['traceid']
		const spanId = headers['x-span-id'] || headers['spanid']
		const parentSpanId = headers['x-parent-span-id'] || headers['parentspanid']

		if (!traceId || !spanId) {
			return null
		}

		return {
			traceId,
			spanId,
			parentSpanId,
		}
	}

	/**
	 * Create a child span
	 */
	createChildSpan(parentSpan: Span, operationName: string): Span {
		const childSpan = new AuditSpan(operationName, parentSpan.traceId, parentSpan.spanId)

		// Inherit parent tags
		childSpan.setTags({
			...parentSpan.tags,
			'parent.operation': parentSpan.operationName,
		})

		this.spans.set(childSpan.spanId, childSpan)
		this.activeSpans.set(childSpan.spanId, childSpan)

		return childSpan
	}

	/**
	 * Get all spans for a trace
	 */
	getTraceSpans(traceId: string): Span[] {
		return Array.from(this.spans.values()).filter((span) => span.traceId === traceId)
	}

	/**
	 * Get active spans
	 */
	getActiveSpans(): Span[] {
		return Array.from(this.activeSpans.values())
	}

	/**
	 * Export span to configured exporter
	 */
	private exportSpan(span: Span): void {
		if (!this.config.enabled) {
			return
		}

		// Sample based on configuration
		if (Math.random() > this.config.sampleRate) {
			return
		}

		switch (this.config.exporterType) {
			case 'console':
				this.exportToConsole(span)
				break
			case 'jaeger':
				this.exportToJaeger(span)
				break
			case 'zipkin':
				this.exportToZipkin(span)
				break
			case 'otlp':
				this.exportToOTLP(span)
				break
			default:
				this.exportToConsole(span)
		}
	}

	/**
	 * Export span to console
	 */
	private exportToConsole(span: Span): void {
		console.log('🔍 Trace Span:', {
			traceId: span.traceId,
			spanId: span.spanId,
			parentSpanId: span.parentSpanId,
			operationName: span.operationName,
			duration: span.duration,
			status: span.status,
			tags: span.tags,
			logs: span.logs,
		})
	}

	/**
	 * Export span to Jaeger (placeholder implementation)
	 */
	private exportToJaeger(span: Span): void {
		// TODO: In a real implementation, this would send to Jaeger
		console.log('📊 Jaeger Export:', {
			traceID: span.traceId,
			spanID: span.spanId,
			operationName: span.operationName,
			startTime: span.startTime * 1000, // Jaeger expects microseconds
			duration: (span.duration || 0) * 1000,
			tags: Object.entries(span.tags).map(([key, value]) => ({
				key,
				type: typeof value === 'string' ? 'string' : 'number',
				value: String(value),
			})),
			logs: span.logs.map((log) => ({
				timestamp: log.timestamp * 1000,
				fields: [
					{ key: 'level', value: log.level },
					{ key: 'message', value: log.message },
					...(log.fields
						? Object.entries(log.fields).map(([k, v]) => ({ key: k, value: String(v) }))
						: []),
				],
			})),
		})
	}

	/**
	 * Export span to Zipkin (placeholder implementation)
	 */
	private exportToZipkin(span: Span): void {
		// TODO: In a real implementation, this would send to Zipkin
		console.log('📈 Zipkin Export:', {
			traceId: span.traceId,
			id: span.spanId,
			parentId: span.parentSpanId,
			name: span.operationName,
			timestamp: span.startTime * 1000,
			duration: (span.duration || 0) * 1000,
			kind: 'SERVER',
			tags: span.tags,
			annotations: span.logs.map((log) => ({
				timestamp: log.timestamp * 1000,
				value: `${log.level}: ${log.message}`,
			})),
		})
	}

	/**
	 * Export span to OTLP HTTP endpoint
	 */
	private exportToOTLP(span: Span): void {
		if (!this.config.exporterEndpoint) {
			console.warn('OTLP exporter endpoint not configured, falling back to console')
			this.exportToConsole(span)
			return
		}

		// Add to batch for efficient processing
		this.addToBatch(span)
	}

	// Batch processing for OTLP exports
	private spanBatch: Span[] = []
	private batchTimeout: NodeJS.Timeout | null = null
	private readonly BATCH_SIZE = 100
	private readonly BATCH_TIMEOUT_MS = 5000

	/**
	 * Add span to batch for efficient OTLP export
	 */
	private addToBatch(span: Span): void {
		this.spanBatch.push(span)

		// Send batch if it reaches max size
		if (this.spanBatch.length >= this.BATCH_SIZE) {
			this.flushBatch()
		} else if (!this.batchTimeout) {
			// Set timeout to flush batch
			this.batchTimeout = setTimeout(() => this.flushBatch(), this.BATCH_TIMEOUT_MS)
		}
	}

	/**
	 * Flush current batch to OTLP endpoint
	 */
	private async flushBatch(): Promise<void> {
		if (this.spanBatch.length === 0) return

		const spans = [...this.spanBatch]
		this.spanBatch = []

		if (this.batchTimeout) {
			clearTimeout(this.batchTimeout)
			this.batchTimeout = null
		}

		try {
			await this.sendSpansToOTLP(spans)
		} catch (error) {
			console.error('Failed to export spans to OTLP:', error)
			// Could implement retry logic here
		}
	}

	/**
	 * Send spans to OTLP HTTP endpoint
	 */
	private async sendSpansToOTLP(spans: Span[]): Promise<void> {
		if (!this.config.exporterEndpoint) {
			throw new Error('OTLP exporter endpoint not configured')
		}

		const otlpPayload = this.createOTLPPayload(spans)

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'User-Agent': `audit-system-tracer/1.0.0`,
			...this.getAuthHeaders(),
			...this.config.headers,
		}

		let body = JSON.stringify(otlpPayload)

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
					console.debug(`Successfully exported ${spans.length} spans to OTLP`)
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
	 * Create OTLP compliant payload
	 */
	private createOTLPPayload(spans: Span[]): any {
		return {
			resourceSpans: [
				{
					resource: {
						attributes: [
							{
								key: 'service.name',
								value: { stringValue: this.config.serviceName },
							},
							{
								key: 'service.version',
								value: { stringValue: process.env.npm_package_version || '1.0.0' },
							},
							{
								key: 'telemetry.sdk.name',
								value: { stringValue: 'audit-system-tracer' },
							},
							{
								key: 'telemetry.sdk.version',
								value: { stringValue: '1.0.0' },
							},
						],
					},
					scopeSpans: [
						{
							scope: {
								name: 'audit-system',
								version: '1.0.0',
							},
							spans: spans.map((span) => ({
								traceId: this.hexToBase64(span.traceId),
								spanId: this.hexToBase64(span.spanId),
								parentSpanId: span.parentSpanId ? this.hexToBase64(span.parentSpanId) : undefined,
								name: span.operationName,
								kind: this.getSpanKind(span.tags['span.kind']),
								startTimeUnixNano: this.timestampToNanos(span.startTime),
								endTimeUnixNano: this.timestampToNanos(span.endTime || span.startTime),
								attributes: this.convertAttributes(span.tags),
								events: span.logs.map((log) => ({
									timeUnixNano: this.timestampToNanos(log.timestamp),
									name: log.message,
									attributes: log.fields ? this.convertAttributes(log.fields) : [],
								})),
								status: {
									code: this.getStatusCode(span.status.code),
									message: span.status.message || '',
								},
							})),
						},
					],
				},
			],
		}
	}

	/**
	 * Get authentication headers based on configuration
	 */
	private getAuthHeaders(): Record<string, string> {
		const headers: Record<string, string> = {}

		// Support different authentication methods
		if (process.env.OTLP_API_KEY) {
			headers['Authorization'] = `Bearer ${process.env.OTLP_API_KEY}`
		} else if (process.env.OTLP_AUTH_HEADER) {
			const [key, value] = process.env.OTLP_AUTH_HEADER.split(':')
			if (key && value) {
				headers[key.trim()] = value.trim()
			}
		}

		return headers
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

	/**
	 * Convert hex string to base64 for OTLP
	 */
	private hexToBase64(hex: string): string {
		return Buffer.from(hex, 'hex').toString('base64')
	}

	/**
	 * Convert timestamp to nanoseconds
	 */
	private timestampToNanos(timestamp: number): string {
		return (timestamp * 1000000).toString()
	}

	/**
	 * Get OTLP span kind
	 */
	private getSpanKind(kind?: string): number {
		switch (kind) {
			case 'server':
				return 2
			case 'client':
				return 3
			case 'producer':
				return 4
			case 'consumer':
				return 5
			case 'internal':
			default:
				return 1
		}
	}

	/**
	 * Get OTLP status code
	 */
	private getStatusCode(status: string): number {
		switch (status) {
			case 'OK':
				return 1
			case 'ERROR':
				return 2
			case 'TIMEOUT':
				return 2
			case 'CANCELLED':
				return 2
			default:
				return 0 // UNSET
		}
	}

	/**
	 * Convert tags/fields to OTLP attributes
	 */
	private convertAttributes(obj: Record<string, any>): Array<{ key: string; value: any }> {
		return Object.entries(obj).map(([key, value]) => {
			let otlpValue: any

			if (typeof value === 'string') {
				otlpValue = { stringValue: value }
			} else if (typeof value === 'number') {
				if (Number.isInteger(value)) {
					otlpValue = { intValue: value.toString() }
				} else {
					otlpValue = { doubleValue: value }
				}
			} else if (typeof value === 'boolean') {
				otlpValue = { boolValue: value }
			} else if (Array.isArray(value)) {
				otlpValue = { arrayValue: { values: value.map((v) => ({ stringValue: String(v) })) } }
			} else {
				otlpValue = { stringValue: JSON.stringify(value) }
			}

			return { key, value: otlpValue }
		})
	}

	/**
	 * Clear old spans to prevent memory leaks and flush any pending batches
	 */
	cleanup(): void {
		const cutoffTime = Date.now() - 24 * 60 * 60 * 1000 // 24 hours

		for (const [spanId, span] of this.spans.entries()) {
			if (span.startTime < cutoffTime) {
				this.spans.delete(spanId)
			}
		}

		// Flush any pending batches
		if (this.spanBatch.length > 0) {
			this.flushBatch()
		}
	}
}

/**
 * Trace decorator for automatic span creation
 */
export function trace(operationName?: string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value
		const spanName = operationName || `${target.constructor.name}.${propertyKey}`

		descriptor.value = async function (...args: any[]) {
			// Get tracer from context or create a new one
			const tracer =
				(this as any).tracer ||
				new AuditTracer({
					enabled: true,
					serviceName: 'audit-system',
					sampleRate: 1.0,
					exporterType: 'console',
				})

			const span = tracer.startSpan(spanName)

			try {
				span.setTags({
					'method.name': propertyKey,
					'class.name': target.constructor.name,
					'args.count': args.length,
				})

				const result = await originalMethod.apply(this, args)

				span.setStatus('OK')
				return result
			} catch (error) {
				span.setStatus('ERROR', error instanceof Error ? error.message : String(error))
				span.log('error', 'Method execution failed', {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				})
				throw error
			} finally {
				tracer.finishSpan(span)
			}
		}

		return descriptor
	}
}
