/**
 * @fileoverview Report module exports
 */

export { ComplianceReportingService } from './compliance-reporting.js'
export { EnhancedComplianceService } from './compliance-service.js'
export { ScheduledReportingService } from './scheduled-reporting.js'

// Re-export types for convenience
export type {
	ReportCriteria,
	ComplianceReport,
	ComplianceReportEvent,
	HIPAAComplianceReport,
	GDPRComplianceReport,
	IntegrityVerificationReport,
	IntegrityFailure,
	SuspiciousPattern,
	ReportFormat,
	ExportConfig,
} from './compliance-reporting.js'

export type {
	ScheduledReportConfig,
	ReportExecution,
	ReportTemplate,
	DeliveryConfig,
	ScheduleConfig,
	NotificationConfig,
} from './scheduled-reporting.js'
