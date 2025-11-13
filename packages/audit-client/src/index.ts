// Main exports for the enhanced audit client library

// Core exports
export { AuditClient } from './core/client'
export { BaseResource } from './core/base-resource'
export { ConfigManager, ConfigurationError } from './core/config'
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
	PluginConfig,
	EnvironmentConfig,
	ConfigValidationResult,
} from './core/config'

// Base resource exports
export type { RequestOptions } from './core/base-resource'

// Infrastructure exports
export { AuthManager, AuthenticationError } from './infrastructure/auth'
export {
	CacheManager,
	MemoryCache,
	LocalStorageCache,
	SessionStorageCache,
} from './infrastructure/cache'
export type { CacheStorage, CacheStats } from './infrastructure/cache'
export {
	RetryManager,
	RetryExhaustedError,
	HttpError,
	CircuitBreakerOpenError,
} from './infrastructure/retry'
export type { RetryContext, RetryResult, CircuitBreakerStats } from './infrastructure/retry'
export { BatchManager } from './infrastructure/batch'
export type {
	BatchableRequest,
	BatchRequestOptions,
	BatchExecutionResult,
	BatchingStats,
} from './infrastructure/batch'
export {
	ErrorHandler,
	AuditClientError,
	NetworkError,
	TimeoutError,
	ValidationError,
	CacheError,
	BatchError,
	GenericError,
	AuthTokenRefreshStrategy,
	CacheInvalidationStrategy,
} from './infrastructure/error'
export type { ErrorContext, ErrorRecoveryStrategy } from './infrastructure/error'

// Interceptor system exports
export {
	InterceptorManager,
	RequestInterceptorManager,
	ResponseInterceptorManager,
} from './infrastructure/interceptors'
export type {
	InterceptorContext,
	InterceptorRegistrationOptions,
	InterceptorExecutionResult,
	InterceptorChainStats,
} from './infrastructure/interceptors'

// Built-in interceptors
export {
	BuiltInInterceptorFactory,
	CorrelationIdRequestInterceptor,
	AuthenticationRequestInterceptor,
	TimingRequestInterceptor,
	ValidationRequestInterceptor,
	CompressionRequestInterceptor,
	LoggingResponseInterceptor,
	TransformResponseInterceptor,
	CachingResponseInterceptor,
	ValidationResponseInterceptor,
	ErrorHandlingResponseInterceptor,
} from './infrastructure/interceptors/built-in'

// Plugin system exports
export {
	PluginManager,
	PluginRegistry,
	PluginError,
	PluginRegistrationError,
	PluginConfigurationError,
	PluginExecutionError,
} from './infrastructure/plugins'
export type {
	Plugin,
	MiddlewarePlugin,
	StoragePlugin,
	AuthPlugin,
	PluginContext,
	MiddlewareRequest,
	MiddlewareResponse,
	MiddlewareNext,
	MiddlewareErrorContext,
	PluginCacheStorage,
	StorageStats,
	AuthContext,
	PluginRegistryStats,
} from './infrastructure/plugins'

// Built-in plugins
export {
	BuiltInPluginFactory,
	RequestLoggingPlugin,
	CorrelationIdPlugin,
	RateLimitingPlugin,
	RedisStoragePlugin,
	IndexedDBStoragePlugin,
	JWTAuthPlugin,
	OAuth2AuthPlugin,
	CustomHeaderAuthPlugin,
} from './infrastructure/plugins/built-in'

// Plugin utilities
export {
	validatePlugin,
	validateMiddlewarePlugin,
	validateStoragePlugin,
	validateAuthPlugin,
	discoverPlugins,
	loadPluginsFromConfig,
	resolveDependencies,
	mergePluginConfig,
	validatePluginConfig,
	PluginPerformanceTracker,
} from './infrastructure/plugins/utils'
export type {
	PluginDiscoveryResult,
	PluginLoadResult,
	PluginPerformanceMetrics,
} from './infrastructure/plugins/utils'

// Logging exports
export {
	AuditLogger,
	DefaultLogger,
	LoggerFactory,
	DataMasker,
	LogFormatter,
} from './infrastructure/logger'
export type {
	Logger,
	LogLevel,
	LogFormat,
	LogEntry,
	LoggerConfig,
	CustomLogger,
} from './infrastructure/logger'

// Services exports
export {
	EventsService,
	type AuditEvent,
	type CreateAuditEventInput,
	type BulkCreateAuditEventsInput,
	type BulkCreateResult,
	type QueryAuditEventsParams,
	type PaginatedAuditEvents,
	type IntegrityVerificationResult,
	type ExportEventsParams,
	type ExportResult,
	type StreamEventsParams,
	type SubscriptionParams,
	type EventSubscription,
	type SessionContext,
	type DataClassification,
	type AuditEventStatus,
} from './services'

// Compliance Service exports
export {
	ComplianceService,
	type ComplianceReportEvent,
	type ReportType,
	type ReportCriteria,
	type ReportMetadata,
	type HIPAASection,
	type HIPAAReport,
	type GDPRSection,
	type GDPRReport,
	type CustomReportParams,
	type CustomReport,
	type GdprExportParams,
	type GdprExportResult,
	type PseudonymizationParams,
	type PseudonymizationResult,
	type ReportTemplate,
	type ReportDownloadOptions,
} from './services'

// Scheduled Reports Service exports
export {
	ScheduledReportsService,
	type ScheduleConfig,
	type DeliveryConfig,
	type ScheduledReport,
	type CreateScheduledReportInput,
	type UpdateScheduledReportInput,
	type ListScheduledReportsParams,
	type PaginatedScheduledReports,
	type ReportExecution,
	type ExecutionHistoryParams,
	type ExecutionStatus,
	type PaginatedExecutions,
} from './services'

// Audit Presets Service exports
export {
	PresetsService,
	type ValidationRule,
	type AuditPresetTemplate,
	type AuditPresetValidation,
	type AuditPresetMetadata,
	type AuditPreset,
	type CreateAuditPresetInput,
	type UpdateAuditPresetInput,
	type PresetContext,
	type ValidationResult as PresetValidationResult,
	type PresetApplicationResult,
	type ListAuditPresetsParams,
	type PaginatedAuditPresets,
	type PresetVersion,
	type PresetVersionHistory,
	type PresetUsageStats,
} from './services'

// Metrics Service exports
export {
	MetricsService,
	type MemoryUsage,
	type CpuUsage,
	type DatabaseMetrics,
	type CacheMetrics,
	type ApiMetrics,
	type EndpointStats,
	type SystemMetrics,
	type AuditMetrics,
	type PerformanceMetrics,
	type UsageMetricsParams,
	type UsageMetrics,
	type AlertSeverity,
	type AlertType,
	type Alert,
	type AlertsParams,
	type PaginatedAlerts,
	type AuditMetricsParams,
	type MetricsSubscriptionParams,
	type RealTimeMetricsData,
	type MetricsSubscription,
	type AcknowledgeAlertRequest,
	type ResolveAlertRequest,
} from './services'

// Health Service exports
export {
	HealthService,
	type HealthStatus,
	type DetailedHealthStatus,
	type ComponentHealth,
	type ServiceDependency,
	type ReadinessStatus,
	type LivenessStatus,
	type VersionInfo,
	type ApiStatus,
	type HealthCheckConfig,
	type HealthSubscriptionParams,
	type RealTimeHealthData,
	type HealthSubscription,
} from './services'

// Delivery Service exports
export {
	DeliveryService,
	type DeliveryDestination,
	type CreateDeliveryDestination,
	type UpdateDeliveryDestination,
	type DeliveryDestinationQuery,
	type PaginatedDeliveryDestinations,
	type DeliveryRequest,
	type DeliveryResponse,
	type DeliveryStatusResponse,
	type DeliveryListQuery,
	type PaginatedDeliveries,
	type ValidationResult,
	type ConnectionTestResult,
	type DestinationHealth,
	type DeliveryMetrics,
	type MetricsQuery,
	type DeliveryDestinationType,
	type DeliveryDestinationConfig,
	type DeliveryPayloadType,
	type DeliveryStatus,
	type DestinationDeliveryStatus,
	type DestinationHealthStatus,
	type CircuitBreakerState,
} from './services'

// Export all other services
export * from './services'

// Utils exports (will be implemented in later tasks)
export * from './utils'

// Export all types
export * from './types'

// Export Schemas for the generated types
export {
	CreateScheduledReportInputSchema,
	ListScheduledReportsParamsSchema,
	PaginatedScheduledReportsSchema,
	ScheduledReportSchema,
	UpdateScheduledReportInputSchema,
} from './types/scheduled-reports'
