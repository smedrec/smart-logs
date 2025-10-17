/**
 * OpenTelemetry metrics collection for delivery service
 * Requirements 8.2, 8.3, 8.5: Metrics collection for performance and reliability monitoring
 */

import { metrics, ValueType } from '@opentelemetry/api'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

import type {
	DeliveryCustomMetrics,
	DeliveryMetricsData,
	DeliveryObservabilityConfig,
} from './types.js'

/**
 * Delivery metrics collector interface
 */
export interface IDeliveryMetricsCollector {
	// Delivery metrics
	recordDeliveryAttempt(
		organizationId: string,
		destinationType: string,
		success: boolean,
		duration: number
	): void
	recordDeliveryPayloadSize(size: number): void
	recordQueueDepth(depth: number): void
	recordRetryAttempt(destinationId: string, attemptNumber: number, success: boolean): void

	// Circuit breaker metrics
	recordCircuitBreakerState(destinationId: string, state: 'open' | 'closed' | 'half-open'): void
	recordCircuitBreakerTrip(destinationId: string, reason: string): void

	// Destination health metrics
	recordDestinationHealth(
		destinationId: string,
		destinationType: string,
		healthy: boolean,
		responseTime: number
	): void
	recordDestinationFailure(destinationId: string, destinationType: string, errorType: string): void

	// Alert metrics
	recordAlertGenerated(organizationId: string, alertType: string, severity: string): void
	recordAlertResolved(organizationId: string, alertType: string, resolutionTime: number): void

	// Performance metrics
	recordProcessingTime(operation: string, duration: number): void
	recordMemoryUsage(heapUsed: number, heapTotal: number): void
	recordCpuUsage(usage: number): void

	// Custom metrics
	getMetricsSnapshot(): Promise<DeliveryMetricsData>
	getCustomMetrics(): Promise<DeliveryCustomMetrics>

	// Lifecycle
	initialize(): Promise<void>
	shutdown(): Promise<void>
}

/**
 * OpenTelemetry delivery metrics collector implementation
 */
export class DeliveryMetricsCollector implements IDeliveryMetricsCollector {
	private meterProvider?: MeterProvider
	private meter = metrics.getMeter('delivery-service', '1.0.0')
	private config: DeliveryObservabilityConfig['metrics']
	private initialized = false

	// Counters
	private deliveryAttemptsCounter = this.meter.createCounter('delivery_attempts_total', {
		description: 'Total number of delivery attempts',
		valueType: ValueType.INT,
	})

	private deliverySuccessCounter = this.meter.createCounter('delivery_success_total', {
		description: 'Total number of successful deliveries',
		valueType: ValueType.INT,
	})

	private deliveryFailureCounter = this.meter.createCounter('delivery_failures_total', {
		description: 'Total number of failed deliveries',
		valueType: ValueType.INT,
	})

	private retryAttemptsCounter = this.meter.createCounter('retry_attempts_total', {
		description: 'Total number of retry attempts',
		valueType: ValueType.INT,
	})

	private circuitBreakerTripsCounter = this.meter.createCounter('circuit_breaker_trips_total', {
		description: 'Total number of circuit breaker trips',
		valueType: ValueType.INT,
	})

	private alertsGeneratedCounter = this.meter.createCounter('alerts_generated_total', {
		description: 'Total number of alerts generated',
		valueType: ValueType.INT,
	})

	// Gauges
	private queueDepthGauge = this.meter.createUpDownCounter('queue_depth', {
		description: 'Current queue depth',
		valueType: ValueType.INT,
	})

	private activeDeliveriesGauge = this.meter.createUpDownCounter('active_deliveries', {
		description: 'Number of currently active deliveries',
		valueType: ValueType.INT,
	})

	private circuitBreakersOpenGauge = this.meter.createUpDownCounter('circuit_breakers_open', {
		description: 'Number of circuit breakers currently open',
		valueType: ValueType.INT,
	})

	private memoryUsageGauge = this.meter.createUpDownCounter('memory_usage_bytes', {
		description: 'Memory usage in bytes',
		valueType: ValueType.INT,
	})

	private cpuUsageGauge = this.meter.createUpDownCounter('cpu_usage_percent', {
		description: 'CPU usage percentage',
		valueType: ValueType.DOUBLE,
	})

	// Histograms
	private deliveryDurationHistogram = this.meter.createHistogram('delivery_duration_ms', {
		description: 'Delivery duration in milliseconds',
		valueType: ValueType.DOUBLE,
	})

	private payloadSizeHistogram = this.meter.createHistogram('payload_size_bytes', {
		description: 'Delivery payload size in bytes',
		valueType: ValueType.INT,
	})

	private responseTimeHistogram = this.meter.createHistogram('destination_response_time_ms', {
		description: 'Destination response time in milliseconds',
		valueType: ValueType.DOUBLE,
	})

	private processingTimeHistogram = this.meter.createHistogram('processing_time_ms', {
		description: 'Operation processing time in milliseconds',
		valueType: ValueType.DOUBLE,
	})

	// Internal state for metrics calculation
	private metricsState = {
		deliveriesByType: new Map<
			string,
			{ total: number; successful: number; failed: number; totalDuration: number }
		>(),
		deliveriesByOrg: new Map<string, { total: number; successful: number; failed: number }>(),
		errorsByType: new Map<string, number>(),
		lastMetricsSnapshot: Date.now(),
		performanceData: [] as number[],
	}

	constructor(config: DeliveryObservabilityConfig['metrics']) {
		this.config = config
	}

	/**
	 * Initialize OpenTelemetry metrics
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

			// Create metric exporter
			const metricExporter = this.createMetricExporter()

			// Create metric reader - only if we have an exporter
			const readers = []
			if (metricExporter) {
				const metricReader = new PeriodicExportingMetricReader({
					exporter: metricExporter,
					exportIntervalMillis: this.config.collectionInterval,
				})
				readers.push(metricReader)
			}

			// Create meter provider
			this.meterProvider = new MeterProvider({
				resource,
				readers,
			})

			// Set global meter provider
			metrics.setGlobalMeterProvider(this.meterProvider)

			// Get the initialized meter
			this.meter = metrics.getMeter(this.config.serviceName, '1.0.0')

			// Recreate instruments with the new meter
			this.recreateInstruments()

			this.initialized = true
			console.log(
				`✅ Delivery service metrics initialized with ${this.config.exporterType} exporter`
			)
		} catch (error) {
			console.error('❌ Failed to initialize delivery service metrics:', error)
			throw error
		}
	}

	/**
	 * Shutdown metrics collection
	 */
	async shutdown(): Promise<void> {
		if (this.meterProvider && this.initialized) {
			try {
				await this.meterProvider.shutdown()
				this.initialized = false
				console.log('✅ Delivery service metrics shutdown completed')
			} catch (error) {
				console.error('❌ Error during metrics shutdown:', error)
			}
		}
	}

	/**
	 * Record delivery attempt
	 */
	recordDeliveryAttempt(
		organizationId: string,
		destinationType: string,
		success: boolean,
		duration: number
	): void {
		if (!this.config.enabled) return

		// Update counters
		this.deliveryAttemptsCounter.add(1, {
			organization_id: organizationId,
			destination_type: destinationType,
		})

		if (success) {
			this.deliverySuccessCounter.add(1, {
				organization_id: organizationId,
				destination_type: destinationType,
			})
		} else {
			this.deliveryFailureCounter.add(1, {
				organization_id: organizationId,
				destination_type: destinationType,
			})
		}

		// Record duration
		this.deliveryDurationHistogram.record(duration, {
			organization_id: organizationId,
			destination_type: destinationType,
			success: success.toString(),
		})

		// Update internal state
		this.updateInternalMetrics(organizationId, destinationType, success, duration)
	}

	/**
	 * Record delivery payload size
	 */
	recordDeliveryPayloadSize(size: number): void {
		if (!this.config.enabled) return

		this.payloadSizeHistogram.record(size)
	}

	/**
	 * Record queue depth
	 */
	recordQueueDepth(depth: number): void {
		if (!this.config.enabled) return

		this.queueDepthGauge.add(depth - (this.queueDepthGauge as any)._lastValue || 0)
	}

	/**
	 * Record retry attempt
	 */
	recordRetryAttempt(destinationId: string, attemptNumber: number, success: boolean): void {
		if (!this.config.enabled) return

		this.retryAttemptsCounter.add(1, {
			destination_id: destinationId,
			attempt_number: attemptNumber.toString(),
			success: success.toString(),
		})
	}

	/**
	 * Record circuit breaker state
	 */
	recordCircuitBreakerState(destinationId: string, state: 'open' | 'closed' | 'half-open'): void {
		if (!this.config.enabled) return

		// This is a gauge that tracks the current state
		const stateValue = state === 'open' ? 1 : 0
		this.circuitBreakersOpenGauge.add(stateValue, {
			destination_id: destinationId,
			state,
		})
	}

	/**
	 * Record circuit breaker trip
	 */
	recordCircuitBreakerTrip(destinationId: string, reason: string): void {
		if (!this.config.enabled) return

		this.circuitBreakerTripsCounter.add(1, {
			destination_id: destinationId,
			reason,
		})
	}

	/**
	 * Record destination health
	 */
	recordDestinationHealth(
		destinationId: string,
		destinationType: string,
		healthy: boolean,
		responseTime: number
	): void {
		if (!this.config.enabled) return

		this.responseTimeHistogram.record(responseTime, {
			destination_id: destinationId,
			destination_type: destinationType,
			healthy: healthy.toString(),
		})
	}

	/**
	 * Record destination failure
	 */
	recordDestinationFailure(
		destinationId: string,
		destinationType: string,
		errorType: string
	): void {
		if (!this.config.enabled) return

		this.deliveryFailureCounter.add(1, {
			destination_id: destinationId,
			destination_type: destinationType,
			error_type: errorType,
		})

		// Update internal error tracking
		const key = `${destinationType}:${errorType}`
		this.metricsState.errorsByType.set(key, (this.metricsState.errorsByType.get(key) || 0) + 1)
	}

	/**
	 * Record alert generated
	 */
	recordAlertGenerated(organizationId: string, alertType: string, severity: string): void {
		if (!this.config.enabled) return

		this.alertsGeneratedCounter.add(1, {
			organization_id: organizationId,
			alert_type: alertType,
			severity,
		})
	}

	/**
	 * Record alert resolved
	 */
	recordAlertResolved(organizationId: string, alertType: string, resolutionTime: number): void {
		if (!this.config.enabled) return

		this.processingTimeHistogram.record(resolutionTime, {
			organization_id: organizationId,
			operation: 'alert_resolution',
			alert_type: alertType,
		})
	}

	/**
	 * Record processing time
	 */
	recordProcessingTime(operation: string, duration: number): void {
		if (!this.config.enabled) return

		this.processingTimeHistogram.record(duration, {
			operation,
		})

		// Track for performance percentiles
		this.metricsState.performanceData.push(duration)

		// Keep only recent data (last 1000 measurements)
		if (this.metricsState.performanceData.length > 1000) {
			this.metricsState.performanceData = this.metricsState.performanceData.slice(-1000)
		}
	}

	/**
	 * Record memory usage
	 */
	recordMemoryUsage(heapUsed: number, heapTotal: number): void {
		if (!this.config.enabled) return

		this.memoryUsageGauge.add(heapUsed, { type: 'heap_used' })
		this.memoryUsageGauge.add(heapTotal, { type: 'heap_total' })
	}

	/**
	 * Record CPU usage
	 */
	recordCpuUsage(usage: number): void {
		if (!this.config.enabled) return

		this.cpuUsageGauge.add(usage)
	}

	/**
	 * Get metrics snapshot
	 */
	async getMetricsSnapshot(): Promise<DeliveryMetricsData> {
		const now = Date.now()
		const timeSinceLastSnapshot = now - this.metricsState.lastMetricsSnapshot

		// Calculate totals
		let totalDeliveries = 0
		let totalSuccessful = 0
		let totalFailed = 0

		const byDestinationType: Record<string, any> = {}
		const byOrganization: Record<string, any> = {}

		// Aggregate by destination type
		for (const [type, stats] of this.metricsState.deliveriesByType.entries()) {
			totalDeliveries += stats.total
			totalSuccessful += stats.successful
			totalFailed += stats.failed

			byDestinationType[type] = {
				total: stats.total,
				successful: stats.successful,
				failed: stats.failed,
				avg_duration_ms: stats.total > 0 ? stats.totalDuration / stats.total : 0,
			}
		}

		// Aggregate by organization
		for (const [org, stats] of this.metricsState.deliveriesByOrg.entries()) {
			byOrganization[org] = {
				total: stats.total,
				successful: stats.successful,
				failed: stats.failed,
			}
		}

		// Calculate error rates
		const errorRates: Record<string, number> = {}
		for (const [errorType, count] of this.metricsState.errorsByType.entries()) {
			errorRates[errorType] = count
		}

		// Calculate performance percentiles
		const sortedPerformanceData = [...this.metricsState.performanceData].sort((a, b) => a - b)
		const performancePercentiles = {
			p50: this.calculatePercentile(sortedPerformanceData, 50),
			p90: this.calculatePercentile(sortedPerformanceData, 90),
			p95: this.calculatePercentile(sortedPerformanceData, 95),
			p99: this.calculatePercentile(sortedPerformanceData, 99),
		}

		this.metricsState.lastMetricsSnapshot = now

		return {
			deliveries_total: totalDeliveries,
			deliveries_successful: totalSuccessful,
			deliveries_failed: totalFailed,
			queue_depth: 0, // Would be updated by queue manager
			active_deliveries: 0, // Would be updated by delivery processor
			circuit_breakers_open: 0, // Would be updated by circuit breaker
			delivery_duration_ms: this.metricsState.performanceData,
			payload_size_bytes: [], // Would be populated from payload size tracking
			retry_attempts: [], // Would be populated from retry tracking
			by_destination_type: byDestinationType,
			by_organization: byOrganization,
			error_rates: errorRates,
			performance_percentiles: performancePercentiles,
		}
	}

	/**
	 * Get custom metrics
	 */
	async getCustomMetrics(): Promise<DeliveryCustomMetrics> {
		const snapshot = await this.getMetricsSnapshot()

		// Calculate success rates by type
		const deliverySuccessRateByType: Record<string, number> = {}
		for (const [type, stats] of Object.entries(snapshot.by_destination_type)) {
			deliverySuccessRateByType[type] = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0
		}

		return {
			delivery_success_rate_by_type: deliverySuccessRateByType,
			queue_processing_rate: 0, // Would be calculated from queue metrics
			queue_average_wait_time: 0, // Would be calculated from queue metrics
			circuit_breaker_trip_rate: 0, // Would be calculated from circuit breaker metrics
			circuit_breaker_recovery_time: 0, // Would be calculated from circuit breaker metrics
			retry_success_rate: 0, // Would be calculated from retry metrics
			retry_average_attempts: 0, // Would be calculated from retry metrics
			destination_health_score: {}, // Would be calculated from health metrics
			destination_response_time_p95: {}, // Would be calculated from response time metrics
			alert_generation_rate: 0, // Would be calculated from alert metrics
			alert_resolution_time: 0, // Would be calculated from alert metrics
		}
	}

	/**
	 * Create metric exporter based on configuration
	 */
	private createMetricExporter() {
		switch (this.config.exporterType) {
			case 'otlp':
				try {
					return new OTLPMetricExporter({
						url: this.config.exporterEndpoint || 'http://localhost:4318/v1/metrics',
						headers: this.config.headers || {},
					})
				} catch (error) {
					console.warn('Failed to create OTLP metric exporter, falling back to console:', error)
					return undefined
				}

			case 'console':
			case 'prometheus':
			default:
				// Console exporter is built into the SDK
				// Prometheus exporter would need additional setup
				return undefined
		}
	}

	/**
	 * Recreate instruments after meter provider initialization
	 */
	private recreateInstruments(): void {
		// Recreate all instruments with the new meter
		this.deliveryAttemptsCounter = this.meter.createCounter('delivery_attempts_total', {
			description: 'Total number of delivery attempts',
			valueType: ValueType.INT,
		})

		this.deliverySuccessCounter = this.meter.createCounter('delivery_success_total', {
			description: 'Total number of successful deliveries',
			valueType: ValueType.INT,
		})

		this.deliveryFailureCounter = this.meter.createCounter('delivery_failures_total', {
			description: 'Total number of failed deliveries',
			valueType: ValueType.INT,
		})

		this.retryAttemptsCounter = this.meter.createCounter('retry_attempts_total', {
			description: 'Total number of retry attempts',
			valueType: ValueType.INT,
		})

		this.circuitBreakerTripsCounter = this.meter.createCounter('circuit_breaker_trips_total', {
			description: 'Total number of circuit breaker trips',
			valueType: ValueType.INT,
		})

		this.alertsGeneratedCounter = this.meter.createCounter('alerts_generated_total', {
			description: 'Total number of alerts generated',
			valueType: ValueType.INT,
		})

		this.queueDepthGauge = this.meter.createUpDownCounter('queue_depth', {
			description: 'Current queue depth',
			valueType: ValueType.INT,
		})

		this.activeDeliveriesGauge = this.meter.createUpDownCounter('active_deliveries', {
			description: 'Number of currently active deliveries',
			valueType: ValueType.INT,
		})

		this.circuitBreakersOpenGauge = this.meter.createUpDownCounter('circuit_breakers_open', {
			description: 'Number of circuit breakers currently open',
			valueType: ValueType.INT,
		})

		this.memoryUsageGauge = this.meter.createUpDownCounter('memory_usage_bytes', {
			description: 'Memory usage in bytes',
			valueType: ValueType.INT,
		})

		this.cpuUsageGauge = this.meter.createUpDownCounter('cpu_usage_percent', {
			description: 'CPU usage percentage',
			valueType: ValueType.DOUBLE,
		})

		this.deliveryDurationHistogram = this.meter.createHistogram('delivery_duration_ms', {
			description: 'Delivery duration in milliseconds',
			valueType: ValueType.DOUBLE,
		})

		this.payloadSizeHistogram = this.meter.createHistogram('payload_size_bytes', {
			description: 'Delivery payload size in bytes',
			valueType: ValueType.INT,
		})

		this.responseTimeHistogram = this.meter.createHistogram('destination_response_time_ms', {
			description: 'Destination response time in milliseconds',
			valueType: ValueType.DOUBLE,
		})

		this.processingTimeHistogram = this.meter.createHistogram('processing_time_ms', {
			description: 'Operation processing time in milliseconds',
			valueType: ValueType.DOUBLE,
		})
	}

	/**
	 * Update internal metrics state
	 */
	private updateInternalMetrics(
		organizationId: string,
		destinationType: string,
		success: boolean,
		duration: number
	): void {
		// Update by destination type
		const typeStats = this.metricsState.deliveriesByType.get(destinationType) || {
			total: 0,
			successful: 0,
			failed: 0,
			totalDuration: 0,
		}

		typeStats.total++
		typeStats.totalDuration += duration
		if (success) {
			typeStats.successful++
		} else {
			typeStats.failed++
		}

		this.metricsState.deliveriesByType.set(destinationType, typeStats)

		// Update by organization
		const orgStats = this.metricsState.deliveriesByOrg.get(organizationId) || {
			total: 0,
			successful: 0,
			failed: 0,
		}

		orgStats.total++
		if (success) {
			orgStats.successful++
		} else {
			orgStats.failed++
		}

		this.metricsState.deliveriesByOrg.set(organizationId, orgStats)
	}

	/**
	 * Calculate percentile from sorted array
	 */
	private calculatePercentile(sortedArray: number[], percentile: number): number {
		if (sortedArray.length === 0) return 0

		const index = (percentile / 100) * (sortedArray.length - 1)
		const lower = Math.floor(index)
		const upper = Math.ceil(index)

		if (lower === upper) {
			return sortedArray[lower]
		}

		const weight = index - lower
		return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
	}
}

/**
 * Factory function for creating delivery metrics collector
 */
export function createDeliveryMetricsCollector(
	config: DeliveryObservabilityConfig['metrics']
): IDeliveryMetricsCollector {
	return new DeliveryMetricsCollector(config)
}
