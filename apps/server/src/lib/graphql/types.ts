/**
 * GraphQL type definitions and interfaces
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

// Import types from audit package for compatibility
import type {
	AuditEventStatus,
	AuditLogEvent,
	SessionContext as AuditSessionContext,
	DataClassification,
} from '@repo/audit'
import type { Session } from '@repo/auth'
import type { ServiceContext } from '../hono/context.js'

// Base types for GraphQL operations
export interface GraphQLContext {
	services: ServiceContext
	session: Session
	requestId: string
}

// Audit Event types - compatible with audit package
export interface AuditEvent {
	id: string
	timestamp: string
	action: string
	targetResourceType?: string
	targetResourceId?: string
	principalId?: string
	organizationId?: string
	status: AuditEventStatus
	outcomeDescription?: string
	dataClassification?: DataClassification
	sessionContext?: SessionContext
	correlationId?: string
	retentionPolicy?: string
	metadata?: Record<string, any>
	hash?: string
	integrityStatus?: 'verified' | 'failed' | 'not_checked'
	// Additional fields from audit package
	ttl?: string
	eventVersion?: string
	hashAlgorithm?: 'SHA-256'
	signature?: string
	processingLatency?: number
	queueDepth?: number
}

// Use the SessionContext from audit package for compatibility
export interface SessionContext extends AuditSessionContext {}

// Filter and pagination types
export interface AuditEventFilter {
	dateRange?: {
		startDate: string
		endDate: string
	}
	principalIds?: string[]
	organizationIds?: string[]
	actions?: string[]
	statuses?: AuditEventStatus[]
	dataClassifications?: DataClassification[]
	resourceTypes?: string[]
	resourceIds?: string[]
	verifiedOnly?: boolean
	correlationIds?: string[]
}

export interface PaginationInput {
	first?: number
	after?: string
	last?: number
	before?: string
}

export interface SortInput {
	field: 'timestamp' | 'status' | 'action' | 'principalId'
	direction: 'ASC' | 'DESC'
}

// Connection types for pagination
export interface AuditEventConnection {
	edges: AuditEventEdge[]
	pageInfo: PageInfo
	totalCount: number
}

export interface AuditEventEdge {
	node: AuditEvent
	cursor: string
}

export interface PageInfo {
	hasNextPage: boolean
	hasPreviousPage: boolean
	startCursor?: string
	endCursor?: string
}

// Health and system types
export interface HealthStatus {
	status: 'healthy' | 'unhealthy' | 'degraded'
	timestamp: string
	checks: HealthCheck[]
}

export interface HealthCheck {
	name: string
	status: 'healthy' | 'unhealthy'
	message?: string
	responseTime?: number
}

export interface SystemMetrics {
	timestamp: string
	server: ServerMetrics
	database: DatabaseMetrics
	redis: RedisMetrics
	api: APIMetrics
}

export interface ServerMetrics {
	uptime: number
	memoryUsage: MemoryUsage
	cpuUsage: CPUUsage
}

export interface MemoryUsage {
	used: number
	total: number
	percentage: number
}

export interface CPUUsage {
	percentage: number
	loadAverage: number[]
}

export interface DatabaseMetrics {
	connectionCount: number
	activeQueries: number
	averageQueryTime: number
}

export interface RedisMetrics {
	connectionCount: number
	memoryUsage: number
	keyCount: number
}

export interface APIMetrics {
	requestsPerSecond: number
	averageResponseTime: number
	errorRate: number
}

// Compliance report types
export interface ComplianceReport {
	id: string
	type: ComplianceReportType
	criteria: ReportCriteria
	generatedAt: string
	status: 'pending' | 'completed' | 'failed'
	summary: ReportSummary
	downloadUrl?: string
}

export type ComplianceReportType = 'HIPAA' | 'GDPR' | 'INTEGRITY' | 'CUSTOM'

export interface ReportCriteria {
	dateRange: {
		startDate: string
		endDate: string
	}
	organizationIds?: string[]
	includeMetadata?: boolean
	format?: 'JSON' | 'CSV' | 'XML'
}

export interface ReportSummary {
	totalEvents: number
	verifiedEvents: number
	failedVerifications: number
	complianceScore?: number
}

// Scheduled report types
export interface ScheduledReport {
	id: string
	name: string
	description?: string
	reportType: ComplianceReportType
	criteria: ReportCriteria
	schedule: ReportSchedule
	deliveryConfig: DeliveryConfig
	isActive: boolean
	createdAt: string
	updatedAt: string
	lastExecution?: ReportExecution
}

export interface ReportSchedule {
	frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
	dayOfWeek?: number
	dayOfMonth?: number
	hour: number
	minute: number
	timezone: string
}

export interface DeliveryConfig {
	method: 'EMAIL' | 'WEBHOOK' | 'STORAGE'
	config: Record<string, any>
}

export interface ReportExecution {
	id: string
	reportId: string
	startedAt: string
	completedAt?: string
	status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
	error?: string
	downloadUrl?: string
}

// Audit preset types
export interface AuditPreset {
	name: string
	description?: string
	configuration: PresetConfiguration
	isActive: boolean
	createdAt: string
	updatedAt: string
}

export interface PresetConfiguration {
	actions: string[]
	dataClassifications: DataClassification[]
	retentionPolicy: string
	encryptionEnabled: boolean
	integrityCheckEnabled: boolean
	alertThresholds?: AlertThresholds
}

export interface AlertThresholds {
	errorRate?: number
	responseTime?: number
	volumeThreshold?: number
}

// Alert types
export interface Alert {
	id: string
	type: AlertType
	severity: AlertSeverity
	title: string
	description: string
	createdAt: string
	acknowledgedAt?: string
	resolvedAt?: string
	acknowledgedBy?: string
	resolvedBy?: string
	resolution?: string
	metadata?: Record<string, any>
}

export type AlertType = 'SYSTEM' | 'SECURITY' | 'COMPLIANCE' | 'PERFORMANCE'
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface AlertFilter {
	types?: AlertType[]
	severities?: AlertSeverity[]
	status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
	dateRange?: {
		startDate: string
		endDate: string
	}
}

export interface AlertConnection {
	edges: AlertEdge[]
	pageInfo: PageInfo
	totalCount: number
}

export interface AlertEdge {
	node: Alert
	cursor: string
}

// Audit metrics types
export interface AuditMetrics {
	timestamp: string
	timeRange: TimeRange
	eventsProcessed: number
	processingLatency: LatencyMetrics
	integrityVerifications: IntegrityMetrics
	complianceReports: ComplianceMetrics
	errorMetrics: ErrorMetrics
}

export interface TimeRange {
	startDate: string
	endDate: string
}

export interface LatencyMetrics {
	average: number
	p50: number
	p95: number
	p99: number
}

export interface IntegrityMetrics {
	total: number
	passed: number
	failed: number
	successRate: number
}

export interface ComplianceMetrics {
	generated: number
	scheduled: number
	failed: number
	successRate: number
}

export interface ErrorMetrics {
	total: number
	byType: Record<string, number>
	errorRate: number
}

export interface TimeRangeInput {
	startDate: string
	endDate: string
}

export type MetricsGroupBy = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH'

// Input types for mutations
export interface CreateAuditEventInput {
	action: string
	targetResourceType?: string
	targetResourceId?: string
	principalId: string
	organizationId: string
	status: AuditEventStatus
	outcomeDescription?: string
	dataClassification?: DataClassification
	sessionContext?: SessionContextInput
	correlationId?: string
	retentionPolicy?: string
	metadata?: Record<string, any>
}

export interface SessionContextInput {
	sessionId: string
	ipAddress: string
	userAgent: string
	geolocation?: string
}

export interface CreateScheduledReportInput {
	name: string
	description?: string
	reportType: ComplianceReportType
	criteria: ReportCriteriaInput
	schedule: ReportScheduleInput
	deliveryConfig: DeliveryConfigInput
	isActive?: boolean
}

export interface ReportCriteriaInput {
	dateRange: TimeRangeInput
	organizationIds?: string[]
	includeMetadata?: boolean
	format?: 'JSON' | 'CSV' | 'XML'
}

export interface ReportScheduleInput {
	frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
	dayOfWeek?: number
	dayOfMonth?: number
	hour: number
	minute: number
	timezone: string
}

export interface DeliveryConfigInput {
	method: 'EMAIL' | 'WEBHOOK' | 'STORAGE'
	config: Record<string, any>
}

export interface UpdateScheduledReportInput {
	name?: string
	description?: string
	criteria?: ReportCriteriaInput
	schedule?: ReportScheduleInput
	deliveryConfig?: DeliveryConfigInput
	isActive?: boolean
}

export interface CreateAuditPresetInput {
	name: string
	description?: string
	configuration: PresetConfigurationInput
	isActive?: boolean
}

export interface PresetConfigurationInput {
	actions: string[]
	dataClassifications: DataClassification[]
	retentionPolicy: string
	encryptionEnabled: boolean
	integrityCheckEnabled: boolean
	alertThresholds?: AlertThresholdsInput
}

export interface AlertThresholdsInput {
	errorRate?: number
	responseTime?: number
	volumeThreshold?: number
}

export interface UpdateAuditPresetInput {
	description?: string
	configuration?: PresetConfigurationInput
	isActive?: boolean
}

// Integrity verification types
export interface IntegrityVerificationResult {
	isValid: boolean
	expectedHash?: string
	computedHash?: string
	timestamp: string
	eventId: string
	verificationChain?: IntegrityVerificationResult[]
}

// GDPR types
export interface GDPRExportInput {
	principalId: string
	format: 'json' | 'csv' | 'xml'
	dateRange?: {
		startDate: string
		endDate: string
	}
	includeMetadata?: boolean
}

export interface GDPRExportResult {
	requestId: string
	principalId: string
	recordCount: number
	dataSize: number
	format: string
	exportTimestamp: string
	metadata: {
		dateRange: {
			start: string
			end: string
		}
		categories: string[]
		retentionPolicies: string[]
		exportedBy: string
	}
	data: string // Base64 encoded data
}

export interface GDPRPseudonymizeInput {
	principalId: string
	strategy: 'hash' | 'token' | 'encryption'
}

export interface GDPRPseudonymizeResult {
	pseudonymId: string
	recordsAffected: number
	timestamp: string
}
