/**
 * Observability module exports for audit system
 */

// Types
export type * from './types.js'

// Tracing
export { AuditTracer, AuditSpan, trace } from './tracer.js'
export type { Tracer } from './tracer.js'

// Metrics Collection
export { RedisEnhancedMetricsCollector, PerformanceTimer } from './metrics-collector.js'
export type { EnhancedMetricsCollector } from './metrics-collector.js'

// Bottleneck Analysis
export { AuditBottleneckAnalyzer } from './bottleneck-analyzer.js'
export type { BottleneckAnalyzer } from './bottleneck-analyzer.js'

// Dashboard
export { AuditMonitoringDashboard } from './dashboard.js'
export type {
	DashboardDataProvider,
	DashboardData,
	TimeRange,
	OverviewMetrics,
	PerformanceData,
	HealthData,
	AlertSummary,
	TrendData,
} from './dashboard.js'

// Default configurations
export const DEFAULT_OBSERVABILITY_CONFIG = {
	tracing: {
		enabled: true,
		serviceName: 'audit-system',
		sampleRate: 1.0,
		exporterType: 'console' as const,
	},
	metrics: {
		enabled: true,
		collectionInterval: 30000, // 30 seconds
		retentionPeriod: 86400, // 24 hours
		exporterType: 'console' as const,
	},
	profiling: {
		enabled: true,
		sampleRate: 0.1, // 10% sampling
		maxProfiles: 100,
		profileDuration: 60000, // 1 minute
	},
	dashboard: {
		enabled: true,
		refreshInterval: 30000, // 30 seconds
		historyRetention: 86400, // 24 hours
	},
}

export const DEFAULT_DASHBOARD_CONFIG = {
	refreshInterval: 30000,
	dataRetention: 86400,
	alertThresholds: {
		errorRate: 0.05, // 5%
		latency: 1000, // 1 second
		throughput: 100, // events per second
	},
	components: ['audit-processor', 'database', 'redis', 'queue', 'monitoring', 'health-check'],
}
