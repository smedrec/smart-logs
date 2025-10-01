/**
 * Compliance-specific URL State Management Hooks
 *
 * Provides typed URL state management for compliance features
 */

import { usePaginatedFilterUrlState, useUrlState } from '@/lib/url-state-management'
import { z } from 'zod'

/**
 * Scheduled Reports URL State
 */
const scheduledReportsStateSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(10),
	search: z.string().optional(),
	reportType: z.enum(['hipaa', 'gdpr', 'custom']).optional(),
	status: z.enum(['enabled', 'disabled']).optional(),
	sortBy: z.enum(['name', 'reportType', 'lastRun', 'nextRun', 'createdAt']).default('name'),
	sortOrder: z.enum(['asc', 'desc']).default('asc'),
	tags: z.array(z.string()).optional(),
	createdBy: z.string().optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
})

export type ScheduledReportsUrlState = z.infer<typeof scheduledReportsStateSchema>

export function useScheduledReportsUrlState() {
	return usePaginatedFilterUrlState(scheduledReportsStateSchema, {
		page: 1,
		limit: 10,
		sortBy: 'name',
		sortOrder: 'asc',
	})
}

/**
 * Execution History URL State
 */
const executionHistoryStateSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
	reportId: z.string().optional(),
	status: z.enum(['completed', 'failed', 'running', 'pending']).optional(),
	reportType: z.enum(['hipaa', 'gdpr', 'custom']).optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
	sortBy: z
		.enum(['scheduledTime', 'executionTime', 'duration', 'status', 'reportName'])
		.default('scheduledTime'),
	sortOrder: z.enum(['asc', 'desc']).default('desc'),
	executedBy: z.string().optional(),
	minDuration: z.number().optional(),
	maxDuration: z.number().optional(),
})

export type ExecutionHistoryUrlState = z.infer<typeof executionHistoryStateSchema>

export function useExecutionHistoryUrlState() {
	return usePaginatedFilterUrlState(executionHistoryStateSchema, {
		page: 1,
		limit: 20,
		sortBy: 'scheduledTime',
		sortOrder: 'desc',
	})
}

/**
 * Report Templates URL State
 */
const reportTemplatesStateSchema = z.object({
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(10),
	search: z.string().optional(),
	reportType: z.enum(['hipaa', 'gdpr', 'custom']).optional(),
	category: z.string().optional(),
	sortBy: z.enum(['name', 'reportType', 'category', 'createdAt', 'updatedAt']).default('name'),
	sortOrder: z.enum(['asc', 'desc']).default('asc'),
	tags: z.array(z.string()).optional(),
	isPublic: z.boolean().optional(),
	createdBy: z.string().optional(),
})

export type ReportTemplatesUrlState = z.infer<typeof reportTemplatesStateSchema>

export function useReportTemplatesUrlState() {
	return usePaginatedFilterUrlState(reportTemplatesStateSchema, {
		page: 1,
		limit: 10,
		sortBy: 'name',
		sortOrder: 'asc',
	})
}

/**
 * Report Configuration Form URL State
 */
const reportConfigStateSchema = z.object({
	step: z.number().min(1).max(6).default(1),
	reportType: z.enum(['hipaa', 'gdpr', 'custom']).optional(),
	template: z.string().optional(),
	draft: z.boolean().default(false),
	previewMode: z.boolean().default(false),
})

export type ReportConfigUrlState = z.infer<typeof reportConfigStateSchema>

export function useReportConfigUrlState() {
	return useUrlState({
		schema: reportConfigStateSchema,
		defaults: {
			step: 1,
			draft: false,
			previewMode: false,
		},
	})
}

/**
 * Dashboard URL State
 */
const dashboardStateSchema = z.object({
	timeRange: z.enum(['1h', '24h', '7d', '30d', '90d']).default('24h'),
	refreshInterval: z.number().min(0).default(30), // seconds
	showMetrics: z.boolean().default(true),
	showRecentExecutions: z.boolean().default(true),
	showUpcomingReports: z.boolean().default(true),
	showSystemHealth: z.boolean().default(true),
	metricsView: z.enum(['cards', 'charts']).default('cards'),
})

export type DashboardUrlState = z.infer<typeof dashboardStateSchema>

export function useDashboardUrlState() {
	return useUrlState({
		schema: dashboardStateSchema,
		defaults: {
			timeRange: '24h',
			refreshInterval: 30,
			showMetrics: true,
			showRecentExecutions: true,
			showUpcomingReports: true,
			showSystemHealth: true,
			metricsView: 'cards',
		},
	})
}

/**
 * Manual Execution URL State
 */
const manualExecutionStateSchema = z.object({
	reportId: z.string(),
	parameters: z.record(z.string(), z.unknown()).optional(),
	scheduleImmediate: z.boolean().default(true),
	notifyOnCompletion: z.boolean().default(true),
	outputFormat: z.enum(['pdf', 'csv', 'json']).optional(),
})

export type ManualExecutionUrlState = z.infer<typeof manualExecutionStateSchema>

export function useManualExecutionUrlState(reportId: string) {
	return useUrlState({
		schema: manualExecutionStateSchema,
		defaults: {
			reportId,
			scheduleImmediate: true,
			notifyOnCompletion: true,
		},
		serialize: (state) => {
			const serialized: Record<string, string> = {}
			Object.entries(state).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== '') {
					serialized[key] = String(value)
				}
			})
			return serialized
		},
	})
}

/**
 * Shareable URL utilities for compliance features
 */
export const complianceUrlUtils = {
	/**
	 * Create shareable URL for scheduled reports with filters
	 */
	createScheduledReportsUrl: (state: Partial<ScheduledReportsUrlState>, baseUrl?: string) => {
		const url = new URL(baseUrl || `${window.location.origin}/compliance/scheduled-reports`)
		Object.entries(state).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== '') {
				if (Array.isArray(value)) {
					url.searchParams.set(key, value.join(','))
				} else {
					url.searchParams.set(key, String(value))
				}
			}
		})
		return url.toString()
	},

	/**
	 * Create shareable URL for execution history with filters
	 */
	createExecutionHistoryUrl: (state: Partial<ExecutionHistoryUrlState>, baseUrl?: string) => {
		const url = new URL(baseUrl || `${window.location.origin}/compliance/execution-history`)
		Object.entries(state).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== '') {
				if (Array.isArray(value)) {
					url.searchParams.set(key, value.join(','))
				} else {
					url.searchParams.set(key, String(value))
				}
			}
		})
		return url.toString()
	},

	/**
	 * Create shareable URL for specific report execution history
	 */
	createReportExecutionHistoryUrl: (
		reportId: string,
		state: Partial<ExecutionHistoryUrlState>,
		baseUrl?: string
	) => {
		const url = new URL(
			baseUrl || `${window.location.origin}/compliance/scheduled-reports/${reportId}/executions`
		)
		Object.entries(state).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== '') {
				if (Array.isArray(value)) {
					url.searchParams.set(key, value.join(','))
				} else {
					url.searchParams.set(key, String(value))
				}
			}
		})
		return url.toString()
	},

	/**
	 * Create shareable URL for report templates with filters
	 */
	createReportTemplatesUrl: (state: Partial<ReportTemplatesUrlState>, baseUrl?: string) => {
		const url = new URL(baseUrl || `${window.location.origin}/compliance/report-templates`)
		Object.entries(state).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== '') {
				if (Array.isArray(value)) {
					url.searchParams.set(key, value.join(','))
				} else {
					url.searchParams.set(key, String(value))
				}
			}
		})
		return url.toString()
	},

	/**
	 * Create shareable URL for dashboard with specific view settings
	 */
	createDashboardUrl: (state: Partial<DashboardUrlState>, baseUrl?: string) => {
		const url = new URL(baseUrl || `${window.location.origin}/compliance`)
		Object.entries(state).forEach(([key, value]) => {
			if (value !== undefined && value !== null && String(value) !== '') {
				url.searchParams.set(key, String(value))
			}
		})
		return url.toString()
	},

	/**
	 * Parse URL parameters for compliance routes
	 */
	parseComplianceUrl: (url: string) => {
		const urlObj = new URL(url)
		const pathname = urlObj.pathname
		const searchParams = Object.fromEntries(urlObj.searchParams.entries())

		let routeType: string | null = null
		let routeParams: Record<string, string> = {}

		if (pathname === '/compliance') {
			routeType = 'dashboard'
		} else if (pathname === '/compliance/scheduled-reports') {
			routeType = 'scheduled-reports'
		} else if (pathname === '/compliance/scheduled-reports/create') {
			routeType = 'create-report'
		} else if (pathname.match(/^\/compliance\/scheduled-reports\/([^/]+)$/)) {
			routeType = 'view-report'
			routeParams.reportId = pathname.split('/')[3]
		} else if (pathname.match(/^\/compliance\/scheduled-reports\/([^/]+)\/edit$/)) {
			routeType = 'edit-report'
			routeParams.reportId = pathname.split('/')[3]
		} else if (pathname.match(/^\/compliance\/scheduled-reports\/([^/]+)\/executions$/)) {
			routeType = 'report-executions'
			routeParams.reportId = pathname.split('/')[3]
		} else if (pathname === '/compliance/execution-history') {
			routeType = 'execution-history'
		} else if (pathname === '/compliance/report-templates') {
			routeType = 'report-templates'
		}

		return {
			routeType,
			routeParams,
			searchParams,
		}
	},
}
