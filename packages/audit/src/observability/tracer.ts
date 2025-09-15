/**
 * Distributed tracing implementation for audit event lifecycle tracking
 */
import { randomBytes } from 'crypto'

import type { ObservabilityConfig, Span, SpanLog, SpanStatus, TraceContext } from './types.js'

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
	 * Export span to OTLP (placeholder implementation)
	 */
	private exportToOTLP(span: Span): void {
		// TODO: In a real implementation, this would send to OTLP endpoint
		console.log('🚀 OTLP Export:', {
			resourceSpans: [
				{
					resource: {
						attributes: [
							{
								key: 'service.name',
								value: { stringValue: this.config.serviceName },
							},
						],
					},
					instrumentationLibrarySpans: [
						{
							spans: [
								{
									traceId: Buffer.from(span.traceId, 'hex'),
									spanId: Buffer.from(span.spanId, 'hex'),
									parentSpanId: span.parentSpanId
										? Buffer.from(span.parentSpanId, 'hex')
										: undefined,
									name: span.operationName,
									startTimeUnixNano: span.startTime * 1000000,
									endTimeUnixNano: (span.endTime || span.startTime) * 1000000,
									attributes: Object.entries(span.tags).map(([key, value]) => ({
										key,
										value: { stringValue: String(value) },
									})),
									events: span.logs.map((log) => ({
										timeUnixNano: log.timestamp * 1000000,
										name: log.message,
										attributes: log.fields
											? Object.entries(log.fields).map(([k, v]) => ({
													key: k,
													value: { stringValue: String(v) },
												}))
											: [],
									})),
									status: {
										code: span.status.code === 'OK' ? 1 : 2,
										message: span.status.message,
									},
								},
							],
						},
					],
				},
			],
		})
	}

	/**
	 * Clear old spans to prevent memory leaks
	 */
	cleanup(): void {
		const cutoffTime = Date.now() - 24 * 60 * 60 * 1000 // 24 hours

		for (const [spanId, span] of this.spans.entries()) {
			if (span.startTime < cutoffTime) {
				this.spans.delete(spanId)
			}
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
