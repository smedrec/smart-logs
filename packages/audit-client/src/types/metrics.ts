import { z } from 'zod'

import { DateRangeFilterSchema, PaginationMetadataSchema, PaginationParamsSchema } from './api'

// ============================================================================
// System Metrics Types
// ============================================================================

/**
 * Memory usage metrics
 */
export const MemoryUsageSchema = z.object({
	total: z.number().min(0),
	used: z.number().min(0),
	free: z.number().min(0),
	percentage: z.number().min(0).max(100),
	buffers: z.number().min(0).optional(),
	cached: z.number().min(0).optional(),
	available: z.number().min(0).optional(),
})
export type MemoryUsage = z.infer<typeof MemoryUsageSchema>

/**
 * CPU usage metrics
 */
export const CpuUsageSchema = z.object({
	percentage: z.number().min(0).max(100),
	cores: z.number().int().min(1),
	loadAverage: z
		.object({
			oneMinute: z.number().min(0),
			fiveMinutes: z.number().min(0),
			fifteenMinutes: z.number().min(0),
		})
		.optional(),
	processes: z
		.object({
			total: z.number().int().min(0),
			running: z.number().int().min(0),
			sleeping: z.number().int().min(0),
			zombie: z.number().int().min(0),
		})
		.optional(),
})
export type CpuUsage = z.infer<typeof CpuUsageSchema>

/**
 * Disk usage metrics
 */
export const DiskUsageSchema = z.object({
	total: z.number().min(0),
	used: z.number().min(0),
	free: z.number().min(0),
	percentage: z.number().min(0).max(100),
	mountPoint: z.string().optional(),
	filesystem: z.string().optional(),
	inodesTotal: z.number().int().min(0).optional(),
	inodesUsed: z.number().int().min(0).optional(),
	inodesFree: z.number().int().min(0).optional(),
})
export type DiskUsage = z.infer<typeof DiskUsageSchema>

/**
 * Network metrics
 */
export const NetworkMetricsSchema = z.object({
	bytesReceived: z.number().min(0),
	bytesSent: z.number().min(0),
	packetsReceived: z.number().int().min(0),
	packetsSent: z.number().int().min(0),
	errorsReceived: z.number().int().min(0),
	errorsSent: z.number().int().min(0),
	droppedReceived: z.number().int().min(0),
	droppedSent: z.number().int().min(0),
	interface: z.string().optional(),
})
export type NetworkMetrics = z.infer<typeof NetworkMetricsSchema>

/**
 * System metrics
 */
export const SystemMetricsSchema = z.object({
	timestamp: z.string().datetime(),
	uptime: z.number().min(0),
	server: z.object({
		hostname: z.string().optional(),
		platform: z.string().optional(),
		architecture: z.string().optional(),
		nodeVersion: z.string().optional(),
		memoryUsage: MemoryUsageSchema,
		cpuUsage: CpuUsageSchema,
		diskUsage: z.array(DiskUsageSchema).optional(),
		networkMetrics: z.array(NetworkMetricsSchema).optional(),
	}),
	database: z.object({
		connectionCount: z.number().int().min(0),
		activeQueries: z.number().int().min(0),
		averageQueryTime: z.number().min(0),
		slowQueries: z.number().int().min(0),
		deadlocks: z.number().int().min(0).optional(),
		cacheHitRatio: z.number().min(0).max(100).optional(),
		indexUsage: z.number().min(0).max(100).optional(),
		tableSize: z.number().min(0).optional(),
		indexSize: z.number().min(0).optional(),
	}),
	cache: z.object({
		hitRate: z.number().min(0).max(100),
		missRate: z.number().min(0).max(100),
		evictionRate: z.number().min(0).max(100),
		memoryUsage: z.number().min(0),
		keyCount: z.number().int().min(0),
		operations: z
			.object({
				gets: z.number().int().min(0),
				sets: z.number().int().min(0),
				deletes: z.number().int().min(0),
				flushes: z.number().int().min(0),
			})
			.optional(),
	}),
	api: z.object({
		requestsPerSecond: z.number().min(0),
		averageResponseTime: z.number().min(0),
		errorRate: z.number().min(0).max(100),
		activeConnections: z.number().int().min(0),
		totalRequests: z.number().int().min(0),
		totalErrors: z.number().int().min(0),
		responseTimePercentiles: z
			.object({
				p50: z.number().min(0),
				p90: z.number().min(0),
				p95: z.number().min(0),
				p99: z.number().min(0),
			})
			.optional(),
	}),
})
export type SystemMetrics = z.infer<typeof SystemMetricsSchema>

// ============================================================================
// Audit Metrics Types
// ============================================================================

/**
 * Audit metrics parameters
 */
export const AuditMetricsParamsSchema = z.object({
	timeRange: DateRangeFilterSchema.optional(),
	granularity: z.enum(['minute', 'hour', 'day', 'week', 'month']).default('hour'),
	organizationIds: z.array(z.string().min(1)).optional(),
	principalIds: z.array(z.string().min(1)).optional(),
	actions: z.array(z.string().min(1)).optional(),
	resourceTypes: z.array(z.string().min(1)).optional(),
	includeBreakdown: z.boolean().default(true),
	includeTimeline: z.boolean().default(true),
})
export type AuditMetricsParams = z.infer<typeof AuditMetricsParamsSchema>

/**
 * Processing latency metrics
 */
export const ProcessingLatencySchema = z.object({
	average: z.number().min(0),
	median: z.number().min(0),
	p50: z.number().min(0),
	p90: z.number().min(0),
	p95: z.number().min(0),
	p99: z.number().min(0),
	min: z.number().min(0),
	max: z.number().min(0),
	standardDeviation: z.number().min(0).optional(),
})
export type ProcessingLatency = z.infer<typeof ProcessingLatencySchema>

/**
 * Integrity verification metrics
 */
export const IntegrityVerificationMetricsSchema = z.object({
	total: z.number().int().min(0),
	passed: z.number().int().min(0),
	failed: z.number().int().min(0),
	averageTime: z.number().min(0),
	successRate: z.number().min(0).max(100),
	failureReasons: z.record(z.number().int().min(0)).optional(),
})
export type IntegrityVerificationMetrics = z.infer<typeof IntegrityVerificationMetricsSchema>

/**
 * Compliance report metrics
 */
export const ComplianceReportMetricsSchema = z.object({
	generated: z.number().int().min(0),
	scheduled: z.number().int().min(0),
	failed: z.number().int().min(0),
	averageGenerationTime: z.number().min(0),
	reportsByType: z.record(z.number().int().min(0)),
	reportsByFormat: z.record(z.number().int().min(0)),
	totalSize: z.number().min(0),
	averageSize: z.number().min(0),
})
export type ComplianceReportMetrics = z.infer<typeof ComplianceReportMetricsSchema>

/**
 * Error rate metrics
 */
export const ErrorRateMetricsSchema = z.object({
	total: z.number().int().min(0),
	rate: z.number().min(0).max(100),
	byType: z.record(z.number().int().min(0)),
	byEndpoint: z.record(z.number().int().min(0)),
	byStatusCode: z.record(z.number().int().min(0)),
	criticalErrors: z.number().int().min(0),
	recoverableErrors: z.number().int().min(0),
})
export type ErrorRateMetrics = z.infer<typeof ErrorRateMetricsSchema>

/**
 * Timeline data point for audit metrics
 */
export const AuditTimelineDataPointSchema = z.object({
	timestamp: z.string().datetime(),
	eventsProcessed: z.number().int().min(0),
	averageLatency: z.number().min(0),
	errorCount: z.number().int().min(0),
	verificationCount: z.number().int().min(0),
	breakdown: z.record(z.number().int().min(0)).optional(),
})
export type AuditTimelineDataPoint = z.infer<typeof AuditTimelineDataPointSchema>

/**
 * Audit metrics
 */
export const AuditMetricsSchema = z.object({
	timestamp: z.string().datetime(),
	timeRange: DateRangeFilterSchema,
	eventsProcessed: z.number().int().min(0),
	processingLatency: ProcessingLatencySchema,
	integrityVerifications: IntegrityVerificationMetricsSchema,
	complianceReports: ComplianceReportMetricsSchema,
	errorRates: ErrorRateMetricsSchema,

	// Breakdown by dimensions
	eventsByStatus: z.record(z.number().int().min(0)),
	eventsByAction: z.record(z.number().int().min(0)),
	eventsByResourceType: z.record(z.number().int().min(0)),
	eventsByDataClassification: z.record(z.number().int().min(0)),
	eventsByOrganization: z.record(z.number().int().min(0)).optional(),

	// Timeline data
	timeline: z.array(AuditTimelineDataPointSchema).optional(),

	// Performance indicators
	throughput: z.object({
		eventsPerSecond: z.number().min(0),
		peakEventsPerSecond: z.number().min(0),
		averageEventsPerMinute: z.number().min(0),
	}),

	// Quality metrics
	dataQuality: z
		.object({
			completenessScore: z.number().min(0).max(100),
			accuracyScore: z.number().min(0).max(100),
			consistencyScore: z.number().min(0).max(100),
			validationFailures: z.number().int().min(0),
		})
		.optional(),
})
export type AuditMetrics = z.infer<typeof AuditMetricsSchema>

// ============================================================================
// Performance Metrics Types
// ============================================================================

/**
 * Performance metrics
 */
export const PerformanceMetricsSchema = z.object({
	timestamp: z.string().datetime(),

	// Request metrics
	requests: z.object({
		total: z.number().int().min(0),
		successful: z.number().int().min(0),
		failed: z.number().int().min(0),
		rate: z.number().min(0),
		averageResponseTime: z.number().min(0),
		responseTimePercentiles: z.object({
			p50: z.number().min(0),
			p90: z.number().min(0),
			p95: z.number().min(0),
			p99: z.number().min(0),
		}),
	}),

	// Throughput metrics
	throughput: z.object({
		requestsPerSecond: z.number().min(0),
		bytesPerSecond: z.number().min(0),
		eventsPerSecond: z.number().min(0),
		peakThroughput: z.number().min(0),
	}),

	// Latency metrics
	latency: z.object({
		average: z.number().min(0),
		median: z.number().min(0),
		p95: z.number().min(0),
		p99: z.number().min(0),
		max: z.number().min(0),
	}),

	// Resource utilization
	resources: z.object({
		cpuUtilization: z.number().min(0).max(100),
		memoryUtilization: z.number().min(0).max(100),
		diskUtilization: z.number().min(0).max(100),
		networkUtilization: z.number().min(0).max(100),
	}),

	// Concurrency metrics
	concurrency: z.object({
		activeConnections: z.number().int().min(0),
		maxConcurrentRequests: z.number().int().min(0),
		queuedRequests: z.number().int().min(0),
		rejectedRequests: z.number().int().min(0),
	}),
})
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>

// ============================================================================
// Usage Metrics Types
// ============================================================================

/**
 * Usage metrics parameters
 */
export const UsageMetricsParamsSchema = z.object({
	timeRange: DateRangeFilterSchema.optional(),
	granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
	organizationIds: z.array(z.string().min(1)).optional(),
	includeDetails: z.boolean().default(false),
})
export type UsageMetricsParams = z.infer<typeof UsageMetricsParamsSchema>

/**
 * API endpoint usage
 */
export const ApiEndpointUsageSchema = z.object({
	endpoint: z.string().min(1),
	method: z.string().min(1),
	requestCount: z.number().int().min(0),
	averageResponseTime: z.number().min(0),
	errorRate: z.number().min(0).max(100),
	dataTransferred: z.number().min(0),
	uniqueUsers: z.number().int().min(0),
})
export type ApiEndpointUsage = z.infer<typeof ApiEndpointUsageSchema>

/**
 * Feature usage
 */
export const FeatureUsageSchema = z.object({
	feature: z.string().min(1),
	usageCount: z.number().int().min(0),
	uniqueUsers: z.number().int().min(0),
	averageUsagePerUser: z.number().min(0),
	adoptionRate: z.number().min(0).max(100),
	retentionRate: z.number().min(0).max(100),
})
export type FeatureUsage = z.infer<typeof FeatureUsageSchema>

/**
 * Usage metrics
 */
export const UsageMetricsSchema = z.object({
	timestamp: z.string().datetime(),
	timeRange: DateRangeFilterSchema,

	// Overall usage
	totalRequests: z.number().int().min(0),
	uniqueUsers: z.number().int().min(0),
	uniqueOrganizations: z.number().int().min(0),
	dataTransferred: z.number().min(0),

	// API usage
	apiUsage: z.object({
		totalCalls: z.number().int().min(0),
		successfulCalls: z.number().int().min(0),
		failedCalls: z.number().int().min(0),
		averageResponseTime: z.number().min(0),
		endpointUsage: z.array(ApiEndpointUsageSchema),
	}),

	// Feature usage
	featureUsage: z.array(FeatureUsageSchema),

	// User behavior
	userBehavior: z.object({
		averageSessionDuration: z.number().min(0),
		averageRequestsPerSession: z.number().min(0),
		bounceRate: z.number().min(0).max(100),
		returnUserRate: z.number().min(0).max(100),
	}),

	// Resource consumption
	resourceConsumption: z.object({
		storageUsed: z.number().min(0),
		bandwidthUsed: z.number().min(0),
		computeHours: z.number().min(0),
		apiCallsRemaining: z.number().int().min(0).optional(),
	}),

	// Quotas and limits
	quotas: z
		.object({
			apiCallLimit: z.number().int().min(0).optional(),
			apiCallsUsed: z.number().int().min(0),
			storageLimit: z.number().min(0).optional(),
			storageUsed: z.number().min(0),
			bandwidthLimit: z.number().min(0).optional(),
			bandwidthUsed: z.number().min(0),
		})
		.optional(),
})
export type UsageMetrics = z.infer<typeof UsageMetricsSchema>

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Alert severity levels
 */
export const AlertSeveritySchema = z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>

/**
 * Alert status
 */
export const AlertStatusSchema = z.enum(['active', 'acknowledged', 'resolved', 'dismissed'])
export type AlertStatus = z.infer<typeof AlertStatusSchema>

/**
 * Alert types for categorization
 */
export const AlertTypeSchema = z.enum([
	'SECURITY',
	'COMPLIANCE',
	'PERFORMANCE',
	'SYSTEM',
	'METRICS',
	'DELIVERY',
	'CUSTOM',
])
export type AlertType = z.infer<typeof AlertTypeSchema>

/**
 * Alert action response
 */
export const AlertActionResponseSchema = z.object({
	success: z.boolean(),
	message: z.string().optional(),
})
export type AlertActionResponse = z.infer<typeof AlertActionResponseSchema>

/**
 * Alert category
 */
export const AlertCategorySchema = z.enum([
	'performance',
	'security',
	'compliance',
	'system',
	'data_quality',
	'availability',
	'capacity',
	'custom',
])
export type AlertCategory = z.infer<typeof AlertCategorySchema>

/**
 * Alert condition
 */
export const AlertConditionSchema = z.object({
	metric: z.string().min(1),
	operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'ne']),
	threshold: z.number(),
	duration: z.number().int().min(0).optional(),
	aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).optional(),
})
export type AlertCondition = z.infer<typeof AlertConditionSchema>

/**
 * Alert
 */
export const AlertSchema = z.object({
	id: z.string(),
	organizationId: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	severity: AlertSeveritySchema,
	status: AlertStatusSchema,
	type: AlertTypeSchema,
	source: z.string(),

	// Timing
	createdAt: z.string().datetime(),
	acknowledgedAt: z.string().datetime().optional(),
	resolvedAt: z.string().datetime().optional(),

	// Assignment and tracking
	acknowledged: z.boolean(),
	acknowledgedBy: z.string().optional(),
	resolved: z.boolean(),
	resolvedBy: z.string().optional(),
	resolutionNotes: z.string().optional(),

	// Metadata
	correlationId: z.string().optional(),
	tags: z.array(z.string()).default([]),
	metadata: z.record(z.string(), z.any()).optional(),
})
export type Alert = z.infer<typeof AlertSchema>

/**
 * Alerts query parameters
 */
export const AlertsParamsSchema = z.object({
	status: z.array(AlertStatusSchema).optional(),
	severity: z.array(AlertSeveritySchema).optional(),
	type: z.array(AlertTypeSchema).optional(),
	source: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	rangeBy: z.enum(['created_at', 'acknowledged_at', 'resolved_at', 'updated_at']).optional(),
	startDate: z.string().datetime().optional(),
	endDate: z.string().datetime().optional(),
	search: z.string().optional(),
	limit: z.number().int().min(1).max(1000).optional(),
	offset: z.number().int().min(0).optional(),
	sortBy: z.enum(['created_at', 'severity', 'status', 'title']).optional(),
	sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
})
export type AlertsParams = z.infer<typeof AlertsParamsSchema>

/**
 * Paginated alerts
 */
export const PaginatedAlertsSchema = z.object({
	data: z.array(AlertSchema),
	pagination: PaginationMetadataSchema,
	summary: z
		.object({
			totalAlerts: z.number().int().min(0),
			activeAlerts: z.number().int().min(0),
			criticalAlerts: z.number().int().min(0),
			alertsBySeverity: z.record(AlertSeveritySchema, z.number().int().min(0)),
			alertsByCategory: z.record(AlertCategorySchema, z.number().int().min(0)),
		})
		.optional(),
})
export type PaginatedAlerts = z.infer<typeof PaginatedAlertsSchema>

/**
 * Alert config
 */
export const AlertsConfigurationSchema = z.object({
	failureRateThreshold: z.number().min(0).max(100), // percentage (0-100)
	consecutiveFailureThreshold: z.number().int().min(1), // number of consecutive failures
	queueBacklogThreshold: z.number().min(0), //
	responseTimeThreshold: z.number().min(0), // milliseconds
	debounceWindow: z.number().min(0), // minutes
	escalationDelay: z.number().min(0), // minutes
	suppressionWindows: z
		.array(
			z.object({
				start: z.string(), // HH:MM format
				end: z.string(), // HH:MM format
				timezone: z.string(),
				reason: z.string(),
			})
		)
		.optional(),
})
export type AlertConfig = z.infer<typeof AlertsConfigurationSchema>

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for system metrics
 */
export const isSystemMetrics = (value: unknown): value is SystemMetrics => {
	return SystemMetricsSchema.safeParse(value).success
}

/**
 * Type guard for audit metrics
 */
export const isAuditMetrics = (value: unknown): value is AuditMetrics => {
	return AuditMetricsSchema.safeParse(value).success
}

/**
 * Type guard for performance metrics
 */
export const isPerformanceMetrics = (value: unknown): value is PerformanceMetrics => {
	return PerformanceMetricsSchema.safeParse(value).success
}

/**
 * Type guard for usage metrics
 */
export const isUsageMetrics = (value: unknown): value is UsageMetrics => {
	return UsageMetricsSchema.safeParse(value).success
}

/**
 * Type guard for alerts
 */
export const isAlert = (value: unknown): value is Alert => {
	return AlertSchema.safeParse(value).success
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates audit metrics parameters
 */
export const validateAuditMetricsParams = (data: unknown) => {
	return AuditMetricsParamsSchema.safeParse(data)
}

/**
 * Validates usage metrics parameters
 */
export const validateUsageMetricsParams = (data: unknown) => {
	return UsageMetricsParamsSchema.safeParse(data)
}

/**
 * Validates alerts parameters
 */
export const validateAlertsParams = (data: unknown) => {
	return AlertsParamsSchema.safeParse(data)
}

/**
 * Validates alert data
 */
export const validateAlert = (data: unknown) => {
	return AlertSchema.safeParse(data)
}

/**
 * Validates alert config
 */
export const validateAlertsConfiguration = (data: unknown) => {
	return AlertsConfigurationSchema.safeParse(data)
}
