// Export all UI-specific types
export type * from './ui-types'

// Re-export commonly used audit client types for convenience
export type {
	ScheduledReport,
	ReportExecution,
	CreateScheduledReportInput,
	UpdateScheduledReportInput,
	ReportType,
	ExecutionStatus,
	ComplianceReportEvent,
} from '@smedrec/audit-client'
