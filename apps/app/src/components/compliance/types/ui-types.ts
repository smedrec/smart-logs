import type {
	CreateScheduledReportInput,
	ReportExecution,
	ScheduledReport,
	UpdateScheduledReportInput,
} from '@smedrec/audit-client'

// Define types that are not exported from the main audit client
export type ReportType =
	| 'HIPAA_AUDIT_TRAIL'
	| 'GDPR_PROCESSING_ACTIVITIES'
	| 'INTEGRITY_VERIFICATION'
export type ExecutionStatus =
	| 'pending'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled'
	| 'timeout'

// UI-enhanced scheduled report interface
export interface ScheduledReportUI extends ScheduledReport {
	// Additional UI-specific properties
	isLoading?: boolean
	hasErrors?: boolean
	lastExecutionStatus?: ExecutionStatus
	nextExecutionFormatted?: string
	isSelected?: boolean
}

// Form state management interfaces
export interface ReportFormState {
	data: Partial<CreateScheduledReportInput>
	errors: Record<string, string>
	touched: Record<string, boolean>
	isSubmitting: boolean
	isDirty: boolean
}

// Filter and pagination interfaces
export interface ReportFilters {
	reportType?: ReportType[]
	status?: ('enabled' | 'disabled')[]
	createdBy?: string[]
	tags?: string[]
	dateRange?: {
		startDate: string
		endDate: string
	}
	search?: string
}

export interface PaginationState {
	page: number
	pageSize: number
	total: number
	totalPages: number
}

// Reports list state
export interface ReportsListState {
	reports: ScheduledReportUI[]
	filters: ReportFilters
	pagination: PaginationState
	selection: string[]
	loading: boolean
	error?: string
	sortBy?: string
	sortOrder?: 'asc' | 'desc'
}

// API response handling
export interface ApiResponse<T> {
	data: T
	pagination?: PaginationMetadata
	summary?: Record<string, any>
}

export interface PaginationMetadata {
	page: number
	pageSize: number
	total: number
	totalPages: number
	hasNext: boolean
	hasPrevious: boolean
}

// Error handling interfaces
export interface UIError {
	code: string
	message: string
	field?: string
	details?: Record<string, any>
}

// Dashboard interfaces
export interface DashboardStats {
	totalReports: number
	activeReports: number
	successRate: number
	failureCount: number
	lastUpdated: string
}

export interface SystemHealthStatus {
	isConnected: boolean
	responseTime?: number
	lastCheck: string
	status: 'healthy' | 'degraded' | 'down'
	message?: string
}

// Execution interfaces
export interface ExecutionHistoryFilters {
	status?: ExecutionStatus[]
	dateRange?: {
		startDate: string
		endDate: string
	}
	reportId?: string
}

export interface ExecutionDetailsUI extends ReportExecution {
	logs?: string[]
	metrics?: {
		recordsProcessed: number
		fileSize: number
		processingTime: number
	}
}

// Form configuration interfaces
export interface ScheduleConfig {
	cronExpression: string
	timezone: string
	nextExecution?: string
	description?: string
}

export interface DeliveryConfig {
	method: 'email' | 'webhook' | 'storage'
	email?: {
		recipients: string[]
		subject?: string
		includeAttachment: boolean
	}
	webhook?: {
		url: string
		headers?: Record<string, string>
		method: 'POST' | 'PUT'
	}
	storage?: {
		path: string
		format: 'pdf' | 'csv' | 'json'
	}
}

// Notification interfaces
export interface NotificationItem {
	id: string
	type: 'success' | 'error' | 'warning' | 'info'
	title: string
	message: string
	timestamp: string
	read: boolean
	actions?: NotificationAction[]
}

export interface NotificationAction {
	label: string
	action: () => void
	variant?: 'default' | 'destructive'
}

// Security context interface
export interface SecurityContext {
	user: {
		id: string
		name: string
		email: string
		roles: string[]
	}
	permissions: Permission[]
	organization: {
		id: string
		name: string
		slug: string
	}
	canCreateReports: boolean
	canEditReports: boolean
	canDeleteReports: boolean
	canViewExecutions: boolean
	canManualExecute: boolean
}

export interface Permission {
	resource: string
	action: string
	conditions?: Record<string, any>
}

// Component prop interfaces
export interface BaseComponentProps {
	className?: string
	children?: React.ReactNode
}

export interface DataTableProps<T> extends BaseComponentProps {
	data: T[]
	columns: any[] // Will be properly typed with ColumnDef when implementing
	loading?: boolean
	error?: string
	onSelectionChange?: (selection: string[]) => void
	onFiltersChange?: (filters: any) => void
	onPaginationChange?: (pagination: PaginationState) => void
}

// Route params interfaces
export interface ReportRouteParams {
	reportId: string
}

export interface ExecutionRouteParams {
	reportId: string
	executionId?: string
}
