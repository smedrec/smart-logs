import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

import type { Span } from '@opentelemetry/api'
import type {
	DeliveryObservabilityConfig,
	DeliveryOperation,
	DeliverySpanAttributes,
	DeliverySpanEvent,
} from './types.js'

/**
 * OpenTelemetry tracing integration for delivery service
 * Requirements 8.1, 8.4: Distributed tracing for complete delivery workflows
 */

/**
 * Delivery span context for correlation
 */
export interface DeliverySpanContext {
	traceId: string
	spanId: string
	parentSpanId?: string
	baggage?: Record<string, string>
}

/**
 * Enhanced delivery span interface
 */
export interface DeliverySpan {
	// Core span methods
	spanContext(): any
	setAttribute(key: string, value: any): this
	setAttributes(attributes: Record<string, any>): this
	addEvent(name: string, attributesOrStartTime?: any, startTime?: any): this
	setStatus(status: any): this
	updateName(name: string): this
	end(endTime?: any): void
	isRecording(): boolean
	recordException(exception: any, time?: any): void
	addLink(link: any): this
	addLinks(links: any[]): this

	// Delivery-specific methods
	setDeliveryAttributes(attributes: Partial<DeliverySpanAttributes>): void
	addDeliveryEvent(event: DeliverySpanEvent): void
	setDeliveryStatus(success: boolean, message?: string): void
}

/**
 * Delivery tracer interface
 */
export interface IDeliveryTracer {
	startSpan(
		operation: DeliveryOperation,
		attributes?: Partial<DeliverySpanAttributes>
	): DeliverySpan
	startChildSpan(
		parentSpan: DeliverySpan,
		operation: DeliveryOperation,
		attributes?: Partial<DeliverySpanAttributes>
	): DeliverySpan
	createSpanContext(span: DeliverySpan): DeliverySpanContext
	extractSpanContext(headers: Record<string, string>): DeliverySpanContext | null
	injectSpanContext(span: DeliverySpan, headers: Record<string, string>): void
	withSpan<T>(span: DeliverySpan, fn: () => T | Promise<T>): Promise<T>
	initialize(): Promise<void>
	shutdown(): Promise<void>
}

/**
 * Enhanced delivery span implementation
 */
class DeliverySpanImpl implements DeliverySpan {
	constructor(private readonly span: Span) {}

	// Delegate all Span methods to the underlying span
	spanContext() {
		return this.span.spanContext()
	}
	setAttribute(key: string, value: any) {
		this.span.setAttribute(key, value)
		return this
	}
	setAttributes(attributes: Record<string, any>) {
		this.span.setAttributes(attributes)
		return this
	}
	addEvent(name: string, attributesOrStartTime?: any, startTime?: any) {
		this.span.addEvent(name, attributesOrStartTime, startTime)
		return this
	}
	setStatus(status: any) {
		this.span.setStatus(status)
		return this
	}
	updateName(name: string) {
		this.span.updateName(name)
		return this
	}
	end(endTime?: any) {
		return this.span.end(endTime)
	}
	isRecording() {
		return this.span.isRecording()
	}
	recordException(exception: any, time?: any) {
		return this.span.recordException(exception, time)
	}
	addLink(link: any) {
		this.span.addLink(link)
		return this
	}
	addLinks(links: any[]) {
		this.span.addLinks(links)
		return this
	}

	/**
	 * Set delivery-specific attributes with proper typing
	 */
	setDeliveryAttributes(attributes: Partial<DeliverySpanAttributes>): void {
		const sanitizedAttributes: Record<string, any> = {}

		for (const [key, value] of Object.entries(attributes)) {
			if (value !== undefined && value !== null) {
				// Convert complex objects to strings
				if (typeof value === 'object') {
					sanitizedAttributes[key] = JSON.stringify(value)
				} else {
					sanitizedAttributes[key] = value
				}
			}
		}

		this.span.setAttributes(sanitizedAttributes)
	}

	/**
	 * Add delivery-specific events
	 */
	addDeliveryEvent(event: DeliverySpanEvent): void {
		this.span.addEvent(event.name, event.attributes, event.timestamp)
	}

	/**
	 * Set delivery operation status
	 */
	setDeliveryStatus(success: boolean, message?: string): void {
		this.span.setStatus({
			code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
			message: message || (success ? 'Operation completed successfully' : 'Operation failed'),
		})
	}
}

/**
 * OpenTelemetry delivery tracer implementation
 */
export class DeliveryTracer implements IDeliveryTracer {
	private sdk?: NodeSDK
	private tracer = trace.getTracer('delivery-service', '1.0.0')
	private config: DeliveryObservabilityConfig['tracing']
	private initialized = false

	constructor(config: DeliveryObservabilityConfig['tracing']) {
		this.config = config
	}

	/**
	 * Initialize OpenTelemetry SDK
	 */
	async initialize(): Promise<void> {
		if (this.initialized || !this.config.enabled) {
			return
		}

		try {
			// Create resource with service information
			const resource = resourceFromAttributes({
				[SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
				[SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
				[SemanticResourceAttributes.SERVICE_NAMESPACE]: 'audit-system',
			})

			// Configure trace exporter based on type
			const traceExporter = this.createTraceExporter()

			// Initialize SDK
			this.sdk = new NodeSDK({
				resource,
				traceExporter,
				instrumentations: [
					getNodeAutoInstrumentations({
						// Disable some instrumentations that might be noisy
						'@opentelemetry/instrumentation-fs': {
							enabled: false,
						},
						'@opentelemetry/instrumentation-dns': {
							enabled: false,
						},
					}),
				],
			})

			await this.sdk.start()

			// Get the initialized tracer
			this.tracer = trace.getTracer(this.config.serviceName, '1.0.0')

			this.initialized = true
			console.log(
				`✅ Delivery service tracing initialized with ${this.config.exporterType} exporter`
			)
		} catch (error) {
			console.error('❌ Failed to initialize delivery service tracing:', error)
			throw error
		}
	}

	/**
	 * Shutdown OpenTelemetry SDK
	 */
	async shutdown(): Promise<void> {
		if (this.sdk && this.initialized) {
			try {
				await this.sdk.shutdown()
				this.initialized = false
				console.log('✅ Delivery service tracing shutdown completed')
			} catch (error) {
				console.error('❌ Error during tracing shutdown:', error)
			}
		}
	}

	/**
	 * Start a new delivery span
	 */
	startSpan(
		operation: DeliveryOperation,
		attributes?: Partial<DeliverySpanAttributes>
	): DeliverySpan {
		if (!this.config.enabled) {
			// Return a no-op span if tracing is disabled
			return new DeliverySpanImpl(trace.getActiveSpan() || this.tracer.startSpan('noop'))
		}

		// Apply sampling
		if (Math.random() > this.config.sampleRate) {
			return new DeliverySpanImpl(trace.getActiveSpan() || this.tracer.startSpan('noop'))
		}

		const span = this.tracer.startSpan(operation, {
			kind: this.getSpanKind(operation),
			attributes: {
				'service.name': this.config.serviceName,
				'service.version': process.env.npm_package_version || '1.0.0',
				'operation.name': operation,
				...this.sanitizeAttributes(attributes || {}),
			},
		})

		const deliverySpan = new DeliverySpanImpl(span)

		// Add default delivery attributes
		if (attributes) {
			deliverySpan.setDeliveryAttributes(attributes)
		}

		return deliverySpan
	}

	/**
	 * Start a child span
	 */
	startChildSpan(
		parentSpan: DeliverySpan,
		operation: DeliveryOperation,
		attributes?: Partial<DeliverySpanAttributes>
	): DeliverySpan {
		if (!this.config.enabled) {
			return new DeliverySpanImpl(trace.getActiveSpan() || this.tracer.startSpan('noop'))
		}

		return context.with(trace.setSpan(context.active(), parentSpan), () => {
			return this.startSpan(operation, attributes)
		})
	}

	/**
	 * Create span context for correlation
	 */
	createSpanContext(span: DeliverySpan): DeliverySpanContext {
		const spanContext = span.spanContext()
		return {
			traceId: spanContext.traceId,
			spanId: spanContext.spanId,
		}
	}

	/**
	 * Extract span context from headers
	 */
	extractSpanContext(headers: Record<string, string>): DeliverySpanContext | null {
		const traceId = headers['x-trace-id'] || headers['traceparent']?.split('-')[1]
		const spanId = headers['x-span-id'] || headers['traceparent']?.split('-')[2]

		if (!traceId || !spanId) {
			return null
		}

		return {
			traceId,
			spanId,
			parentSpanId: headers['x-parent-span-id'],
		}
	}

	/**
	 * Inject span context into headers
	 */
	injectSpanContext(span: DeliverySpan, headers: Record<string, string>): void {
		const spanContext = span.spanContext()
		headers['x-trace-id'] = spanContext.traceId
		headers['x-span-id'] = spanContext.spanId

		// Also add W3C trace context
		headers['traceparent'] = `00-${spanContext.traceId}-${spanContext.spanId}-01`
	}

	/**
	 * Execute function within span context
	 */
	async withSpan<T>(span: DeliverySpan, fn: () => T | Promise<T>): Promise<T> {
		return context.with(trace.setSpan(context.active(), span), async () => {
			try {
				const result = await fn()
				span.setDeliveryStatus(true)
				return result
			} catch (error) {
				span.setDeliveryStatus(false, error instanceof Error ? error.message : 'Unknown error')
				span.recordException(error instanceof Error ? error : new Error(String(error)))
				throw error
			} finally {
				span.end()
			}
		})
	}

	/**
	 * Create trace exporter based on configuration
	 */
	private createTraceExporter() {
		switch (this.config.exporterType) {
			case 'otlp':
				return new OTLPTraceExporter({
					url: this.config.exporterEndpoint || 'http://localhost:4318/v1/traces',
					headers: this.config.headers || {},
				})

			case 'jaeger':
				return new JaegerExporter({
					endpoint: this.config.exporterEndpoint || 'http://localhost:14268/api/traces',
				})

			case 'console':
			default:
				// Console exporter is built into the SDK
				return undefined
		}
	}

	/**
	 * Get appropriate span kind for operation
	 */
	private getSpanKind(operation: DeliveryOperation): SpanKind {
		if (operation.includes('handler.')) {
			return SpanKind.CLIENT // External calls
		} else if (operation.includes('queue.')) {
			return SpanKind.PRODUCER // Queue operations
		} else if (operation.includes('delivery.process')) {
			return SpanKind.CONSUMER // Processing operations
		} else {
			return SpanKind.INTERNAL // Internal operations
		}
	}

	/**
	 * Sanitize attributes for OpenTelemetry
	 */
	private sanitizeAttributes(attributes: Record<string, any>): Record<string, any> {
		const sanitized: Record<string, any> = {}

		for (const [key, value] of Object.entries(attributes)) {
			if (value !== undefined && value !== null) {
				// OpenTelemetry supports string, number, boolean, and arrays of these
				if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
					sanitized[key] = value
				} else if (Array.isArray(value)) {
					sanitized[key] = value.map((v) => String(v))
				} else {
					sanitized[key] = JSON.stringify(value)
				}
			}
		}

		return sanitized
	}
}

/**
 * Trace decorator for automatic span creation around delivery methods
 */
export function traceDeliveryOperation(operation: DeliveryOperation) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value

		descriptor.value = async function (...args: any[]) {
			// Get tracer from context or create a new one
			const tracer: IDeliveryTracer =
				(this as any).tracer ||
				new DeliveryTracer({
					enabled: true,
					serviceName: 'delivery-service',
					sampleRate: 1.0,
					exporterType: 'console',
				})

			const span = tracer.startSpan(operation, {
				'service.name': 'delivery-service',
				'handler.method': propertyKey,
			})

			return tracer.withSpan(span, async () => {
				// Add method-specific attributes
				span.setDeliveryAttributes({
					'handler.method': propertyKey,
				})

				return originalMethod.apply(this, args)
			})
		}

		return descriptor
	}
}

/**
 * Factory function for creating delivery tracer
 */
export function createDeliveryTracer(
	config: DeliveryObservabilityConfig['tracing']
): IDeliveryTracer {
	return new DeliveryTracer(config)
}
