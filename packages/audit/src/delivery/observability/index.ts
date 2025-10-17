/**
 * Delivery service observability exports
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: OpenTelemetry observability and metrics
 */

import { createDeliveryMetricsCollector } from './metrics'
import { createDeliveryPerformanceMonitor } from './performance'
import { createDeliveryTracer } from './tracer'
import { DeliveryObservabilityConfig } from './types'

// Tracing
export { DeliveryTracer, traceDeliveryOperation, createDeliveryTracer } from './tracer'
export type { IDeliveryTracer, DeliverySpanContext, DeliverySpan } from './tracer'

// Metrics
export { DeliveryMetricsCollector, createDeliveryMetricsCollector } from './metrics'
export type { IDeliveryMetricsCollector } from './metrics'

// Performance monitoring
export {
	DeliveryPerformanceMonitor,
	PerformanceTimer,
	createDeliveryPerformanceMonitor,
} from './performance'
export type { IDeliveryPerformanceMonitor, PerformanceMetrics } from './performance'

// Types
export type {
	DeliveryObservabilityConfig,
	DeliverySpanAttributes,
	DeliveryOperation,
	DeliverySpanEvent,
	DeliveryCustomMetrics,
	DeliveryMetricsData,
} from './types'

// Factory function for creating complete observability stack
export function createDeliveryObservabilityStack(config: DeliveryObservabilityConfig) {
	const tracer = createDeliveryTracer(config.tracing)
	const metricsCollector = createDeliveryMetricsCollector(config.metrics)
	const performanceMonitor = createDeliveryPerformanceMonitor(config.performance, metricsCollector)

	return {
		tracer,
		metricsCollector,
		performanceMonitor,
		async initialize() {
			await tracer.initialize()
			await metricsCollector.initialize()
			performanceMonitor.start()
		},
		async shutdown() {
			performanceMonitor.stop()
			await metricsCollector.shutdown()
			await tracer.shutdown()
		},
	}
}

// Default configuration
export const DEFAULT_DELIVERY_OBSERVABILITY_CONFIG: DeliveryObservabilityConfig = {
	tracing: {
		enabled: true,
		serviceName: 'audit-delivery-service',
		sampleRate: 1.0,
		exporterType: 'otlp',
		exporterEndpoint:
			process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
		headers: {},
	},
	metrics: {
		enabled: true,
		serviceName: 'audit-delivery-service',
		exporterType: 'otlp',
		exporterEndpoint:
			process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
		collectionInterval: 30000, // 30 seconds
		headers: {},
	},
	performance: {
		enabled: true,
		trackingEnabled: true,
		slowOperationThreshold: 5000, // 5 seconds
		memoryTrackingEnabled: true,
	},
}
