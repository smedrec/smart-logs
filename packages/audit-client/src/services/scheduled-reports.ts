import { BaseResource } from '../core/base-resource'

import type { AuditClientConfig } from '../core/config'
import type { Logger } from '../infrastructure/logger'

/**
 * Schedule configuration interface
 */
export interface ScheduleConfig {
	frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
	dayOfWeek?: number // 0-6 (Sunday-Saturday) for weekly
	dayOfMonth?: number // 1-31 for monthly/quarterly
	hour: number // 0-23
	minute: number // 0-59
	timezone: string // IANA timezone identifier
}

/**
 * Delivery configuration interface
 */
export interface DeliveryConfig {
	method: 'email' | 'webhook' | 'storage'
	config: {
		recipients?: string[] // For email delivery
		webhookUrl?: string // For webhook delivery
		storageLocation?: string // For storage delivery
	}
}

/**
 * Report criteria interface for scheduled reports
 */
export interface ScheduledReportCriteria {
	dateRange: {
		startDate: string
		endDate: string
	}
	organizationIds?: string[]
	principalIds?: string[]
	resourceTypes?: string[]
	actions?: string[]
	dataClassifications?: ('PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI')[]
	includeDetails?: boolean
	includeMetadata?: boolean
	format: 'json' | 'csv' | 'pdf' | 'xlsx'
}

/**
 * Scheduled report interface
 */
export interface ScheduledReport {
	id: string
	name: string
	description?: string
	reportType: 'hipaa' | 'gdpr' | 'custom' | 'integrity'
	criteria: ScheduledReportCriteria
	schedule: ScheduleConfig
	deliveryConfig: DeliveryConfig
	isActive: boolean
	createdAt: string
	updatedAt: string
	lastExecution?: string
	nextExecution: string
	createdBy: string
	organizationId: string
}

/**
 * Create scheduled report input interface
 */
export interface CreateScheduledReportInput {
	name: string
	description?: string
	reportType: 'hipaa' | 'gdpr' | 'custom' | 'integrity'
	criteria: ScheduledReportCriteria
	schedule: ScheduleConfig
	deliveryConfig: DeliveryConfig
	isActive?: boolean
}

/**
 * Update scheduled report input interface
 */
export interface UpdateScheduledReportInput {
	name?: string
	description?: string
	criteria?: Partial<ScheduledReportCriteria>
	schedule?: Partial<ScheduleConfig>
	deliveryConfig?: Partial<DeliveryConfig>
	isActive?: boolean
}

/**
 * List scheduled reports parameters
 */
export interface ListScheduledReportsParams {
	organizationId?: string
	reportType?: 'hipaa' | 'gdpr' | 'custom' | 'integrity'
	isActive?: boolean
	createdBy?: string
	limit?: number
	offset?: number
	sortBy?: 'name' | 'createdAt' | 'lastExecution' | 'nextExecution'
	sortOrder?: 'asc' | 'desc'
}

/**
 * Paginated scheduled reports response
 */
export interface PaginatedScheduledReports {
	reports: ScheduledReport[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
}

/**
 * Report execution interface
 */
export interface ReportExecution {
	id: string
	reportId: string
	startedAt: string
	completedAt?: string
	status: 'pending' | 'running' | 'completed' | 'failed'
	progress?: number
	error?: string
	downloadUrl?: string
	fileSize?: number
	recordCount?: number
}

/**
 * Execution history parameters
 */
export interface ExecutionHistoryParams {
	limit?: number
	offset?: number
	status?: 'pending' | 'running' | 'completed' | 'failed'
	dateRange?: {
		startDate: string
		endDate: string
	}
	sortBy?: 'startedAt' | 'completedAt' | 'status'
	sortOrder?: 'asc' | 'desc'
}

/**
 * Paginated executions response
 */
export interface PaginatedExecutions {
	executions: ReportExecution[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
}

/**
 * ScheduledReportsService - Comprehensive scheduled report management
 *
 * This service provides:
 * - CRUD operations for scheduled reports
 * - Report scheduling with cron-like configuration
 * - Execution history tracking and management
 * - Immediate execution and status monitoring
 * - Comprehensive validation and error handling
 */
export class ScheduledReportsService extends BaseResource {
	constructor(config: AuditClientConfig, logger?: Logger) {
		super(config, logger)
	}

	/**
	 * List scheduled reports with filtering and pagination
	 * Requirement 6.3: WHEN listing scheduled reports THEN the client SHALL provide filtering and pagination options
	 */
	async list(params: ListScheduledReportsParams = {}): Promise<PaginatedScheduledReports> {
		this.validateListParams(params)

		return this.request<PaginatedScheduledReports>('/scheduled-reports', {
			method: 'GET',
			query: params,
		})
	}

	/**
	 * Get a specific scheduled report by ID
	 */
	async get(id: string): Promise<ScheduledReport | null> {
		this.validateId(id)

		try {
			return await this.request<ScheduledReport>(`/scheduled-reports/${id}`)
		} catch (error: any) {
			if (error.status === 404) {
				return null
			}
			throw error
		}
	}

	/**
	 * Create a new scheduled report
	 * Requirement 6.1: WHEN creating scheduled reports THEN the client SHALL validate schedule configuration and report parameters
	 */
	async create(report: CreateScheduledReportInput): Promise<ScheduledReport> {
		this.validateCreateInput(report)

		return this.request<ScheduledReport>('/scheduled-reports', {
			method: 'POST',
			body: report,
		})
	}

	/**
	 * Update an existing scheduled report
	 * Requirement 6.2: WHEN updating scheduled reports THEN the client SHALL support partial updates and validation
	 */
	async update(id: string, updates: UpdateScheduledReportInput): Promise<ScheduledReport> {
		this.validateId(id)
		this.validateUpdateInput(updates)

		return this.request<ScheduledReport>(`/scheduled-reports/${id}`, {
			method: 'PUT',
			body: updates,
		})
	}

	/**
	 * Delete a scheduled report
	 * Requirement 6.5: WHEN managing report schedules THEN the client SHALL support CRUD operations with proper error handling
	 */
	async delete(id: string): Promise<void> {
		this.validateId(id)

		await this.request<void>(`/scheduled-reports/${id}`, {
			method: 'DELETE',
		})
	}

	/**
	 * Execute a scheduled report immediately
	 * Requirement 6.4: WHEN executing scheduled reports THEN the client SHALL provide immediate execution capabilities
	 */
	async execute(id: string): Promise<ReportExecution> {
		this.validateId(id)

		return this.request<ReportExecution>(`/scheduled-reports/${id}/execute`, {
			method: 'POST',
		})
	}

	/**
	 * Get execution history for a scheduled report
	 * Requirement 6.5: WHEN managing report schedules THEN the client SHALL support CRUD operations with proper error handling
	 */
	async getExecutionHistory(
		id: string,
		params: ExecutionHistoryParams = {}
	): Promise<PaginatedExecutions> {
		this.validateId(id)
		this.validateExecutionHistoryParams(params)

		return this.request<PaginatedExecutions>(`/scheduled-reports/${id}/executions`, {
			method: 'GET',
			query: params,
		})
	}

	/**
	 * Get execution status for a specific execution
	 */
	async getExecutionStatus(reportId: string, executionId: string): Promise<ReportExecution> {
		this.validateId(reportId)
		this.validateId(executionId)

		return this.request<ReportExecution>(`/scheduled-reports/${reportId}/executions/${executionId}`)
	}

	/**
	 * Cancel a running execution
	 */
	async cancelExecution(reportId: string, executionId: string): Promise<void> {
		this.validateId(reportId)
		this.validateId(executionId)

		await this.request<void>(`/scheduled-reports/${reportId}/executions/${executionId}/cancel`, {
			method: 'POST',
		})
	}

	/**
	 * Download execution result
	 */
	async downloadExecution(
		reportId: string,
		executionId: string,
		format?: 'json' | 'csv' | 'pdf' | 'xlsx'
	): Promise<Blob> {
		this.validateId(reportId)
		this.validateId(executionId)

		const query: Record<string, any> = {}
		if (format) {
			this.validateFormat(format)
			query.format = format
		}

		return this.request<Blob>(`/scheduled-reports/${reportId}/executions/${executionId}/download`, {
			method: 'GET',
			query,
			responseType: 'blob',
		})
	}

	/**
	 * Enable a scheduled report
	 */
	async enable(id: string): Promise<ScheduledReport> {
		this.validateId(id)

		return this.request<ScheduledReport>(`/scheduled-reports/${id}/enable`, {
			method: 'POST',
		})
	}

	/**
	 * Disable a scheduled report
	 */
	async disable(id: string): Promise<ScheduledReport> {
		this.validateId(id)

		return this.request<ScheduledReport>(`/scheduled-reports/${id}/disable`, {
			method: 'POST',
		})
	}

	/**
	 * Get next execution times for all active scheduled reports
	 */
	async getUpcomingExecutions(
		organizationId?: string,
		limit: number = 50
	): Promise<
		Array<{
			reportId: string
			reportName: string
			nextExecution: string
			frequency: string
		}>
	> {
		const query: Record<string, any> = { limit }
		if (organizationId) {
			query.organizationId = organizationId
		}

		return this.request(`/scheduled-reports/upcoming`, {
			method: 'GET',
			query,
		})
	}

	/**
	 * Validate schedule configuration
	 */
	private validateScheduleConfig(schedule: ScheduleConfig): void {
		if (!schedule.frequency) {
			throw new Error('Schedule frequency is required')
		}

		const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly']
		if (!validFrequencies.includes(schedule.frequency)) {
			throw new Error(`Invalid schedule frequency. Must be one of: ${validFrequencies.join(', ')}`)
		}

		if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== undefined) {
			if (schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6) {
				throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)')
			}
		}

		if (
			(schedule.frequency === 'monthly' || schedule.frequency === 'quarterly') &&
			schedule.dayOfMonth !== undefined
		) {
			if (schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31) {
				throw new Error('Day of month must be between 1 and 31')
			}
		}

		if (schedule.hour < 0 || schedule.hour > 23) {
			throw new Error('Hour must be between 0 and 23')
		}

		if (schedule.minute < 0 || schedule.minute > 59) {
			throw new Error('Minute must be between 0 and 59')
		}

		if (!schedule.timezone) {
			throw new Error('Timezone is required')
		}
	}

	/**
	 * Validate delivery configuration
	 */
	private validateDeliveryConfig(delivery: DeliveryConfig): void {
		if (!delivery.method) {
			throw new Error('Delivery method is required')
		}

		const validMethods = ['email', 'webhook', 'storage']
		if (!validMethods.includes(delivery.method)) {
			throw new Error(`Invalid delivery method. Must be one of: ${validMethods.join(', ')}`)
		}

		if (delivery.method === 'email') {
			if (!delivery.config.recipients || delivery.config.recipients.length === 0) {
				throw new Error('Email recipients are required for email delivery')
			}

			// Validate email addresses
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
			for (const email of delivery.config.recipients) {
				if (!emailRegex.test(email)) {
					throw new Error(`Invalid email address: ${email}`)
				}
			}
		}

		if (delivery.method === 'webhook') {
			if (!delivery.config.webhookUrl) {
				throw new Error('Webhook URL is required for webhook delivery')
			}

			// Validate webhook URL
			try {
				new URL(delivery.config.webhookUrl)
			} catch {
				throw new Error('Invalid webhook URL format')
			}
		}

		if (delivery.method === 'storage') {
			if (!delivery.config.storageLocation) {
				throw new Error('Storage location is required for storage delivery')
			}
		}
	}

	/**
	 * Validate report criteria
	 */
	private validateReportCriteria(criteria: ScheduledReportCriteria): void {
		if (!criteria.dateRange || !criteria.dateRange.startDate || !criteria.dateRange.endDate) {
			throw new Error('Report criteria must include a valid date range')
		}

		const startDate = new Date(criteria.dateRange.startDate)
		const endDate = new Date(criteria.dateRange.endDate)

		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
			throw new Error('Invalid date format in report criteria')
		}

		if (startDate >= endDate) {
			throw new Error('Start date must be before end date')
		}

		if (!criteria.format) {
			throw new Error('Report format is required')
		}

		this.validateFormat(criteria.format)
	}

	/**
	 * Validate report format
	 */
	private validateFormat(format: string): void {
		const validFormats = ['json', 'csv', 'pdf', 'xlsx']
		if (!validFormats.includes(format)) {
			throw new Error(`Invalid format. Must be one of: ${validFormats.join(', ')}`)
		}
	}

	/**
	 * Validate ID parameter
	 */
	private validateId(id: string): void {
		if (!id || typeof id !== 'string' || id.trim().length === 0) {
			throw new Error('Valid ID is required')
		}
	}

	/**
	 * Validate create input
	 */
	private validateCreateInput(input: CreateScheduledReportInput): void {
		if (!input.name || input.name.trim().length === 0) {
			throw new Error('Report name is required')
		}

		if (input.name.length > 255) {
			throw new Error('Report name cannot exceed 255 characters')
		}

		if (!input.reportType) {
			throw new Error('Report type is required')
		}

		const validReportTypes = ['hipaa', 'gdpr', 'custom', 'integrity']
		if (!validReportTypes.includes(input.reportType)) {
			throw new Error(`Invalid report type. Must be one of: ${validReportTypes.join(', ')}`)
		}

		this.validateReportCriteria(input.criteria)
		this.validateScheduleConfig(input.schedule)
		this.validateDeliveryConfig(input.deliveryConfig)
	}

	/**
	 * Validate update input
	 */
	private validateUpdateInput(input: UpdateScheduledReportInput): void {
		if (input.name !== undefined) {
			if (!input.name || input.name.trim().length === 0) {
				throw new Error('Report name cannot be empty')
			}
			if (input.name.length > 255) {
				throw new Error('Report name cannot exceed 255 characters')
			}
		}

		if (input.criteria) {
			// Validate partial criteria
			if (input.criteria.dateRange) {
				if (!input.criteria.dateRange.startDate || !input.criteria.dateRange.endDate) {
					throw new Error('Both start and end dates are required when updating date range')
				}

				const startDate = new Date(input.criteria.dateRange.startDate)
				const endDate = new Date(input.criteria.dateRange.endDate)

				if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
					throw new Error('Invalid date format in report criteria')
				}

				if (startDate >= endDate) {
					throw new Error('Start date must be before end date')
				}
			}

			if (input.criteria.format) {
				this.validateFormat(input.criteria.format)
			}
		}

		if (input.schedule) {
			// Validate partial schedule
			if (input.schedule.frequency) {
				const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly']
				if (!validFrequencies.includes(input.schedule.frequency)) {
					throw new Error(
						`Invalid schedule frequency. Must be one of: ${validFrequencies.join(', ')}`
					)
				}
			}

			if (input.schedule.hour !== undefined) {
				if (input.schedule.hour < 0 || input.schedule.hour > 23) {
					throw new Error('Hour must be between 0 and 23')
				}
			}

			if (input.schedule.minute !== undefined) {
				if (input.schedule.minute < 0 || input.schedule.minute > 59) {
					throw new Error('Minute must be between 0 and 59')
				}
			}

			if (input.schedule.dayOfWeek !== undefined) {
				if (input.schedule.dayOfWeek < 0 || input.schedule.dayOfWeek > 6) {
					throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)')
				}
			}

			if (input.schedule.dayOfMonth !== undefined) {
				if (input.schedule.dayOfMonth < 1 || input.schedule.dayOfMonth > 31) {
					throw new Error('Day of month must be between 1 and 31')
				}
			}
		}

		if (input.deliveryConfig) {
			// Validate partial delivery config
			if (input.deliveryConfig.method) {
				const validMethods = ['email', 'webhook', 'storage']
				if (!validMethods.includes(input.deliveryConfig.method)) {
					throw new Error(`Invalid delivery method. Must be one of: ${validMethods.join(', ')}`)
				}
			}

			if (input.deliveryConfig.config) {
				if (input.deliveryConfig.config.recipients) {
					const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
					for (const email of input.deliveryConfig.config.recipients) {
						if (!emailRegex.test(email)) {
							throw new Error(`Invalid email address: ${email}`)
						}
					}
				}

				if (input.deliveryConfig.config.webhookUrl) {
					try {
						new URL(input.deliveryConfig.config.webhookUrl)
					} catch {
						throw new Error('Invalid webhook URL format')
					}
				}
			}
		}
	}

	/**
	 * Validate list parameters
	 */
	private validateListParams(params: ListScheduledReportsParams): void {
		if (params.limit !== undefined) {
			if (params.limit < 1 || params.limit > 1000) {
				throw new Error('Limit must be between 1 and 1000')
			}
		}

		if (params.offset !== undefined) {
			if (params.offset < 0) {
				throw new Error('Offset must be non-negative')
			}
		}

		if (params.reportType) {
			const validReportTypes = ['hipaa', 'gdpr', 'custom', 'integrity']
			if (!validReportTypes.includes(params.reportType)) {
				throw new Error(`Invalid report type. Must be one of: ${validReportTypes.join(', ')}`)
			}
		}

		if (params.sortBy) {
			const validSortFields = ['name', 'createdAt', 'lastExecution', 'nextExecution']
			if (!validSortFields.includes(params.sortBy)) {
				throw new Error(`Invalid sort field. Must be one of: ${validSortFields.join(', ')}`)
			}
		}

		if (params.sortOrder) {
			const validSortOrders = ['asc', 'desc']
			if (!validSortOrders.includes(params.sortOrder)) {
				throw new Error(`Invalid sort order. Must be one of: ${validSortOrders.join(', ')}`)
			}
		}
	}

	/**
	 * Validate execution history parameters
	 */
	private validateExecutionHistoryParams(params: ExecutionHistoryParams): void {
		if (params.limit !== undefined) {
			if (params.limit < 1 || params.limit > 1000) {
				throw new Error('Limit must be between 1 and 1000')
			}
		}

		if (params.offset !== undefined) {
			if (params.offset < 0) {
				throw new Error('Offset must be non-negative')
			}
		}

		if (params.status) {
			const validStatuses = ['pending', 'running', 'completed', 'failed']
			if (!validStatuses.includes(params.status)) {
				throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
			}
		}

		if (params.dateRange) {
			const startDate = new Date(params.dateRange.startDate)
			const endDate = new Date(params.dateRange.endDate)

			if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
				throw new Error('Invalid date format in date range')
			}

			if (startDate >= endDate) {
				throw new Error('Start date must be before end date')
			}
		}

		if (params.sortBy) {
			const validSortFields = ['startedAt', 'completedAt', 'status']
			if (!validSortFields.includes(params.sortBy)) {
				throw new Error(`Invalid sort field. Must be one of: ${validSortFields.join(', ')}`)
			}
		}

		if (params.sortOrder) {
			const validSortOrders = ['asc', 'desc']
			if (!validSortOrders.includes(params.sortOrder)) {
				throw new Error(`Invalid sort order. Must be one of: ${validSortOrders.join(', ')}`)
			}
		}
	}
}
