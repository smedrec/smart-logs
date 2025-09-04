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
export {
	ComplianceService,
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
} from './compliance'

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

// Other services (placeholders for future implementation)
export * from './metrics'
export * from './health'
