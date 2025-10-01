// Export all UI-specific types
export type * from './ui-types'

// Re-export commonly used audit client types for convenience
export type {
	ScheduledReport,
	ReportExecution,
	CreateScheduledReportInput,
	UpdateScheduledReportInput,
} from '@smedrec/audit-client'

// Note: ReportType, ExecutionStatus, and ComplianceReportEvent may need to be
// imported directly from specific type files when needed, as they may not be
// exported from the main audit client index
