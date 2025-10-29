import { type ExecutionStatus } from '../types/shared-schemas'

// Service layer exports
// This file will export all service classes

// Events Service - Comprehensive audit event management
export { EventsService, type EventSubscription } from './events'

export {
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
	type SessionContext,
	type DataClassification,
	type AuditEventStatus,
} from '../types/api'

// Compliance Service - HIPAA, GDPR, and custom reporting
export { ComplianceService, type ReportDownloadOptions } from './compliance'

export {
	type ReportType,
	type ComplianceReportEvent,
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
} from '../types/compliance'

// Scheduled Reports Service - Comprehensive scheduled report management
export { ScheduledReportsService } from './scheduled-reports'

export {
	type ScheduleConfig,
	type ScheduledReport,
	type CreateScheduledReportInput,
	type UpdateScheduledReportInput,
	type ListScheduledReportsParams,
	type PaginatedScheduledReports,
	type ReportExecution,
	type ExecutionHistoryParams,
	type PaginatedExecutions,
} from '../types/scheduled-reports'

// Audit Presets Service - Comprehensive audit preset management
export {
	PresetsService,
	type AuditPresetTemplate,
	type AuditPresetValidation,
	type AuditPresetMetadata,
	type ValidationResult,
	type ListAuditPresetsParams,
	type PaginatedAuditPresets,
} from './presets'

export {
	type ValidationRule,
	type AuditPreset,
	type CreateAuditPresetInput,
	type UpdateAuditPresetInput,
	type PresetContext,
	type PresetApplicationResult,
	type PresetVersion,
	type PresetVersionHistory,
	type PresetUsageStats,
} from '../types/presets'

// Metrics Service - Comprehensive system monitoring and metrics
export {
	MetricsService,
	type AlertStatistics,
	type DatabaseMetrics,
	type CacheMetrics,
	type ApiMetrics,
	type EndpointStats,
	type MetricsSubscriptionParams,
	type RealTimeMetricsData,
	type MetricsSubscription,
	type AcknowledgeAlertRequest,
	type ResolveAlertRequest,
} from './metrics'

export {
	type MemoryUsage,
	type CpuUsage,
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
} from '../types/metrics'

// Health Service - Comprehensive system health monitoring
export {
	HealthService,
	type ComponentHealth,
	type ServiceDependency,
	type LivenessStatus,
	type ApiStatus,
	type HealthCheckConfig,
	type HealthSubscriptionParams,
	type RealTimeHealthData,
	type HealthSubscription,
} from './health'

export {
	type HealthStatus,
	type DetailedHealthStatus,
	type ReadinessStatus,
	type VersionInfo,
} from '../types/health'

export {
	type DeliveryConfig,
	type ExecutionStatus,
	type ExecutionTrigger,
	type ReportStatus,
	type ReportFormat,
} from '../types/shared-schemas'
