/**
 * Report criteria interface for filtering compliance reports
 */
export interface ReportCriteria {
	dateRange: {
		startDate: string
		endDate: string
	}
	organizationIds?: string[]
	principalIds?: string[]
	resourceTypes?: string[]
	actions?: string[]
	dataClassifications?: ('PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI')[]
	statuses?: ('attempt' | 'success' | 'failure')[]
	includeDetails?: boolean
	includeMetadata?: boolean
}

/**
 * Report metadata interface
 */
export interface ReportMetadata {
	generatedBy: string
	generationTime: number
	queryExecutionTime: number
	totalRecordsProcessed: number
	filterCriteria: ReportCriteria
	reportVersion: string
	complianceFramework: string
}

/**
 * HIPAA report section interface
 */
export interface HIPAASection {
	sectionId: string
	title: string
	description: string
	requirements: string[]
	findings: {
		compliant: number
		nonCompliant: number
		details: Array<{
			eventId: string
			status: 'compliant' | 'non-compliant' | 'warning'
			description: string
			recommendation?: string
		}>
	}
	riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * HIPAA compliance report interface
 */
export interface HIPAAReport {
	id: string
	generatedAt: string
	criteria: ReportCriteria
	summary: {
		totalEvents: number
		complianceScore: number
		violations: number
		recommendations: string[]
		riskAssessment: {
			overallRisk: 'low' | 'medium' | 'high' | 'critical'
			riskFactors: string[]
		}
	}
	sections: HIPAASection[]
	metadata: ReportMetadata
}

/**
 * GDPR report section interface
 */
export interface GDPRSection {
	sectionId: string
	title: string
	description: string
	lawfulBasis: string[]
	findings: {
		dataSubjects: number
		processingActivities: number
		consentRecords: number
		details: Array<{
			eventId: string
			dataSubject: string
			processingPurpose: string
			lawfulBasis: string
			consentStatus: 'given' | 'withdrawn' | 'not-required'
			retentionPeriod?: string
		}>
	}
	complianceStatus: 'compliant' | 'non-compliant' | 'requires-attention'
}

/**
 * GDPR compliance report interface
 */
export interface GDPRReport {
	id: string
	generatedAt: string
	criteria: ReportCriteria
	summary: {
		totalEvents: number
		dataSubjects: number
		processingActivities: number
		lawfulBases: string[]
		consentManagement: {
			totalConsents: number
			activeConsents: number
			withdrawnConsents: number
		}
		dataRetention: {
			withinRetentionPeriod: number
			exceedsRetentionPeriod: number
		}
	}
	sections: GDPRSection[]
	metadata: ReportMetadata
}

/**
 * Custom report parameters interface
 */
export interface CustomReportParams {
	templateId: string
	name: string
	description?: string
	criteria: ReportCriteria
	parameters: Record<string, any>
	outputFormat: 'json' | 'csv' | 'pdf' | 'xlsx'
	includeCharts?: boolean
	customFields?: string[]
}

/**
 * Custom report interface
 */
export interface CustomReport {
	id: string
	name: string
	description?: string
	generatedAt: string
	template: string
	parameters: Record<string, any>
	data: any[]
	summary: Record<string, any>
	charts?: Array<{
		type: 'bar' | 'line' | 'pie' | 'scatter'
		title: string
		data: any[]
		config: Record<string, any>
	}>
	metadata: ReportMetadata
}

/**
 * GDPR data export parameters
 */
export interface GdprExportParams {
	dataSubjectId: string
	organizationId: string
	includePersonalData: boolean
	includePseudonymizedData: boolean
	includeMetadata: boolean
	format: 'json' | 'csv' | 'xml'
	dateRange?: {
		startDate: string
		endDate: string
	}
	categories?: string[]
}

/**
 * GDPR data export result
 */
export interface GdprExportResult {
	exportId: string
	dataSubjectId: string
	generatedAt: string
	format: string
	data: {
		personalData: Record<string, any>[]
		pseudonymizedData?: Record<string, any>[]
		metadata?: Record<string, any>
	}
	summary: {
		totalRecords: number
		categories: string[]
		dateRange: {
			startDate: string
			endDate: string
		}
	}
	downloadUrl?: string
	expiresAt: string
}

/**
 * Pseudonymization parameters
 */
export interface PseudonymizationParams {
	dataSubjectIds: string[]
	organizationId: string
	fields: string[]
	method: 'hash' | 'encrypt' | 'tokenize' | 'mask'
	preserveFormat?: boolean
	saltValue?: string
	dateRange?: {
		startDate: string
		endDate: string
	}
}

/**
 * Pseudonymization result
 */
export interface PseudonymizationResult {
	operationId: string
	processedAt: string
	method: string
	summary: {
		totalRecords: number
		processedRecords: number
		failedRecords: number
		affectedFields: string[]
	}
	mapping?: Record<string, string>
	errors?: Array<{
		recordId: string
		field: string
		error: string
	}>
}

/**
 * Report template interface
 */
export interface ReportTemplate {
	id: string
	name: string
	description: string
	category: 'hipaa' | 'gdpr' | 'custom' | 'security' | 'audit'
	version: string
	parameters: Array<{
		name: string
		type: 'string' | 'number' | 'boolean' | 'date' | 'array'
		required: boolean
		description: string
		defaultValue?: any
		options?: any[]
	}>
	outputFormats: ('json' | 'csv' | 'pdf' | 'xlsx')[]
	createdAt: string
	updatedAt: string
	isActive: boolean
}

/**
 * Report download options
 */
export interface ReportDownloadOptions {
	format: 'pdf' | 'csv' | 'json' | 'xlsx'
	includeCharts?: boolean
	includeMetadata?: boolean
	compression?: 'none' | 'gzip' | 'zip'
}

/**
 * Schedule configuration interface
 */
export interface ScheduleConfig {
	frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
	dayOfWeek?: number // 0-6 (Sunday-Saturday) for weekly
	dayOfMonth?: number // 1-31 for monthly/quarterly
	hour: number // 0-23
	minute: number // 0-59
	timezone: string // IANA timezone identifier
}

/**
 * Delivery configuration interface
 */
export interface DeliveryConfig {
	method: 'email' | 'webhook' | 'storage'
	config: {
		recipients?: string[] // For email delivery
		webhookUrl?: string // For webhook delivery
		storageLocation?: string // For storage delivery
	}
}

/**
 * Report criteria interface for scheduled reports
 */
export interface ScheduledReportCriteria {
	dateRange: {
		startDate: string
		endDate: string
	}
	organizationIds?: string[]
	principalIds?: string[]
	resourceTypes?: string[]
	actions?: string[]
	dataClassifications?: ('PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI')[]
	includeDetails?: boolean
	includeMetadata?: boolean
	format: 'json' | 'csv' | 'pdf' | 'xlsx'
}

/**
 * Scheduled report interface
 */
export interface ScheduledReport {
	id: string
	name: string
	description?: string
	reportType: 'hipaa' | 'gdpr' | 'custom' | 'integrity'
	criteria: ScheduledReportCriteria
	schedule: ScheduleConfig
	deliveryConfig: DeliveryConfig
	isActive: boolean
	createdAt: string
	updatedAt: string
	lastExecution?: string
	nextExecution: string
	createdBy: string
	organizationId: string
}

/**
 * Create scheduled report input interface
 */
export interface CreateScheduledReportInput {
	name: string
	description?: string
	reportType: 'hipaa' | 'gdpr' | 'custom' | 'integrity'
	criteria: ScheduledReportCriteria
	schedule: ScheduleConfig
	deliveryConfig: DeliveryConfig
	isActive?: boolean
}

/**
 * Update scheduled report input interface
 */
export interface UpdateScheduledReportInput {
	name?: string
	description?: string
	criteria?: Partial<ScheduledReportCriteria>
	schedule?: Partial<ScheduleConfig>
	deliveryConfig?: Partial<DeliveryConfig>
	isActive?: boolean
}

/**
 * List scheduled reports parameters
 */
export interface ListScheduledReportsParams {
	organizationId?: string
	reportType?: 'hipaa' | 'gdpr' | 'custom' | 'integrity'
	isActive?: boolean
	createdBy?: string
	limit?: number
	offset?: number
	sortBy?: 'name' | 'createdAt' | 'lastExecution' | 'nextExecution'
	sortOrder?: 'asc' | 'desc'
}

/**
 * Paginated scheduled reports response
 */
export interface PaginatedScheduledReports {
	reports: ScheduledReport[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
}

/**
 * Report execution interface
 */
export interface ReportExecution {
	id: string
	reportId: string
	startedAt: string
	completedAt?: string
	status: 'pending' | 'running' | 'completed' | 'failed'
	progress?: number
	error?: string
	downloadUrl?: string
	fileSize?: number
	recordCount?: number
}

/**
 * Execution history parameters
 */
export interface ExecutionHistoryParams {
	limit?: number
	offset?: number
	status?: 'pending' | 'running' | 'completed' | 'failed'
	dateRange?: {
		startDate: string
		endDate: string
	}
	sortBy?: 'startedAt' | 'completedAt' | 'status'
	sortOrder?: 'asc' | 'desc'
}

/**
 * Paginated executions response
 */
export interface PaginatedExecutions {
	executions: ReportExecution[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
}

/**
 * Validation rule interface for preset field validation
 */
export interface ValidationRule {
	type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'url' | 'date'
	required?: boolean
	minLength?: number
	maxLength?: number
	min?: number
	max?: number
	pattern?: string
	enum?: string[]
	customValidator?: (value: any) => boolean | string
}

/**
 * Audit preset template interface
 */
export interface AuditPresetTemplate {
	action: string
	targetResourceType: string
	dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
	defaultDetails?: Record<string, any>
	defaultStatus?: 'attempt' | 'success' | 'failure'
	defaultOutcomeDescription?: string
}

/**
 * Audit preset validation configuration
 */
export interface AuditPresetValidation {
	requiredFields: string[]
	optionalFields: string[]
	fieldValidation: Record<string, ValidationRule>
	customValidation?: (context: PresetContext) => ValidationResult
}

/**
 * Audit preset metadata
 */
export interface AuditPresetMetadata {
	createdAt: string
	updatedAt: string
	version: string
	tags: string[]
	author?: string
	description?: string
	category?: string
	usageCount?: number
	lastUsed?: string
}

/**
 * Complete audit preset interface
 */
export interface AuditPreset {
	name: string
	description?: string
	template: AuditPresetTemplate
	validation: AuditPresetValidation
	metadata: AuditPresetMetadata
}

/**
 * Input for creating a new audit preset
 */
export interface CreateAuditPresetInput {
	name: string
	description?: string
	template: AuditPresetTemplate
	validation: AuditPresetValidation
	tags?: string[]
	category?: string
}

/**
 * Input for updating an existing audit preset
 */
export interface UpdateAuditPresetInput {
	description?: string
	template?: Partial<AuditPresetTemplate>
	validation?: Partial<AuditPresetValidation>
	tags?: string[]
	category?: string
}

/**
 * Context for applying a preset to create an audit event
 */
export interface PresetContext {
	principalId: string
	organizationId: string
	targetResourceId?: string
	sessionContext?: {
		sessionId?: string
		ipAddress?: string
		userAgent?: string
		location?: string
	}
	customDetails?: Record<string, any>
	overrides?: {
		action?: string
		targetResourceType?: string
		dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
		status?: 'attempt' | 'success' | 'failure'
		outcomeDescription?: string
	}
}

/**
 * Result of preset validation
 */
export interface ValidationResult {
	isValid: boolean
	errors: Array<{
		field: string
		message: string
		code: string
	}>
	warnings?: Array<{
		field: string
		message: string
		code: string
	}>
}

/**
 * Result of applying a preset to create an audit event
 */
export interface PresetApplicationResult {
	success: boolean
	auditEvent?: {
		id: string
		timestamp: string
		action: string
		targetResourceType: string
		targetResourceId?: string
		principalId: string
		organizationId: string
		status: 'attempt' | 'success' | 'failure'
		outcomeDescription?: string
		dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
		details?: Record<string, any>
		correlationId?: string
	}
	validationResult: ValidationResult
	errors?: Array<{
		message: string
		code: string
		details?: any
	}>
}

/**
 * Parameters for listing audit presets
 */
export interface ListAuditPresetsParams {
	category?: string
	tags?: string[]
	search?: string
	includeMetadata?: boolean
	sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'usageCount'
	sortOrder?: 'asc' | 'desc'
	limit?: number
	offset?: number
}

/**
 * Paginated list of audit presets
 */
export interface PaginatedAuditPresets {
	presets: AuditPreset[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
	metadata?: {
		queryTime: number
		totalCategories: number
		totalTags: number
	}
}

/**
 * Preset versioning information
 */
export interface PresetVersion {
	version: string
	createdAt: string
	changes: string[]
	author?: string
	preset: AuditPreset
}

/**
 * Preset version history
 */
export interface PresetVersionHistory {
	presetName: string
	currentVersion: string
	versions: PresetVersion[]
	totalVersions: number
}

/**
 * Preset usage statistics
 */
export interface PresetUsageStats {
	presetName: string
	totalUsage: number
	usageByPeriod: Array<{
		period: string
		count: number
	}>
	topUsers: Array<{
		principalId: string
		count: number
	}>
	successRate: number
	averageExecutionTime: number
	lastUsed: string
}

/**
 * Memory usage metrics
 */
export interface MemoryUsage {
	used: number
	free: number
	total: number
	percentage: number
}

/**
 * CPU usage metrics
 */
export interface CpuUsage {
	percentage: number
	loadAverage: number[]
	cores: number
}

/**
 * Database metrics
 */
export interface DatabaseMetrics {
	connectionCount: number
	activeQueries: number
	averageQueryTime: number
	slowQueries: number
	totalQueries: number
	errorRate: number
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
	hitRate: number
	missRate: number
	evictionRate: number
	memoryUsage: number
	totalRequests: number
	totalHits: number
	totalMisses: number
}

/**
 * API metrics
 */
export interface ApiMetrics {
	requestsPerSecond: number
	averageResponseTime: number
	errorRate: number
	activeConnections: number
	totalRequests: number
	totalErrors: number
	endpointStats: Record<string, EndpointStats>
}

/**
 * Endpoint-specific statistics
 */
export interface EndpointStats {
	requestCount: number
	averageResponseTime: number
	errorCount: number
	errorRate: number
	lastAccessed: string
}

/**
 * System metrics interface
 */
export interface SystemMetrics {
	timestamp: string
	server: {
		uptime: number
		memoryUsage: MemoryUsage
		cpuUsage: CpuUsage
		diskUsage?: {
			used: number
			free: number
			total: number
			percentage: number
		}
	}
	database: DatabaseMetrics
	cache: CacheMetrics
	api: ApiMetrics
}

/**
 * Audit-specific metrics
 */
export interface AuditMetrics {
	timestamp: string
	timeRange: {
		startDate: string
		endDate: string
	}
	eventsProcessed: number
	processingLatency: {
		average: number
		p50: number
		p95: number
		p99: number
		min: number
		max: number
	}
	integrityVerifications: {
		total: number
		passed: number
		failed: number
		averageTime: number
		successRate: number
	}
	complianceReports: {
		generated: number
		scheduled: number
		failed: number
		averageGenerationTime: number
	}
	errorRates: {
		total: number
		byType: Record<string, number>
		byEndpoint: Record<string, number>
		byStatus: Record<string, number>
	}
	dataClassificationStats: {
		PUBLIC: number
		INTERNAL: number
		CONFIDENTIAL: number
		PHI: number
	}
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
	timestamp: string
	responseTime: {
		average: number
		p50: number
		p95: number
		p99: number
		min: number
		max: number
	}
	throughput: {
		requestsPerSecond: number
		eventsPerSecond: number
		reportsPerHour: number
	}
	resourceUtilization: {
		cpu: number
		memory: number
		disk: number
		network: {
			bytesIn: number
			bytesOut: number
			packetsIn: number
			packetsOut: number
		}
	}
	concurrency: {
		activeConnections: number
		queuedRequests: number
		processingThreads: number
	}
}

/**
 * Usage metrics parameters
 */
export interface UsageMetricsParams {
	timeRange?: {
		startDate: string
		endDate: string
	}
	granularity?: 'hour' | 'day' | 'week' | 'month'
	includeBreakdown?: boolean
}

/**
 * Usage metrics interface
 */
export interface UsageMetrics {
	timestamp: string
	timeRange: {
		startDate: string
		endDate: string
	}
	apiUsage: {
		totalRequests: number
		uniqueUsers: number
		topEndpoints: Array<{
			endpoint: string
			requestCount: number
			percentage: number
		}>
		rateLimitHits: number
		quotaUsage: {
			current: number
			limit: number
			percentage: number
		}
	}
	auditEvents: {
		totalEvents: number
		eventsByType: Record<string, number>
		eventsByOrganization: Record<string, number>
		eventsByDataClassification: Record<string, number>
	}
	reports: {
		totalGenerated: number
		reportsByType: Record<string, number>
		scheduledReports: number
		onDemandReports: number
	}
	storage: {
		totalSize: number
		growthRate: number
		retentionCompliance: number
	}
}

/**
 * Alert severity levels
 */
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

/**
 * Alert types for categorization
 */
export type AlertType = 'SECURITY' | 'COMPLIANCE' | 'PERFORMANCE' | 'SYSTEM' | 'METRICS'

/**
 * Alert interface
 */
export interface Alert {
	id: string
	organizationId: string
	title: string
	description: string
	severity: AlertSeverity
	type: AlertType
	source: string
	category: string
	createdAt: string
	updatedAt: string
	acknowledgedAt?: string
	acknowledgedBy?: string
	resolvedAt?: string
	resolvedBy?: string
	resolution?: string
	metadata: Record<string, any>
	affectedResources?: string[]
	relatedAlerts?: string[]
}

/**
 * Alert query parameters
 */
export interface AlertsParams {
	type?: AlertType[]
	severity?: AlertSeverity[]
	category?: string[]
	source?: string[]
	timeRange?: {
		startDate: string
		endDate: string
	}
	pagination?: {
		limit?: number
		offset?: number
	}
	sort?: {
		field: 'createdAt' | 'updatedAt' | 'severity' | 'status'
		direction: 'asc' | 'desc'
	}
}

/**
 * Paginated alerts response
 */
export interface PaginatedAlerts {
	alerts: Alert[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
	summary: {
		totalActive: number
		totalAcknowledged: number
		totalResolved: number
		bySeverity: Record<AlertSeverity, number>
		byCategory: Record<string, number>
	}
}

/**
 * Alert Statistics interface
 */
export interface AlertStatistics {
	total: number
	active: number
	acknowledged: number
	resolved: number
	bySeverity: Record<AlertSeverity, number>
	byType: Record<AlertType, number>
}

/**
 * Audit metrics query parameters
 */
export interface AuditMetricsParams {
	timeRange?: {
		startDate: string
		endDate: string
	}
	granularity?: 'hour' | 'day' | 'week' | 'month'
	includeBreakdown?: boolean
	organizationIds?: string[]
	dataClassifications?: string[]
}

/**
 * Real-time metrics subscription parameters
 */
export interface MetricsSubscriptionParams {
	metricsTypes: ('system' | 'audit' | 'performance' | 'usage')[]
	updateInterval?: number // seconds
	includeAlerts?: boolean
}

/**
 * Real-time metrics data
 */
export interface RealTimeMetricsData {
	timestamp: string
	type: 'system' | 'audit' | 'performance' | 'usage' | 'alert'
	data: SystemMetrics | AuditMetrics | PerformanceMetrics | UsageMetrics | Alert
}

/**
 * Metrics subscription interface
 */
export interface MetricsSubscription {
	id: string
	isActive: boolean
	connect(): Promise<void>
	disconnect(): void
	onData(callback: (data: RealTimeMetricsData) => void): void
	onError(callback: (error: Error) => void): void
	onClose(callback: () => void): void
}

/**
 * Alert acknowledgment request
 */
export interface AcknowledgeAlertRequest {
	acknowledgedBy: string
	notes?: string
}

/**
 * Alert resolution request
 */
export interface ResolveAlertRequest {
	resolution: string
}

/**
 * Basic health status response
 */
export interface HealthStatus {
	status: 'healthy' | 'unhealthy' | 'degraded'
	timestamp: string
	environment: string
	uptime: number
	version?: string
}

/**
 * Detailed health status with component breakdown
 */
export interface DetailedHealthStatus {
	status: 'healthy' | 'unhealthy' | 'degraded'
	timestamp: string
	uptime: number
	version: string
	components: {
		database: ComponentHealth
		cache: ComponentHealth
		storage: ComponentHealth
		authentication: ComponentHealth
		audit: ComponentHealth
		compliance: ComponentHealth
		[key: string]: ComponentHealth
	}
	dependencies: ServiceDependency[]
	metrics: {
		responseTime: number
		memoryUsage: number
		cpuUsage: number
		activeConnections: number
	}
}

/**
 * Individual component health status
 */
export interface ComponentHealth {
	status: 'healthy' | 'unhealthy' | 'degraded'
	lastChecked: string
	responseTime?: number
	errorMessage?: string
	details?: Record<string, any>
}

/**
 * Service dependency health information
 */
export interface ServiceDependency {
	name: string
	type: 'database' | 'cache' | 'external_api' | 'storage' | 'queue'
	status: 'healthy' | 'unhealthy' | 'degraded'
	url?: string
	lastChecked: string
	responseTime?: number
	errorMessage?: string
	version?: string
}

/**
 * Readiness probe response
 */
export interface ReadinessStatus {
	ready: boolean
	timestamp: string
	checks: {
		database: boolean
		cache: boolean
		storage: boolean
		authentication: boolean
		migrations: boolean
		[key: string]: boolean
	}
	failedChecks?: string[]
	message?: string
}

/**
 * Liveness probe response
 */
export interface LivenessStatus {
	alive: boolean
	timestamp: string
	uptime: number
	lastActivity: string
	message?: string
}

/**
 * API version and build information
 */
export interface VersionInfo {
	version: string
	buildDate: string
	gitCommit?: string
	gitBranch?: string
	environment: string
	apiVersion: string
	features: string[]
	dependencies: {
		[key: string]: string
	}
}

/**
 * API status information
 */
export interface ApiStatus {
	status: 'operational' | 'degraded' | 'maintenance' | 'outage'
	timestamp: string
	endpoints: {
		[endpoint: string]: {
			status: 'operational' | 'degraded' | 'down'
			responseTime: number
			errorRate: number
			lastChecked: string
		}
	}
	rateLimit: {
		current: number
		limit: number
		resetTime: string
	}
	maintenance?: {
		scheduled: boolean
		startTime?: string
		endTime?: string
		message?: string
	}
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
	timeout?: number
	includeDetails?: boolean
	checkDependencies?: boolean
	componentChecks?: string[]
}

/**
 * Health monitoring subscription parameters
 */
export interface HealthSubscriptionParams {
	interval?: number // seconds
	includeMetrics?: boolean
	alertOnStatusChange?: boolean
	components?: string[]
}

/**
 * Real-time health data
 */
export interface RealTimeHealthData {
	timestamp: string
	type: 'status_change' | 'metric_update' | 'alert'
	data: HealthStatus | DetailedHealthStatus | ComponentHealth
	previousStatus?: string
	component?: string
}

/**
 * Health monitoring subscription interface
 */
export interface HealthSubscription {
	id: string
	isActive: boolean
	connect(): Promise<void>
	disconnect(): void
	onData(callback: (data: RealTimeHealthData) => void): void
	onError(callback: (error: Error) => void): void
	onClose(callback: () => void): void
}

/**
 * Session context information for audit events
 */
export interface SessionContext {
	sessionId: string
	ipAddress: string
	userAgent: string
	geolocation?: string
}

/**
 * Data classification levels for audit events
 */
export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'

/**
 * Audit event status types
 */
export type AuditEventStatus = 'attempt' | 'success' | 'failure'

/**
 * Complete audit event interface
 */
export interface AuditEvent {
	id: string
	timestamp: string
	action: string
	targetResourceType: string
	targetResourceId?: string
	principalId: string
	organizationId: string
	status: AuditEventStatus
	outcomeDescription?: string
	dataClassification: DataClassification
	details?: Record<string, any>
	hash?: string
	correlationId?: string
	sessionContext?: SessionContext
}

/**
 * Input interface for creating audit events
 */
export interface CreateAuditEventInput {
	action: string
	targetResourceType: string
	targetResourceId?: string
	principalId: string
	organizationId: string
	status: AuditEventStatus
	outcomeDescription?: string
	dataClassification: DataClassification
	sessionContext?: SessionContext
	details?: Record<string, any>
}

export interface CreateAuditEventOptions {
	priority?: number
	delay?: number
	durabilityGuarantees?: boolean
	generateHash?: boolean
	generateSignature?: boolean
	correlationId?: string
	eventVersion?: string
	skipValidation?: boolean
	validationConfig?: ValidationConfig
}

/**
 * Configuration for validation rules
 */
export interface ValidationConfig {
	maxStringLength: number
	allowedDataClassifications: DataClassification[]
	requiredFields: Array<keyof AuditEvent>
	maxCustomFieldDepth: number
	allowedEventVersions: string[]
}

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
	maxStringLength: 10000,
	allowedDataClassifications: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'],
	requiredFields: ['timestamp', 'action', 'status'],
	maxCustomFieldDepth: 3,
	allowedEventVersions: ['1.0', '1.1', '2.0'],
}

/**
 * Bulk create input interface
 */
export interface BulkCreateAuditEventsInput {
	events: CreateAuditEventInput[]
}

/**
 * Bulk create result interface
 */
export interface BulkCreateResult {
	requestId: string
	total: number
	successful: number
	failed: number
	results: Array<{
		success: boolean
		event?: AuditEvent
		error?: string
		index: number
	}>
	processingTime: number
}

/**
 * Query parameters for audit events
 */
export interface QueryAuditEventsParams {
	filter?: {
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
		verifiedOnly?: boolean
		correlationId?: string
	}
	pagination?: {
		limit?: number
		offset?: number
	}
	sort?: {
		field: 'timestamp' | 'status' | 'action'
		direction: 'asc' | 'desc'
	}
}

/**
 * Paginated audit events response
 */
export interface PaginatedAuditEvents {
	events: AuditEvent[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
	metadata?: {
		queryTime: number
		cacheHit: boolean
		totalFiltered: number
	}
}

/**
 * Integrity verification result
 */
export interface IntegrityVerificationResult {
	eventId: string
	isValid: boolean
	verificationTimestamp: string
	hashAlgorithm: string
	computedHash: string
	storedHash: string
	details?: {
		signatureValid?: boolean
		chainIntegrity?: boolean
		timestampValid?: boolean
	}
}

/**
 * Export parameters
 */
export interface ExportEventsParams {
	filter?: QueryAuditEventsParams['filter']
	format: 'json' | 'csv' | 'xml'
	includeMetadata?: boolean
	compression?: 'gzip' | 'zip' | 'none'
	encryption?: {
		enabled: boolean
		algorithm?: string
		publicKey?: string
	}
}

/**
 * Export result
 */
export interface ExportResult {
	exportId: string
	recordCount: number
	dataSize: number
	format: string
	exportTimestamp: string
	downloadUrl?: string
	expiresAt?: string
	metadata?: {
		compression?: string
		encryption?: boolean
		checksum?: string
	}
}

/**
 * Stream parameters for large datasets
 */
export interface StreamEventsParams {
	filter?: QueryAuditEventsParams['filter']
	batchSize?: number
	format?: 'json' | 'ndjson'
}

/**
 * Subscription parameters for real-time events
 */
export interface SubscriptionParams {
	filter?: {
		actions?: string[]
		principalIds?: string[]
		organizationIds?: string[]
		resourceTypes?: string[]
		dataClassifications?: DataClassification[]
		statuses?: AuditEventStatus[]
	}
	transport?: 'websocket' | 'sse' | 'polling'
	reconnect?: boolean
	maxReconnectAttempts?: number
	heartbeatInterval?: number
}
