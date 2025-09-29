// Service layer exports
// This file will export all service classes

// Events Service - Comprehensive audit event management
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
} from './events'

// Compliance Service - HIPAA, GDPR, and custom reporting
export { ComplianceService, type ReportDownloadOptions } from './compliance'

// Scheduled Reports Service - Comprehensive scheduled report management
export {
	ScheduledReportsService,
	type ScheduleConfig,
	type DeliveryConfig,
	type ScheduledReportCriteria,
	type ScheduledReport,
	type CreateScheduledReportInput,
	type UpdateScheduledReportInput,
	type ListScheduledReportsParams,
	type PaginatedScheduledReports,
	type ReportExecution,
	type ExecutionHistoryParams,
	type PaginatedExecutions,
} from './scheduled-reports'

// Audit Presets Service - Comprehensive audit preset management
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
	type ValidationResult,
	type PresetApplicationResult,
	type ListAuditPresetsParams,
	type PaginatedAuditPresets,
	type PresetVersion,
	type PresetVersionHistory,
	type PresetUsageStats,
} from './presets'

// Metrics Service - Comprehensive system monitoring and metrics
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
	type AlertStatistics,
	type PaginatedAlerts,
	type AuditMetricsParams,
	type MetricsSubscriptionParams,
	type RealTimeMetricsData,
	type MetricsSubscription,
	type AcknowledgeAlertRequest,
	type ResolveAlertRequest,
} from './metrics'

// Health Service - Comprehensive system health monitoring
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
} from './health'
