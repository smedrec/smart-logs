import { AsyncLocalStorage } from 'node:async_hooks'

import { IdGenerator } from '../utils/id-generator.js'

import type { LogContext } from '../types/index.js'
import type { TraceContext } from '../utils/id-generator.js'

/**
 * CorrelationManager for managing correlation IDs and context across async operations
 * Supports requirement 6.1: correlation ID tracking
 * Supports requirement 3.3: Collision-resistant correlation IDs
 */
export class CorrelationManager {
	private static instance: CorrelationManager
	private readonly asyncStorage = new AsyncLocalStorage<LogContext>()
	private readonly idGenerator: IdGenerator

	private constructor() {
		this.idGenerator = new IdGenerator()
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): CorrelationManager {
		if (!CorrelationManager.instance) {
			CorrelationManager.instance = new CorrelationManager()
		}
		return CorrelationManager.instance
	}

	/**
	 * Generate a new correlation ID using crypto.randomUUID for collision resistance
	 */
	generateCorrelationId(): string {
		return this.idGenerator.generateCorrelationId()
	}

	/**
	 * Generate a new request ID
	 */
	generateRequestId(): string {
		return this.idGenerator.generateRequestId()
	}

	/**
	 * Generate trace context for distributed tracing
	 */
	generateTraceContext(parentSpanId?: string): TraceContext {
		return this.idGenerator.generateTraceContext(parentSpanId)
	}

	/**
	 * Parse trace context from W3C Trace Context header
	 */
	parseTraceContext(traceParent: string): TraceContext | null {
		return this.idGenerator.parseTraceContext(traceParent)
	}

	/**
	 * Create child trace context from parent
	 */
	createChildTraceContext(parentContext: TraceContext): TraceContext {
		return this.idGenerator.createChildTraceContext(parentContext)
	}

	/**
	 * Run a function with correlation context
	 */
	runWithContext<T>(context: LogContext, fn: () => T): T {
		return this.asyncStorage.run(context, fn)
	}

	/**
	 * Get current correlation context
	 */
	getContext(): LogContext | undefined {
		return this.asyncStorage.getStore()
	}

	/**
	 * Get current correlation ID or generate a new one
	 */
	getCorrelationId(): string {
		const context = this.getContext()
		return context?.correlationId || this.generateCorrelationId()
	}

	/**
	 * Get current request ID if available
	 */
	getRequestId(): string | undefined {
		const context = this.getContext()
		return context?.requestId
	}

	/**
	 * Set correlation ID in current context
	 */
	setCorrelationId(correlationId: string): void {
		const context = this.getContext()
		if (context) {
			context.correlationId = correlationId
		}
	}

	/**
	 * Set request ID in current context
	 */
	setRequestId(requestId: string): void {
		const context = this.getContext()
		if (context) {
			context.requestId = requestId
		}
	}

	/**
	 * Set trace context in current context
	 */
	setTraceContext(traceContext: TraceContext): void {
		const context = this.getContext()
		if (context) {
			context.traceId = traceContext.traceId
			context.spanId = traceContext.spanId
		}
	}

	/**
	 * Get current trace ID
	 */
	getTraceId(): string | undefined {
		const context = this.getContext()
		return context?.traceId
	}

	/**
	 * Get current span ID
	 */
	getSpanId(): string | undefined {
		const context = this.getContext()
		return context?.spanId
	}

	/**
	 * Generate complete request context with correlation, request, and trace IDs
	 */
	generateRequestContext(traceParent?: string): LogContext {
		const requestContext = this.idGenerator.generateRequestContext(traceParent)

		return {
			correlationId: requestContext.correlationId,
			requestId: requestContext.requestId,
			traceId: requestContext.traceContext.traceId,
			spanId: requestContext.traceContext.spanId,
		}
	}

	/**
	 * Run function with complete request context
	 */
	runWithRequestContext<T>(traceParent: string | undefined, fn: () => T): T {
		const context = this.generateRequestContext(traceParent)
		return this.runWithContext(context, fn)
	}
}
