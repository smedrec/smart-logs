// ============================================================================
// Convenience Type Unions
// ============================================================================

import { AuditClientConfig } from '../core/config'

import type {
	AuditEvent,
	BulkCreateResult,
	CreateAuditEventInput,
	ExportResult,
	IntegrityVerificationResult,
	PaginatedAuditEvents,
	QueryAuditEventsParams,
} from './api'
import type {
	ComplianceReportEvent,
	CustomReport,
	GdprExportResult,
	GDPRReport,
	HIPAAReport,
	IntegrityFailure,
	IntegrityVerificationReport,
	PseudonymizationResult,
	ReportCriteria,
	SuspiciousPattern,
} from './compliance'
import type {
	Alert,
	AuditMetrics,
	PaginatedAlerts,
	PerformanceMetrics,
	SystemMetrics,
	UsageMetrics,
} from './metrics'
import type {
	AuditPreset,
	CreateAuditPresetInput,
	PresetApplicationResult,
	PresetContext,
	UpdateAuditPresetInput,
} from './presets'
import type {
	CreateScheduledReportInput,
	DeliveryAttempt,
	DeliveryStatus,
	PaginatedExecutions,
	ReportExecution,
	ScheduledReport,
	UpdateScheduledReportInput,
} from './scheduled-reports'

// ============================================================================
// Main Types Export File
// ============================================================================

// Re-export all API types
export * from './api'

// Re-export all compliance types
export * from './compliance'

// Re-export all scheduled reports types
export * from './scheduled-reports'

// Re-export all presets types
export * from './presets'

// Re-export all metrics types
export * from './metrics'

// Re-export all health types
export * from './health'

// Re-export utility types
export * from './utils'

/**
 * Union type for all report types
 */
export type Report = HIPAAReport | GDPRReport | CustomReport

/**
 * Union type for all metric types
 */
export type Metrics = SystemMetrics | AuditMetrics | PerformanceMetrics | UsageMetrics

/**
 * Union type for all paginated response types
 */
export type PaginatedResponse = PaginatedAuditEvents | PaginatedExecutions | PaginatedAlerts

/**
 * Union type for all create input types
 */
export type CreateInput =
	| CreateAuditEventInput
	| CreateScheduledReportInput
	| CreateAuditPresetInput

/**
 * Union type for all update input types
 */
export type UpdateInput = UpdateScheduledReportInput | UpdateAuditPresetInput

/**
 * Union type for all result types
 */
export type OperationResult =
	| AuditEvent
	| BulkCreateResult
	| ExportResult
	| IntegrityVerificationResult
	| Report
	| GdprExportResult
	| PseudonymizationResult
	| ScheduledReport
	| ReportExecution
	| AuditPreset
	| PresetApplicationResult
	| Metrics
	| Alert

// ============================================================================
// Generic Response Wrapper Types
// ============================================================================

/**
 * Generic success response wrapper
 */
export interface SuccessResponse<T = unknown> {
	success: true
	data: T
	metadata?: {
		timestamp: string
		correlationId?: string
		version?: string
		requestId?: string
	}
}

/**
 * Generic error response wrapper
 */
export interface ErrorResponse {
	success: false
	error: {
		code: string
		message: string
		details?: Record<string, unknown>
		correlationId?: string
		timestamp: string
		path?: string
		method?: string
	}
	metadata?: {
		timestamp: string
		correlationId?: string
		version?: string
		requestId?: string
	}
}

/**
 * Generic API response type
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

// ============================================================================
// Request and Response Interceptor Types
// ============================================================================

/**
 * Request interceptor function type
 */
export interface RequestInterceptor {
	(config: RequestConfig): Promise<RequestConfig> | RequestConfig
}

/**
 * Response interceptor function type
 */
export interface ResponseInterceptor {
	(response: ResponseData): Promise<ResponseData> | ResponseData
}

/**
 * Request configuration for interceptors
 */
export interface RequestConfig {
	url: string
	method: string
	headers: Record<string, string>
	body?: unknown
	query?: Record<string, unknown>
	metadata?: Record<string, unknown>
}

/**
 * Response data for interceptors
 */
export interface ResponseData {
	status: number
	statusText: string
	headers: Record<string, string>
	data: unknown
	config: RequestConfig
	metadata?: Record<string, unknown>
}

// ============================================================================
// Client Configuration Types
// ============================================================================

/**
 * Re-export configuration types for convenience
 */
export type {
	AuditClientConfig,
	PartialAuditClientConfig,
	AuthenticationConfig,
	RetryConfig,
	CacheConfig,
	BatchingConfig,
	PerformanceConfig,
	LoggingConfig,
	ErrorHandlingConfig,
	InterceptorConfig,
	EnvironmentConfig,
	ConfigValidationResult,
} from '../core/config'

// ============================================================================
// Infrastructure Types
// ============================================================================

/**
 * Re-export infrastructure types for convenience
 */
export type { CacheStorage, CacheStats } from '../infrastructure/cache'
export type { ErrorContext, ErrorRecoveryStrategy } from '../infrastructure/error'
export type {
	Logger,
	LogLevel,
	LogFormat,
	LogEntry,
	LoggerConfig,
	CustomLogger,
} from '../infrastructure/logger'

// ============================================================================
// Service Interface Types
// ============================================================================

/**
 * Base service interface
 */
export interface BaseService {
	readonly serviceName: string
	readonly version: string
	isHealthy(): Promise<boolean>
}

/**
 * Events service interface
 */
export interface IEventsService extends BaseService {
	create(event: CreateAuditEventInput): Promise<AuditEvent>
	bulkCreate(events: CreateAuditEventInput[]): Promise<BulkCreateResult>
	query(params?: QueryAuditEventsParams): Promise<PaginatedAuditEvents>
	getById(id: string): Promise<AuditEvent | null>
	verify(id: string): Promise<IntegrityVerificationResult>
	export(params: import('./api').ExportEventsParams): Promise<ExportResult>
	stream(params: import('./api').StreamEventsParams): Promise<ReadableStream<AuditEvent>>
	subscribe(params: import('./api').SubscriptionParams): import('./api').EventSubscription
}

/**
 * Compliance service interface
 */
export interface IComplianceService extends BaseService {
	generateHipaaReport(criteria: ReportCriteria): Promise<HIPAAReport>
	generateGdprReport(criteria: ReportCriteria): Promise<GDPRReport>
	generateCustomReport(params: import('./compliance').CustomReportParams): Promise<CustomReport>
	exportGdprData(params: import('./compliance').GdprExportParams): Promise<GdprExportResult>
	pseudonymizeData(
		params: import('./compliance').PseudonymizationParams
	): Promise<PseudonymizationResult>
	getReportTemplates(): Promise<import('./compliance').ReportTemplate[]>
	downloadReport(reportId: string, format: import('./compliance').ReportFormat): Promise<Blob>
}

/**
 * Scheduled reports service interface
 */
export interface IScheduledReportsService extends BaseService {
	list(
		params?: import('./scheduled-reports').ListScheduledReportsParams
	): Promise<import('./scheduled-reports').PaginatedScheduledReports>
	create(report: CreateScheduledReportInput): Promise<ScheduledReport>
	update(id: string, updates: UpdateScheduledReportInput): Promise<ScheduledReport>
	delete(id: string): Promise<void>
	execute(id: string): Promise<ReportExecution>
	getExecutionHistory(
		id: string,
		params?: import('./scheduled-reports').ExecutionHistoryParams
	): Promise<PaginatedExecutions>
}

/**
 * Presets service interface
 */
export interface IPresetsService extends BaseService {
	list(): Promise<AuditPreset[]>
	get(name: string): Promise<AuditPreset | null>
	create(preset: CreateAuditPresetInput): Promise<AuditPreset>
	update(name: string, updates: UpdateAuditPresetInput): Promise<AuditPreset>
	delete(name: string): Promise<void>
	apply(name: string, context: PresetContext): Promise<PresetApplicationResult>
}

/**
 * Metrics service interface
 */
export interface IMetricsService extends BaseService {
	getSystemMetrics(): Promise<SystemMetrics>
	getAuditMetrics(params: import('./metrics').AuditMetricsParams): Promise<AuditMetrics>
	getPerformanceMetrics(): Promise<PerformanceMetrics>
	getUsageMetrics(params: import('./metrics').UsageMetricsParams): Promise<UsageMetrics>
	getAlerts(params?: import('./metrics').AlertsParams): Promise<PaginatedAlerts>
	acknowledgeAlert(id: string): Promise<void>
	resolveAlert(id: string, resolution: string): Promise<void>
}

/**
 * Health service interface
 */
export interface IHealthService extends BaseService {
	check(): Promise<import('./health').HealthStatus>
	detailed(): Promise<import('./health').DetailedHealthStatus>
	ready(): Promise<import('./health').ReadinessStatus>
	getVersion(): Promise<import('./health').VersionInfo>
}

// ============================================================================
// Main Client Interface
// ============================================================================

/**
 * Main audit client interface
 */
export interface IAuditClient {
	readonly config: AuditClientConfig
	readonly events: IEventsService
	readonly compliance: IComplianceService
	readonly scheduledReports: IScheduledReportsService
	readonly presets: IPresetsService
	readonly metrics: IMetricsService
	readonly health: IHealthService

	// Client lifecycle
	initialize(): Promise<void>
	destroy(): Promise<void>
	isInitialized(): boolean

	// Configuration management
	updateConfig(updates: Partial<AuditClientConfig>): void
	getConfig(): AuditClientConfig

	// Health and status
	isHealthy(): Promise<boolean>
	getStatus(): Promise<{
		initialized: boolean
		healthy: boolean
		services: Record<string, boolean>
		version: string
	}>
}

// ============================================================================
// Event Emitter Types
// ============================================================================

/**
 * Client event types
 */
export interface ClientEvents {
	initialized: () => void
	destroyed: () => void
	error: (error: Error) => void
	'config-updated': (config: AuditClientConfig) => void
	'request-start': (config: RequestConfig) => void
	'request-success': (response: ResponseData) => void
	'request-error': (error: Error, config: RequestConfig) => void
	'cache-hit': (key: string) => void
	'cache-miss': (key: string) => void
	'retry-attempt': (attempt: number, error: Error) => void
	'batch-executed': (batchSize: number, duration: number) => void
}

/**
 * Event emitter interface for the client
 */
export interface IEventEmitter<T extends Record<string, (...args: any[]) => void>> {
	on<K extends keyof T>(event: K, listener: T[K]): void
	off<K extends keyof T>(event: K, listener: T[K]): void
	emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void
	removeAllListeners(event?: keyof T): void
}

// ============================================================================
// Plugin and Extension Types
// ============================================================================

/**
 * Plugin interface
 */
export interface IPlugin {
	readonly name: string
	readonly version: string
	readonly description?: string

	install(client: IAuditClient): Promise<void> | void
	uninstall(client: IAuditClient): Promise<void> | void
}

/**
 * Middleware function type
 */
export interface Middleware {
	(context: MiddlewareContext, next: () => Promise<void>): Promise<void>
}

/**
 * Middleware context
 */
export interface MiddlewareContext {
	request: RequestConfig
	response?: ResponseData
	error?: Error
	metadata: Record<string, unknown>
}

// ============================================================================
// Testing and Mocking Types
// ============================================================================

/**
 * Mock configuration for testing
 */
export interface MockConfig {
	enabled: boolean
	responses: Record<string, unknown>
	delays: Record<string, number>
	errors: Record<string, Error>
	interceptors: {
		request?: RequestInterceptor[]
		response?: ResponseInterceptor[]
	}
}

/**
 * Test utilities interface
 */
export interface ITestUtils {
	createMockClient(config?: Partial<AuditClientConfig>): IAuditClient
	createMockResponse<T>(data: T): SuccessResponse<T>
	createMockError(code: string, message: string): ErrorResponse
	setupMockServer(config: MockConfig): void
	teardownMockServer(): void
}

// ============================================================================
// Utility Type Helpers
// ============================================================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Make specific properties optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Extract the data type from a paginated response
 */
export type ExtractPaginatedData<T> = T extends { data: infer U } ? U : never

/**
 * Extract the item type from an array
 */
export type ArrayItem<T> = T extends (infer U)[] ? U : never

/**
 * Create a type with only the specified keys
 */
export type PickByType<T, U> = {
	[K in keyof T as T[K] extends U ? K : never]: T[K]
}

/**
 * Create a type without the specified keys
 */
export type OmitByType<T, U> = {
	[K in keyof T as T[K] extends U ? never : K]: T[K]
}

/**
 * Flatten nested object types
 */
export type Flatten<T> = T extends object
	? T extends infer O
		? { [K in keyof O]: Flatten<O[K]> }
		: never
	: T

/**
 * Create a union of all possible keys in a nested object
 */
export type NestedKeys<T> = T extends object
	? {
			[K in keyof T]: K extends string
				? T[K] extends object
					? `${K}` | `${K}.${NestedKeys<T[K]>}`
					: `${K}`
				: never
		}[keyof T]
	: never

/**
 * Get the type of a nested property
 */
export type NestedValue<T, K extends string> = K extends `${infer P}.${infer S}`
	? P extends keyof T
		? NestedValue<T[P], S>
		: never
	: K extends keyof T
		? T[K]
		: never

// ============================================================================
// Brand Types for Type Safety
// ============================================================================

/**
 * Brand type for creating nominal types
 */
export type Brand<T, B> = T & { __brand: B }

/**
 * Branded string types for better type safety
 */
export type UUID = Brand<string, 'UUID'>
export type Email = Brand<string, 'Email'>
export type URL = Brand<string, 'URL'>
export type ISODateTime = Brand<string, 'ISODateTime'>
export type Base64 = Brand<string, 'Base64'>
export type JSONString = Brand<string, 'JSONString'>

/**
 * Type guards for branded types
 */
export const isUUID = (value: string): value is UUID => {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export const isEmail = (value: string): value is Email => {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export const isURL = (value: string): value is URL => {
	try {
		new URL(value)
		return true
	} catch {
		return false
	}
}

export const isISODateTime = (value: string): value is ISODateTime => {
	return (
		!isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)
	)
}

// ============================================================================
// Conditional Types for Advanced Type Manipulation
// ============================================================================

/**
 * Check if a type is a function
 */
export type IsFunction<T> = T extends (...args: any[]) => any ? true : false

/**
 * Check if a type is an array
 */
export type IsArray<T> = T extends any[] ? true : false

/**
 * Check if a type is a promise
 */
export type IsPromise<T> = T extends Promise<any> ? true : false

/**
 * Extract promise type
 */
export type PromiseType<T> = T extends Promise<infer U> ? U : T

/**
 * Extract function return type
 */
export type FunctionReturnType<T> = T extends (...args: any[]) => infer R ? R : never

/**
 * Extract function parameters
 */
export type FunctionParameters<T> = T extends (...args: infer P) => any ? P : never

/**
 * Create a type that represents all possible error types
 */
export type AuditClientError =
	| import('../infrastructure/error').AuditClientError
	| import('../infrastructure/error').HttpError
	| import('../infrastructure/error').NetworkError
	| import('../infrastructure/error').TimeoutError
	| import('../infrastructure/error').ValidationError
	| import('../infrastructure/error').AuthenticationError
	| import('../infrastructure/error').ConfigurationError
	| import('../infrastructure/error').RetryExhaustedError
	| import('../infrastructure/error').CacheError
	| import('../infrastructure/error').BatchError

// ============================================================================
// Export Type Utilities
// ============================================================================

export * from './utils'
