/**
 * Types for delivery service observability
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: OpenTelemetry observability types
 */

/**
 * Delivery observability configuration
 */
export interface DeliveryObservabilityConfig {
	tracing: {
		enabled: boolean
		serviceName: string
		sampleRate: number
		exporterType: 'console' | 'jaeger' | 'zipkin' | 'otlp'
		exporterEndpoint?: string
		headers?: Record<string, string>
	}
	metrics: {
		enabled: boolean
		serviceName: string
		exporterType: 'console' | 'prometheus' | 'otlp'
		exporterEndpoint?: string
		collectionInterval: number
		headers?: Record<string, string>
	}
	performance: {
		enabled: boolean
		trackingEnabled: boolean
		slowOperationThreshold: number // milliseconds
		memoryTrackingEnabled: boolean
	}
}

/**
 * Delivery span attributes for consistent tagging
 */
export interface DeliverySpanAttributes {
	// Service identification
	'service.name': string
	'service.version': string

	// Delivery operation
	'delivery.id': string
	'delivery.organization_id': string
	'delivery.type': string
	'delivery.destination_count': number
	'delivery.priority'?: number
	'delivery.correlation_id'?: string
	'delivery.idempotency_key'?: string

	// Destination information
	'destination.id'?: string
	'destination.type'?: string
	'destination.label'?: string

	// Handler information
	'handler.type'?: string
	'handler.method'?: string

	// Queue information
	'queue.name'?: string
	'queue.depth'?: number
	'queue.wait_time'?: number

	// Retry information
	'retry.attempt'?: number
	'retry.max_attempts'?: number
	'retry.backoff_delay'?: number

	// Circuit breaker information
	'circuit_breaker.state'?: string
	'circuit_breaker.failure_count'?: number

	// Performance metrics
	'performance.payload_size'?: number
	'performance.processing_time'?: number
	'performance.response_time'?: number

	// Error information
	'error.type'?: string
	'error.message'?: string
	'error.retryable'?: boolean

	// HTTP specific (for webhooks)
	'http.method'?: string
	'http.url'?: string
	'http.status_code'?: number
	'http.response_size'?: number

	// Email specific
	'email.provider'?: string
	'email.recipient_count'?: number
	'email.attachment_count'?: number

	// Storage specific
	'storage.provider'?: string
	'storage.bucket'?: string
	'storage.path'?: string
	'storage.file_size'?: number

	// SFTP specific
	'sftp.host'?: string
	'sftp.path'?: string
	'sftp.file_size'?: number
}

/**
 * Delivery metrics data structure
 */
export interface DeliveryMetricsData {
	// Counters
	deliveries_total: number
	deliveries_successful: number
	deliveries_failed: number

	// Gauges
	queue_depth: number
	active_deliveries: number
	circuit_breakers_open: number

	// Histograms
	delivery_duration_ms: number[]
	payload_size_bytes: number[]
	retry_attempts: number[]

	// By destination type
	by_destination_type: Record<
		string,
		{
			total: number
			successful: number
			failed: number
			avg_duration_ms: number
		}
	>

	// By organization
	by_organization: Record<
		string,
		{
			total: number
			successful: number
			failed: number
		}
	>

	// Error rates
	error_rates: Record<string, number>

	// Performance percentiles
	performance_percentiles: {
		p50: number
		p90: number
		p95: number
		p99: number
	}
}

/**
 * Performance tracking data
 */
export interface PerformanceMetrics {
	operation: string
	startTime: number
	endTime?: number
	duration?: number
	memoryUsage?: {
		heapUsed: number
		heapTotal: number
		external: number
		rss: number
	}
	cpuUsage?: {
		user: number
		system: number
	}
	metadata?: Record<string, any>
}

/**
 * Delivery operation types for tracing
 */
export type DeliveryOperation =
	| 'delivery.create'
	| 'delivery.schedule'
	| 'delivery.process'
	| 'delivery.retry'
	| 'delivery.validate'
	| 'destination.create'
	| 'destination.update'
	| 'destination.delete'
	| 'destination.validate'
	| 'destination.test_connection'
	| 'handler.webhook.deliver'
	| 'handler.email.deliver'
	| 'handler.storage.deliver'
	| 'handler.sftp.deliver'
	| 'handler.download.deliver'
	| 'queue.enqueue'
	| 'queue.dequeue'
	| 'queue.process'
	| 'retry.calculate_backoff'
	| 'retry.schedule'
	| 'circuit_breaker.check'
	| 'circuit_breaker.record_success'
	| 'circuit_breaker.record_failure'
	| 'health.check'
	| 'health.update'
	| 'alert.check_thresholds'
	| 'alert.send'

/**
 * Span event types for delivery operations
 */
export interface DeliverySpanEvent {
	name: string
	timestamp: number
	attributes?: Record<string, any>
}

/**
 * Custom metric types for delivery service
 */
export interface DeliveryCustomMetrics {
	// Delivery success rate by destination type
	delivery_success_rate_by_type: Record<string, number>

	// Queue processing metrics
	queue_processing_rate: number
	queue_average_wait_time: number

	// Circuit breaker metrics
	circuit_breaker_trip_rate: number
	circuit_breaker_recovery_time: number

	// Retry metrics
	retry_success_rate: number
	retry_average_attempts: number

	// Destination health metrics
	destination_health_score: Record<string, number>
	destination_response_time_p95: Record<string, number>

	// Alert metrics
	alert_generation_rate: number
	alert_resolution_time: number
}
