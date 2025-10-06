/**
 * App Routes Configuration
 *
 * This file centralizes all app-related route definitions,
 * providing type-safe route generation and navigation helpers.
 */

export const ROUTES = {
	// Main dashboard
	DASHBOARD: '/dashboard',
	// Main Alerting dashboard
	ALERTS_BOARD: '/alerts',
	// Alert details
	ALERTS_ACTIVE: '/alerts/active',
	ALERTS_ACKNOWLEDGED: '/alerts/acknowledged',
	ALERTS_RESOLVED: '/alerts/resolved',

	// Main compliance dashboard
	COMPLIANCE_DASHBOARD: '/compliance',

	// Scheduled reports management
	SCHEDULED_REPORTS: '/compliance/scheduled-reports',
	CREATE_REPORT: '/compliance/scheduled-reports/create',
	EDIT_REPORT: (reportId: string) => `/compliance/scheduled-reports/${reportId}/edit`,
	VIEW_REPORT: (reportId: string) => `/compliance/scheduled-reports/${reportId}`,
	EXECUTE_REPORT: (reportId: string) => `/compliance/scheduled-reports/${reportId}/execute`,
	REPORT_EXECUTIONS: (reportId: string) => `/compliance/scheduled-reports/${reportId}/executions`,

	// Report templates
	TEMPLATES: '/compliance/report-templates',

	// Global execution history
	EXECUTION_HISTORY: '/compliance/execution-history',

	// Legacy routes (to be deprecated)
	HIPAA: '/compliance/hipaa',
	GDPR: '/compliance/gdpr',
	INTEGRITY: '/compliance/integrity',
	EXPORT_REPORTS: '/compliance/export-reports',
	EXPORT_EVENTS: '/compliance/export-events',
} as const

/**
 * Type-safe route parameters
 */
export interface ComplianceRouteParams {
	reportId: string
}

/**
 * Search parameter schemas for different routes
 */
export interface ScheduledReportsSearchParams {
	page?: number
	limit?: number
	search?: string
	reportType?: 'hipaa' | 'gdpr' | 'custom'
	status?: 'enabled' | 'disabled'
	sortBy?: 'name' | 'reportType' | 'lastRun' | 'nextRun' | 'createdAt'
	sortOrder?: 'asc' | 'desc'
}

export interface ExecutionHistorySearchParams {
	page?: number
	limit?: number
	reportId?: string
	status?: 'completed' | 'failed' | 'running' | 'pending'
	reportType?: 'hipaa' | 'gdpr' | 'custom'
	dateFrom?: string
	dateTo?: string
	sortBy?: 'scheduledTime' | 'executionTime' | 'duration' | 'status' | 'reportName'
	sortOrder?: 'asc' | 'desc'
}

export interface ReportTemplatesSearchParams {
	page?: number
	limit?: number
	search?: string
	reportType?: 'hipaa' | 'gdpr' | 'custom'
	category?: string
	sortBy?: 'name' | 'reportType' | 'category' | 'createdAt' | 'updatedAt'
	sortOrder?: 'asc' | 'desc'
}

export interface CreateReportSearchParams {
	reportType?: 'hipaa' | 'gdpr' | 'custom'
	template?: string
}

/**
 * Route permission requirements
 */
export const ROUTE_PERMISSIONS = {
	[ROUTES.COMPLIANCE_DASHBOARD]: ['compliance:read'],
	[ROUTES.SCHEDULED_REPORTS]: ['compliance:read', 'reports:read'],
	[ROUTES.CREATE_REPORT]: ['compliance:write', 'reports:create'],
	[ROUTES.TEMPLATES]: ['compliance:read', 'templates:read'],
	[ROUTES.EXECUTION_HISTORY]: ['compliance:read', 'executions:read'],
} as const

/**
 * Helper function to check if user has required permissions for a route
 */
export function hasRoutePermission(route: string, userPermissions: string[]): boolean {
	const requiredPermissions = ROUTE_PERMISSIONS[route as keyof typeof ROUTE_PERMISSIONS]
	if (!requiredPermissions) return true // No specific permissions required

	return requiredPermissions.every((permission) => userPermissions.includes(permission))
}

/**
 * Navigation helper functions
 */
export const complianceNavigation = {
	toHomeDashboard: () => ROUTES.DASHBOARD,
	toAlertsBoard: () => ROUTES.ALERTS_BOARD,
	toActiveAlerts: () => ROUTES.ALERTS_ACTIVE,
	toAcknowledgedAlerts: () => ROUTES.ALERTS_ACKNOWLEDGED,
	toResolvedAlerts: () => ROUTES.ALERTS_RESOLVED,
	toComplianceDashboard: () => ROUTES.COMPLIANCE_DASHBOARD,
	toScheduledReports: (params?: ScheduledReportsSearchParams) => {
		const searchParams = new URLSearchParams()
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.set(key, String(value))
				}
			})
		}
		const query = searchParams.toString()
		return `${ROUTES.SCHEDULED_REPORTS}${query ? `?${query}` : ''}`
	},
	toCreateReport: (params?: CreateReportSearchParams) => {
		const searchParams = new URLSearchParams()
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.set(key, String(value))
				}
			})
		}
		const query = searchParams.toString()
		return `${ROUTES.CREATE_REPORT}${query ? `?${query}` : ''}`
	},
	toEditReport: (reportId: string) => ROUTES.EDIT_REPORT(reportId),
	toViewReport: (reportId: string) => ROUTES.VIEW_REPORT(reportId),
	toExecuteReport: (reportId: string) => ROUTES.EXECUTE_REPORT(reportId),
	toReportExecutions: (reportId: string, params?: ExecutionHistorySearchParams) => {
		const searchParams = new URLSearchParams()
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.set(key, String(value))
				}
			})
		}
		const query = searchParams.toString()
		return `${ROUTES.REPORT_EXECUTIONS(reportId)}${query ? `?${query}` : ''}`
	},
	toTemplates: (params?: ReportTemplatesSearchParams) => {
		const searchParams = new URLSearchParams()
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.set(key, String(value))
				}
			})
		}
		const query = searchParams.toString()
		return `${ROUTES.TEMPLATES}${query ? `?${query}` : ''}`
	},
	toExecutionHistory: (params?: ExecutionHistorySearchParams) => {
		const searchParams = new URLSearchParams()
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined) {
					searchParams.set(key, String(value))
				}
			})
		}
		const query = searchParams.toString()
		return `${ROUTES.EXECUTION_HISTORY}${query ? `?${query}` : ''}`
	},
}
