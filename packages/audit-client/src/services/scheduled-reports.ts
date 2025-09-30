import { ReportCriteria } from '@/types/compliance'

import { BaseResource } from '../core/base-resource'
import { assertDefined, assertType, isNonEmptyString, isObject } from '../utils/type-guards'
import {
	validateCreateScheduledReportInput,
	validateExecutionHistoryParams,
	validateListScheduledReportsParams,
	validateUpdateScheduledReportInput,
	ValidationError,
} from '../utils/validation'

import type { AuditClientConfig } from '../core/config'
import type { Logger } from '../infrastructure/logger'
import type {
	CreateScheduledReportInput,
	DeliveryConfig,
	ExecutionHistoryParams,
	ListScheduledReportsParams,
	PaginatedExecutions,
	PaginatedScheduledReports,
	ReportExecution,
	ScheduleConfig,
	ScheduledReport,
	UpdateScheduledReportInput,
} from '../types/scheduled-reports'

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
		// Validate input using centralized validation
		const validationResult = validateListScheduledReportsParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid list scheduled reports parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedQuery = validationResult.data!

		const response = await this.request<PaginatedScheduledReports>('/scheduled-reports', {
			method: 'GET',
			query: validatedQuery,
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid paginated scheduled reports response from server')
		assertDefined(response.reports, 'Paginated scheduled reports response missing reports array')
		assertDefined(response.pagination, 'Paginated scheduled reports response missing pagination')

		return response
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
		// Validate input using centralized validation
		const validationResult = validateCreateScheduledReportInput(report)
		if (!validationResult.success) {
			throw new ValidationError('Invalid create scheduled report input', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<ScheduledReport>('/scheduled-reports', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid scheduled report response from server')
		assertDefined(response.id, 'Scheduled report response missing ID')
		assertDefined(response.name, 'Scheduled report response missing name')

		return response
	}

	/**
	 * Update an existing scheduled report
	 * Requirement 6.2: WHEN updating scheduled reports THEN the client SHALL support partial updates and validation
	 */
	async update(id: string, updates: UpdateScheduledReportInput): Promise<ScheduledReport> {
		// Validate input
		assertDefined(id, 'Scheduled report ID is required')
		if (!isNonEmptyString(id)) {
			throw new ValidationError('Scheduled report ID must be a non-empty string')
		}

		const validationResult = validateUpdateScheduledReportInput(updates)
		if (!validationResult.success) {
			throw new ValidationError('Invalid update scheduled report input', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<ScheduledReport>(`/scheduled-reports/${id}`, {
			method: 'PUT',
			body: validationResult.data,
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid scheduled report response from server')
		assertDefined(response.id, 'Scheduled report response missing ID')
		assertDefined(response.name, 'Scheduled report response missing name')

		return response
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
		// Validate input
		assertDefined(id, 'Scheduled report ID is required')
		if (!isNonEmptyString(id)) {
			throw new ValidationError('Scheduled report ID must be a non-empty string')
		}

		const validationResult = validateExecutionHistoryParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid execution history parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedQuery = validationResult.data!

		const response = await this.request<PaginatedExecutions>(
			`/scheduled-reports/${id}/executions`,
			{
				method: 'GET',
				query: validatedQuery,
			}
		)

		// Validate response structure
		assertType(response, isObject, 'Invalid paginated executions response from server')
		assertDefined(response.executions, 'Paginated executions response missing executions array')
		assertDefined(response.pagination, 'Paginated executions response missing pagination')

		return response
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
			const validDayOfWeek = [
				'monday',
				'tuesday',
				'wednesday',
				'thursday',
				'friday',
				'saturday',
				'sunday',
			]
			if (!validDayOfWeek.includes(schedule.dayOfWeek)) {
				throw new Error(`Invalid day of week. Must be one of: ${validDayOfWeek.join(', ')}`)
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
			if (!delivery.email?.recipients || delivery.email.recipients.length === 0) {
				throw new Error('Email recipients are required for email delivery')
			}

			// Validate email addresses
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
			for (const email of delivery.email.recipients) {
				if (!emailRegex.test(email)) {
					throw new Error(`Invalid email address: ${email}`)
				}
			}
		}

		if (delivery.method === 'webhook') {
			if (!delivery.webhook?.url) {
				throw new Error('Webhook URL is required for webhook delivery')
			}

			// Validate webhook URL
			try {
				new URL(delivery.webhook.url)
			} catch {
				throw new Error('Invalid webhook URL format')
			}
		}

		if (delivery.method === 'storage') {
			if (!delivery.storage?.config) {
				throw new Error('storage config is required for storage delivery')
			}
		}
	}

	/**
	 * Validate report criteria
	 */
	private validateReportCriteria(criteria: ReportCriteria): void {
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

		/**if (!criteria.format) {
			throw new Error('Report format is required')
		}

		this.validateFormat(criteria.format)*/
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

		if (input.format) {
			this.validateFormat(input.format)
		}

		this.validateReportCriteria(input.criteria)
		this.validateScheduleConfig(input.schedule)
		this.validateDeliveryConfig(input.delivery)
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

			if (input.format) {
				this.validateFormat(input.format)
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
				const validDayOfWeek = [
					'monday',
					'tuesday',
					'wednesday',
					'thursday',
					'friday',
					'saturday',
					'sunday',
				]
				if (!validDayOfWeek.includes(input.schedule.dayOfWeek)) {
					throw new Error(`Invalid day of week. Must be one of: ${validDayOfWeek.join(', ')}`)
				}
			}

			if (input.schedule.dayOfMonth !== undefined) {
				if (input.schedule.dayOfMonth < 1 || input.schedule.dayOfMonth > 31) {
					throw new Error('Day of month must be between 1 and 31')
				}
			}
		}

		if (input.delivery) {
			// Validate partial delivery config
			if (input.delivery.method) {
				const validMethods = ['email', 'webhook', 'storage', 'sftp', 'download']
				if (!validMethods.includes(input.delivery.method)) {
					throw new Error(`Invalid delivery method. Must be one of: ${validMethods.join(', ')}`)
				}
			}

			if (input.delivery.email?.recipients) {
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
				for (const email of input.delivery.email.recipients) {
					if (!emailRegex.test(email)) {
						throw new Error(`Invalid email address: ${email}`)
					}
				}
			}

			if (input.delivery.webhook?.url) {
				try {
					new URL(input.delivery.webhook.url)
				} catch {
					throw new Error('Invalid webhook URL format')
				}
			}
		}
	}

	/**
	 * Validate list parameters
	 */
	private validateListParams(params: ListScheduledReportsParams): void {
		if (params.pagination?.limit !== undefined) {
			if (params.pagination.limit < 1 || params.pagination.limit > 1000) {
				throw new Error('Limit must be between 1 and 1000')
			}
		}

		if (params.pagination?.offset !== undefined) {
			if (params.pagination.offset < 0) {
				throw new Error('Offset must be non-negative')
			}
		}

		if (params.reportType) {
			const validReportTypes = ['hipaa', 'gdpr', 'custom', 'integrity']
			for (const reportType of params.reportType) {
				if (!validReportTypes.includes(reportType)) {
					throw new Error(`Invalid report type. Must be one of: ${validReportTypes.join(', ')}`)
				}
			}
		}

		if (params.sort?.field) {
			const validSortFields = ['name', 'createdAt', 'lastExecution', 'nextExecution']
			if (!validSortFields.includes(params.sort.field)) {
				throw new Error(`Invalid sort field. Must be one of: ${validSortFields.join(', ')}`)
			}
		}

		if (params.sort?.direction) {
			const validSortOrders = ['asc', 'desc']
			if (!validSortOrders.includes(params.sort.direction)) {
				throw new Error(`Invalid sort order. Must be one of: ${validSortOrders.join(', ')}`)
			}
		}
	}

	/**
	 * Validate execution history parameters
	 */
	private validateExecutionHistoryParams(params: ExecutionHistoryParams): void {
		if (params.pagination?.limit !== undefined) {
			if (params.pagination.limit < 1 || params.pagination.limit > 1000) {
				throw new Error('Limit must be between 1 and 1000')
			}
		}

		if (params.pagination?.offset !== undefined) {
			if (params.pagination.offset < 0) {
				throw new Error('Offset must be non-negative')
			}
		}

		if (params.status) {
			const validStatuses = [
				'pending',
				'running',
				'completed',
				'failed',
				'cancelled',
				'skipped',
				'timeout',
			]
			for (const status of params.status) {
				if (!validStatuses.includes(status)) {
					throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
				}
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

		if (params.sort?.field) {
			const validSortFields = ['startedAt', 'completedAt', 'status']
			if (!validSortFields.includes(params.sort.field)) {
				throw new Error(`Invalid sort field. Must be one of: ${validSortFields.join(', ')}`)
			}
		}

		if (params.sort?.direction) {
			const validSortOrders = ['asc', 'desc']
			if (!validSortOrders.includes(params.sort.direction)) {
				throw new Error(`Invalid sort order. Must be one of: ${validSortOrders.join(', ')}`)
			}
		}
	}
}
