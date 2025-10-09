import { randomUUID } from 'node:crypto'

/**
 * Configuration for ID generation
 */
export interface IdGeneratorConfig {
	/** Prefix for correlation IDs */
	correlationIdPrefix?: string
	/** Prefix for request IDs */
	requestIdPrefix?: string
	/** Prefix for trace IDs */
	traceIdPrefix?: string
	/** Use short format for IDs (8 characters instead of full UUID) */
	useShortFormat?: boolean
}

/**
 * Trace context for distributed tracing integration
 */
export interface TraceContext {
	traceId: string
	spanId: string
	parentSpanId?: string
	traceFlags?: number
	baggage?: Record<string, string>
}

/**
 * Enhanced ID generator with crypto.randomUUID for collision-resistant IDs
 * Implements requirement 3.3: Collision-resistant correlation IDs
 * Implements requirement 6.1: Correlation ID tracking
 */
export class IdGenerator {
	private readonly config: IdGeneratorConfig

	constructor(config: IdGeneratorConfig = {}) {
		this.config = {
			correlationIdPrefix: config.correlationIdPrefix ?? 'corr',
			requestIdPrefix: config.requestIdPrefix ?? 'req',
			traceIdPrefix: config.traceIdPrefix ?? 'trace',
			useShortFormat: config.useShortFormat ?? false,
		}
	}

	/**
	 * Generate a collision-resistant correlation ID using crypto.randomUUID
	 * Replaces Math.random() with cryptographically secure method
	 */
	generateCorrelationId(): string {
		const uuid = randomUUID()
		const id = this.config.useShortFormat ? this.shortenUuid(uuid) : uuid
		return this.config.correlationIdPrefix && this.config.correlationIdPrefix.length > 0
			? `${this.config.correlationIdPrefix}_${id}`
			: id
	}

	/**
	 * Generate a request ID for request lifecycle tracking
	 */
	generateRequestId(): string {
		const uuid = randomUUID()
		const id = this.config.useShortFormat ? this.shortenUuid(uuid) : uuid
		return this.config.requestIdPrefix && this.config.requestIdPrefix.length > 0
			? `${this.config.requestIdPrefix}_${id}`
			: id
	}

	/**
	 * Generate a trace ID for distributed tracing
	 * Compatible with OpenTelemetry trace ID format (32 hex characters)
	 */
	generateTraceId(): string {
		// Generate two UUIDs and combine them to create a 32-character hex string
		const uuid1 = randomUUID().replace(/-/g, '')
		const uuid2 = randomUUID().replace(/-/g, '')
		const traceId = (uuid1 + uuid2).substring(0, 32)
		return this.config.traceIdPrefix && this.config.traceIdPrefix.length > 0
			? `${this.config.traceIdPrefix}_${traceId}`
			: traceId
	}

	/**
	 * Generate a span ID for distributed tracing
	 * Compatible with OpenTelemetry span ID format (16 hex characters)
	 */
	generateSpanId(): string {
		const uuid = randomUUID().replace(/-/g, '')
		return uuid.substring(0, 16)
	}

	/**
	 * Generate a complete trace context for distributed tracing
	 */
	generateTraceContext(parentSpanId?: string): TraceContext {
		return {
			traceId: this.generateTraceId(),
			spanId: this.generateSpanId(),
			parentSpanId,
			traceFlags: 1, // Sampled flag
		}
	}

	/**
	 * Parse trace context from W3C Trace Context header format
	 * Format: "00-{traceId}-{spanId}-{flags}"
	 */
	parseTraceContext(traceParent: string): TraceContext | null {
		const parts = traceParent.split('-')
		if (parts.length !== 4 || parts[0] !== '00') {
			return null
		}

		const [, traceId, spanId, flags] = parts
		if (traceId.length !== 32 || spanId.length !== 16) {
			return null
		}

		return {
			traceId,
			spanId: this.generateSpanId(), // Generate new span ID for this operation
			parentSpanId: spanId, // Parent is the span from the header
			traceFlags: parseInt(flags, 16),
		}
	}

	/**
	 * Format trace context as W3C Trace Context header
	 */
	formatTraceContext(context: TraceContext): string {
		const flags = (context.traceFlags || 0).toString(16).padStart(2, '0')
		return `00-${context.traceId}-${context.spanId}-${flags}`
	}

	/**
	 * Generate a session ID for user session tracking
	 */
	generateSessionId(): string {
		const uuid = randomUUID()
		const id = this.config.useShortFormat ? this.shortenUuid(uuid) : uuid
		return `sess_${id}`
	}

	/**
	 * Generate a transaction ID for database or external service operations
	 */
	generateTransactionId(): string {
		const uuid = randomUUID()
		const id = this.config.useShortFormat ? this.shortenUuid(uuid) : uuid
		return `txn_${id}`
	}

	/**
	 * Generate a batch ID for grouping related operations
	 */
	generateBatchId(): string {
		const uuid = randomUUID()
		const id = this.config.useShortFormat ? this.shortenUuid(uuid) : uuid
		return `batch_${id}`
	}

	/**
	 * Validate if a string is a valid UUID format
	 */
	isValidUuid(id: string): boolean {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		return uuidRegex.test(id)
	}

	/**
	 * Validate if a string is a valid trace ID (32 hex characters)
	 */
	isValidTraceId(traceId: string): boolean {
		const traceIdRegex = /^[0-9a-f]{32}$/i
		return traceIdRegex.test(traceId.replace(/^trace_/, ''))
	}

	/**
	 * Validate if a string is a valid span ID (16 hex characters)
	 */
	isValidSpanId(spanId: string): boolean {
		const spanIdRegex = /^[0-9a-f]{16}$/i
		return spanIdRegex.test(spanId)
	}

	/**
	 * Extract correlation ID from a prefixed ID
	 */
	extractCorrelationId(prefixedId: string): string {
		if (
			this.config.correlationIdPrefix &&
			this.config.correlationIdPrefix.length > 0 &&
			prefixedId.startsWith(`${this.config.correlationIdPrefix}_`)
		) {
			return prefixedId.substring(this.config.correlationIdPrefix.length + 1)
		}
		return prefixedId
	}

	/**
	 * Extract request ID from a prefixed ID
	 */
	extractRequestId(prefixedId: string): string {
		if (
			this.config.requestIdPrefix &&
			this.config.requestIdPrefix.length > 0 &&
			prefixedId.startsWith(`${this.config.requestIdPrefix}_`)
		) {
			return prefixedId.substring(this.config.requestIdPrefix.length + 1)
		}
		return prefixedId
	}

	/**
	 * Create a child trace context from a parent context
	 */
	createChildTraceContext(parentContext: TraceContext): TraceContext {
		return {
			traceId: parentContext.traceId, // Keep same trace ID
			spanId: this.generateSpanId(), // Generate new span ID
			parentSpanId: parentContext.spanId, // Parent is the current span
			traceFlags: parentContext.traceFlags,
			baggage: parentContext.baggage,
		}
	}

	/**
	 * Generate multiple related IDs for a complete request context
	 */
	generateRequestContext(traceParent?: string): {
		correlationId: string
		requestId: string
		traceContext: TraceContext
		sessionId?: string
	} {
		let traceContext: TraceContext

		if (traceParent) {
			const parsed = this.parseTraceContext(traceParent)
			traceContext = parsed || this.generateTraceContext()
		} else {
			traceContext = this.generateTraceContext()
		}

		return {
			correlationId: this.generateCorrelationId(),
			requestId: this.generateRequestId(),
			traceContext,
		}
	}

	/**
	 * Shorten a UUID to 8 characters for more compact IDs
	 */
	private shortenUuid(uuid: string): string {
		return uuid.replace(/-/g, '').substring(0, 8)
	}

	/**
	 * Get current configuration
	 */
	getConfig(): IdGeneratorConfig {
		return { ...this.config }
	}
}
