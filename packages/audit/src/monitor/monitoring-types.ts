/**
 * Shared types for monitoring and health check systems
 */

export interface Metrics {
	eventsProcessed: number
	processingLatency: number
	queueDepth: number
	errorsGenerated: number
	errorRate: number
	integrityViolations: number
	timestamp: string
	alertsGenerated: number
	suspiciousPatterns: number
}

/**
 * Audit metrics interface
 */
export interface AuditMetrics {
	eventsProcessed: number
	queueDepth: number
	errorsGenerated: number
	errorRate: number
	integrityViolations: number
	timestamp: string
	alertsGenerated: number
	suspiciousPatterns: number
	processingLatency: {
		average: number
		p95: number
		p99: number
	}
	integrityVerifications: {
		total: number
		passed: number
		failed: number
	}
	complianceReports: {
		generated: number
		scheduled: number
		failed: number
	}
}

/**
 * Individual component health status
 */
export interface ComponentHealth {
	status: 'OK' | 'WARNING' | 'CRITICAL'
	message?: string
	details?: Record<string, any>
	responseTime?: number
	lastCheck: string
}

/**
 * Health status interface
 */
export interface HealthStatus {
	status: 'OK' | 'WARNING' | 'CRITICAL'
	components: {
		[key: string]: ComponentHealth
	}
	timestamp: string
}

/**
 * Alert severity levels
 */
export type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

/**
 * Alert types for categorization
 */
export type AlertType = 'SECURITY' | 'COMPLIANCE' | 'PERFORMANCE' | 'SYSTEM' | 'METRICS' | 'CUSTOM'

/**
 * Alert status
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed'

/**
 * Alert interface
 */
export interface Alert {
	id: string
	severity: AlertSeverity
	type: AlertType
	title: string
	description: string
	createdAt: string
	source: string
	status: AlertStatus
	metadata: Record<string, any>
	acknowledged: boolean
	acknowledgedAt?: string
	acknowledgedBy?: string
	resolved: boolean
	resolvedAt?: string
	resolvedBy?: string
	resolutionNotes?: string
	correlationId?: string
	tags: string[]
}

/**
 * Enhanced alert interface with organization support
 */
export interface OrganizationalAlert extends Alert {
	organizationId: string
}

/**
 * Alert statisctics interface
 */
export interface AlertStatistics {
	total: number
	active: number
	acknowledged: number
	resolved: number
	dismissed: number
	bySeverity: Record<AlertSeverity, number>
	byType: Record<AlertType, number>
	bySource: Record<string, number>
	trends: {
		period: string
		created: number
		resolved: number
	}[]
}

export interface RequestMetrics {
	requestId: string
	method: string
	path: string
	statusCode: number
	responseTime: number
	timestamp: string
	userAgent?: string
	ip?: string
	userId?: string
	organizationId?: string
	contentLength?: number
	errorCode?: string
}

export interface PerformanceMetrics {
	endpoint: string
	method: string
	count: number
	averageResponseTime: number
	p95ResponseTime: number
	p99ResponseTime: number
	errorRate: number
	lastUpdated: string
}

export interface SystemMetrics {
	timestamp: string
	server: {
		uptime: number
		memoryUsage: {
			used: number
			total: number
			percentage: number
		}
		cpuUsage: {
			percentage: number
			loadAverage: number[]
		}
	}
	database: {
		connectionCount: number
		activeQueries: number
		averageQueryTime: number
	}
	redis: {
		connectionCount: number
		memoryUsage: number
		keyCount: number
	}
	api: {
		requestsPerSecond: number
		averageResponseTime: number
		errorRate: number
	}
}

export interface EndpointMetrics {
	endpoint: string
	method: string
	count: number
	averageResponseTime: number
	p95ResponseTime: number
	p99ResponseTime: number
	errorRate: number
	lastUpdated: string
}

export interface MetricPoint {
	timestamp: number
	value: number
	labels?: Record<string, string>
}

export interface MetricQuery {
	timeRange?: '1h' | '6h' | '24h' | '7d' | '30d'
	startTime?: string
	endTime?: string
	groupBy?: 'hour' | 'day' | 'week' | 'month' | 'year'
}
