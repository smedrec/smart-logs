/**
 * @fileoverview Scheduled Reporting Service
 *
 * Provides automated compliance report scheduling and delivery functionality:
 * - Configurable report schedules (daily, weekly, monthly, quarterly)
 * - Multiple delivery methods (email, webhook, storage)
 * - Report template management
 * - Delivery tracking and retry logic
 *
 * Requirements: 4.1, 4.4, 8.1
 */

import { and, desc, eq, gte, is, lte, sql } from 'drizzle-orm'
import { Inngest } from 'inngest'

import {
	EnhancedAuditDatabaseClient,
	reportExecutions,
	reportTemplates,
	scheduledReports,
} from '@repo/audit-db'

import { DeliveryService } from '../delivery/delivery-service.js'
import { DeliveryResponse } from '../delivery/types.js'

import type {
	ComplianceReportingService,
	ExportConfig,
	IntegrityVerificationReport,
	ReportCriteria,
	ReportFormat,
} from './compliance-reporting.js'
import type { DataExportService, ExportResult } from './data-export.js'

/**
 * Scheduled report execution record
 */
export interface ReportExecution {
	executionId: string
	scheduledReportId: string
	scheduledTime: string
	executionTime: string
	status: 'running' | 'completed' | 'failed' | 'cancelled' | 'pending' | 'skipped' | 'timeout'
	trigger?: 'manual' | 'scheduled' | 'retry' | 'api' | 'catchup'
	duration?: number
	recordsProcessed?: number
	exportResult?: ExportResult
	integrityReport?: IntegrityVerificationReport
	deliveryId?: string
	error?: Error | string
}

export interface TemplateConfiguration {
	sections: {
		id: string
		title: string
		required: boolean
		fields: string[]
		description?: string
		filters?: Record<string, unknown>
	}[]
	formatting?: {
		includeHeader: boolean
		includeFooter: boolean
		includeToc: boolean
		pageNumbers: boolean
		watermark?: string
	}
	branding?: {
		logo?: string
		colors?: Record<string, string>
		fonts?: Record<string, string>
	}
}
/**
 * Report template for reusable configurations
 */
export interface ReportTemplate {
	id: string
	name: string
	description?: string
	category: 'hipaa' | 'gdpr' | 'custom' | 'privacy' | 'security' | 'audit'
	isPublic: boolean
	reportType:
		| 'HIPAA_AUDIT_TRAIL'
		| 'GDPR_PROCESSING_ACTIVITIES'
		| 'GENERAL_COMPLIANCE'
		| 'INTEGRITY_VERIFICATION'
		| 'CUSTOM_REPORT'
	defaultFormat: ReportFormat
	defaultCriteria?: Partial<ReportCriteria>
	defaultExportConfig?: Partial<ExportConfig>
	defaultDeliveryConfig?: Partial<DeliveryConfig>
	defaultNotificationConfig?: Partial<NotificationConfig>
	tags: string[]
	isActive: boolean
	isDefault: boolean
	configuration: TemplateConfiguration
	version: number
	usageCount: number
	createdAt: string
	createdBy: string
	updatedAt: string
	updatedBy: string
}

/**
 * Delivery configuration for different methods
 */
export interface DeliveryConfig {
	destinations: string[] | 'default'
}

export interface ScheduleConfig {
	frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
	timezone: string
	hour: number
	minute: number
	skipWeekends: boolean
	skipHolidays: boolean
	maxMissedRuns: number
	catchUpMissedRuns: boolean
	cronExpression?: string
	startDate?: string
	endDate?: string
	dayOfWeek?:
		| 'sunday'
		| 'monday'
		| 'tuesday'
		| 'wednesday'
		| 'thursday'
		| 'friday'
		| 'saturday'
		| undefined
	dayOfMonth?: number
	monthOfYear?: number
	holidayCalendar?: string
}

export interface NotificationConfig {
	recipients: string[]
	onSuccess: boolean
	onFailure: boolean
	onSkip: boolean
	includeReport: boolean
	customMessage?: string
}

/**
 * Scheduled report configuration
 */
export interface ScheduledReportConfig {
	id: string
	name: string
	organizationId: string
	description?: string
	templateId?: string
	reportType: ReportTemplate['reportType']
	criteria: ReportCriteria
	format: ReportFormat
	schedule: ScheduleConfig
	delivery: DeliveryConfig
	export: ExportConfig
	notification: NotificationConfig
	enabled: boolean
	createdAt: string
	createdBy: string
	lastRun?: string
	nextRun?: string
	runId?: string
	tags?: string[]
	metadata?: Record<string, any>
	version?: number
}

interface ListParams {
	sortBy?: 'name' | 'created_at' | 'updated_at' | 'last_run' | 'next_run' | 'execution_count'
	sortOrder: 'asc' | 'desc'
	reportType?: (
		| 'HIPAA_AUDIT_TRAIL'
		| 'GDPR_PROCESSING_ACTIVITIES'
		| 'GENERAL_COMPLIANCE'
		| 'INTEGRITY_VERIFICATION'
	)[]
	startDate?: string
	endDate?: string
	rangeBy?: 'created_at' | 'updated_at' | 'last_run' | 'next_run'
	enabled?: boolean
	createdBy?: string[]
	tags?: string[]
	limit?: number
	offset?: number
	search?: string
}

/**
 * Scheduled Reporting Service
 */
export class ScheduledReportingService {
	private reportService: ComplianceReportingService
	private exportService: DataExportService
	private deliveryService: DeliveryService
	private client: EnhancedAuditDatabaseClient
	private inngest: Inngest

	constructor(
		reportService: ComplianceReportingService,
		exportService: DataExportService,
		client: EnhancedAuditDatabaseClient,
		inngest: Inngest
	) {
		this.reportService = reportService
		this.exportService = exportService
		this.client = client
		this.inngest = inngest
		this.deliveryService = new DeliveryService(client)
	}

	/**
	 * Create a new scheduled report configuration
	 */
	async createScheduledReport(
		config: Omit<ScheduledReportConfig, 'id' | 'createdAt' | 'nextRun' | 'version'>
	): Promise<ScheduledReportConfig> {
		const reportId = this.generateId('report')
		const nextRun = this.calculateNextRun(config.schedule)
		const db = this.client.getDatabase()

		const dbRecord = {
			id: reportId,
			name: config.name,
			description: config.description || null,
			organizationId: config.organizationId,
			templateId: config.templateId || null,
			reportType: config.reportType,
			criteria: config.criteria,
			format: config.format,
			schedule: config.schedule,
			delivery: config.delivery,
			export: config.export,
			notification: config.notification,
			enabled: config.enabled ? 'true' : 'false',
			lastRun: null,
			nextRun,
			runId: null,
			tags: config.tags || [],
			metadata: config.metadata || null,
			createdBy: config.createdBy,
			updatedBy: null,
		}

		const records = await db.insert(scheduledReports).values(dbRecord).returning()

		if (records.length === 0) {
			throw new Error(`Failed to create scheduled report: ${reportId}`)
		}

		const reportConfig: ScheduledReportConfig = {
			...config,
			id: reportId,
			createdAt: records[0].createdAt,
			nextRun,
		}

		// Schedule the report
		if (config.enabled) {
			await this.scheduleReport(reportConfig)
		}

		return reportConfig
	}

	/**
	 * Update an existing scheduled report configuration
	 */
	async updateScheduledReport(
		reportId: string,
		updates: Partial<ScheduledReportConfig> & { updatedBy?: string }
	): Promise<ScheduledReportConfig> {
		const db = this.client.getDatabase()

		const existingRecords = await this.client.executeOptimizedQuery(
			(db) => db.select().from(scheduledReports).where(eq(scheduledReports.id, reportId)),
			{ skipCache: true }
		)

		if (existingRecords.length === 0) {
			throw new Error(`Scheduled report not found: ${reportId}`)
		}

		const existing = existingRecords[0]
		const nextRun =
			updates.nextRun ||
			(updates.schedule ? this.calculateNextRun(updates.schedule) : existing.nextRun)

		const updateData: any = {
			version: (existing as any).version + 1,
			updatedAt: new Date().toISOString(),
			updatedBy: updates.updatedBy || null,
		}

		if (updates.name) updateData.name = updates.name
		if (updates.description !== undefined) updateData.description = updates.description
		if (updates.reportType) updateData.reportType = updates.reportType
		if (updates.criteria) updateData.criteria = updates.criteria
		if (updates.format) updateData.format = updates.format
		if (updates.schedule) updateData.schedule = updates.schedule
		if (updates.delivery) updateData.delivery = updates.delivery
		if (updates.export) updateData.export = updates.export
		if (updates.notification) updateData.notification = updates.notification
		if (updates.enabled !== undefined) updateData.enabled = updates.enabled ? 'true' : 'false'
		if (updates.tags && updates.tags.length > 0) updateData.tags = updates.tags
		if (updates.metadata) updateData.metadata = updates.metadata
		if (nextRun) updateData.nextRun = nextRun

		await db.update(scheduledReports).set(updateData).where(eq(scheduledReports.id, reportId))

		// Get updated record
		const updatedRecords = await db
			.select()
			.from(scheduledReports)
			.where(eq(scheduledReports.id, reportId))

		const updated = updatedRecords[0]
		const updatedConfig: ScheduledReportConfig = {
			id: updated.id,
			name: updated.name,
			description: updated.description || undefined,
			organizationId: updated.organizationId,
			reportType: updated.reportType as ReportTemplate['reportType'],
			criteria: updated.criteria as ReportCriteria,
			format: updated.format as ReportFormat,
			schedule: updated.schedule as ScheduledReportConfig['schedule'],
			delivery: updated.delivery as ScheduledReportConfig['delivery'],
			export: updated.export as ScheduledReportConfig['export'],
			notification: updated.notification as ScheduledReportConfig['notification'],
			enabled: updated.enabled === 'true',
			lastRun: updated.lastRun || undefined,
			nextRun: updated.nextRun || undefined,
			runId: updated.runId || undefined,
			tags: (updated.tags as string[]) || [],
			metadata: (updated.metadata as any) || undefined,
			version: updated.version,
			createdAt: updated.createdAt,
			createdBy: updated.createdBy,
		}

		// Reschedule if enabled
		if (updatedConfig.enabled) {
			await this.scheduleReport(updatedConfig)
		} else {
			await this.unscheduleReport(reportId)
		}

		return updatedConfig
	}

	/**
	 * Delete a scheduled report configuration
	 */
	async deleteScheduledReport(reportId: string): Promise<void> {
		const db = this.client.getDatabase()

		const existingRecords = await db
			.select()
			.from(scheduledReports)
			.where(eq(scheduledReports.id, reportId))

		if (existingRecords.length === 0) {
			throw new Error(`Scheduled report not found: ${reportId}`)
		}

		await this.unscheduleReport(reportId)

		// Delete related executions first (foreign key constraint)
		await db.delete(reportExecutions).where(eq(reportExecutions.scheduledReportId, reportId))

		// Delete the scheduled report
		await db.delete(scheduledReports).where(eq(scheduledReports.id, reportId))
	}

	/**
	 * Get all scheduled report configurations
	 */
	async getScheduledReports(
		organizationId: string,
		params?: ListParams
	): Promise<ScheduledReportConfig[]> {
		let query = `SELECT * FROM scheduled_reports WHERE organization_id = '${organizationId}'`
		if (params?.enabled !== undefined) {
			query += query + ` AND enabled = 'true'`
		}
		if (params?.reportType && params.reportType.length > 0) {
			query += ` AND reportType IN (${params.reportType.map((type) => `'${type}'`).join(',')}))`
		}
		if (params?.createdBy) {
			query += ` AND created_by = ${params.createdBy}`
		}
		// Apply date range filter
		if (params?.rangeBy && params?.startDate && params?.endDate) {
			query += ` AND ${params.rangeBy} >= '${params.startDate}' AND ${params.rangeBy} <= '${params.endDate}'`
		}
		// Add sorting
		const sortColumn = params?.sortBy || 'created_at'
		const sortDirection = params?.sortOrder || 'desc'
		query += ` ORDER BY ${sortColumn} ${sortDirection.toUpperCase()}`
		// Add pagination
		if (params?.limit) {
			query += ` LIMIT ${params?.limit}`
		}
		if (params?.offset) {
			query += ` OFFSET ${params.offset}`
		}

		const cacheKey = this.client.generateCacheKey(
			'get_scheduled_reports',
			params ? { organizationId, ...params } : { organizationId }
		)
		const result = await this.client.executeMonitoredQuery(
			async (db) => db.execute(sql.raw(query)),
			'get_scheduled_reports',
			{ cacheKey }
		)

		const records = result || []
		return records.map(this.mapDatabaseScheduledReportToScheduledReport)
	}

	/**
	 * Get a specific scheduled report configuration
	 */
	async getScheduledReport(reportId: string): Promise<(ScheduledReportConfig & {}) | null> {
		const records = await this.client.executeOptimizedQuery(
			(db) => db.select().from(scheduledReports).where(eq(scheduledReports.id, reportId)),
			{ cacheKey: `${reportId}` }
		)

		if (records.length === 0) {
			return null
		}

		const record = records[0]
		return {
			id: record.id,
			name: record.name,
			description: record.description || undefined,
			organizationId: record.organizationId,
			reportType: record.reportType as ReportTemplate['reportType'],
			criteria: record.criteria as ReportCriteria,
			format: record.format as ReportFormat,
			schedule: record.schedule as ScheduledReportConfig['schedule'],
			delivery: record.delivery as ScheduledReportConfig['delivery'],
			export: record.export as ScheduledReportConfig['export'],
			notification: record.notification as ScheduledReportConfig['notification'],
			enabled: record.enabled === 'true',
			lastRun: record.lastRun || undefined,
			nextRun: record.nextRun || undefined,
			runId: record.runId || undefined,
			tags: (record.tags as ScheduledReportConfig['tags']) || [],
			metadata: (record.metadata as ScheduledReportConfig['metadata']) || undefined,
			version: record.version,
			createdAt: record.createdAt,
			createdBy: record.createdBy,
			//updatedBy: record.updatedBy || undefined,
		}
	}

	/**
	 * Execute a scheduled report immediately
	 */
	async executeReport(reportId: string): Promise<ReportExecution> {
		const config = await this.getScheduledReport(reportId)
		if (!config) {
			throw new Error(`Scheduled report not found: ${reportId}`)
		}
		if (!config.runId) {
			throw new Error(`Scheduled report job not found: ${reportId}`)
		}

		const executionId = this.generateId('execution')
		const now = new Date().toISOString()
		const db = this.client.getDatabase()

		const execution: ReportExecution = {
			executionId,
			scheduledReportId: reportId,
			scheduledTime: now,
			executionTime: now,
			status: 'running',
			trigger: 'scheduled',
			deliveryId: undefined,
		}

		try {
			const startTime = Date.now()

			// Insert execution record
			const dbExecution = {
				id: executionId,
				scheduledReportId: reportId,
				organizationId: (config as any).organizationId || 'unknown',
				runId: config.runId,
				scheduledTime: now,
				executionTime: now,
				status: 'running' as const,
				trigger: 'scheduled' as const,
				duration: null,
				recordsProcessed: null,
				exportResult: null,
				integrityReport: null,
				deliveryId: null,
				error: null,
			}

			await db.insert(reportExecutions).values(dbExecution)

			// Generate the report
			const reportResult = await this.generateReport(config)
			if (!reportResult) throw new Error('Failed to generate report')
			if (reportResult && typeof reportResult === 'object' && 'exportId' in reportResult) {
				execution.exportResult = reportResult as ExportResult
				execution.recordsProcessed = (reportResult as ExportResult).size
				// Deliver the report
				const { deliveryId } = await this.deliverReport(config, reportResult, execution)
				execution.deliveryId = deliveryId
			} else if (
				reportResult &&
				typeof reportResult === 'object' &&
				'verificationId' in reportResult
			) {
				execution.integrityReport = reportResult as IntegrityVerificationReport
			} else {
				throw new Error('Unexpected report result type')
			}

			execution.status = 'completed'
			execution.duration = Date.now() - startTime

			// Update execution record
			await db
				.update(reportExecutions)
				.set({
					status: 'completed',
					duration: execution.duration,
					recordsProcessed: execution.recordsProcessed,
					exportResult: execution.exportResult,
					integrityReport: execution.integrityReport,
					deliveryId: execution.deliveryId,
				})
				.where(eq(reportExecutions.id, executionId))

			// Update next run time
			const nextRun = this.calculateNextRun(config.schedule)
			await db
				.update(scheduledReports)
				.set({
					lastRun: execution.executionTime,
					nextRun,
					executionCount: sql`scheduledReports.executionCount + 1`,
					successCount: sql`scheduledReports.successCount + 1`,
				})
				.where(eq(scheduledReports.id, reportId))
			// TODO: schedule next run
		} catch (error) {
			execution.status = 'failed'
			execution.error = error instanceof Error ? error.message : 'Unknown error'

			// Update execution record with error
			await db
				.update(reportExecutions)
				.set({
					status: 'failed',
					error: execution.error,
				})
				.where(eq(reportExecutions.id, executionId))

			await db
				.update(scheduledReports)
				.set({
					failureCount: sql`scheduledReports.failureCount + 1`,
				})
				.where(eq(scheduledReports.id, reportId))
		}

		return execution
	}

	/**
	 * Get execution history for a scheduled report
	 */
	async getExecutionHistory(reportId: string, limit: number = 50): Promise<ReportExecution[]> {
		const records = await this.client.executeOptimizedQuery(
			(db) =>
				db
					.select()
					.from(reportExecutions)
					.where(eq(reportExecutions.scheduledReportId, reportId))
					.orderBy(desc(reportExecutions.executionTime))
					.limit(limit),
			{ cacheKey: `report-executions-${reportId}-${limit}` }
		)

		return records.map((record) => ({
			executionId: record.id,
			scheduledReportId: record.scheduledReportId,
			scheduledTime: record.scheduledTime,
			executionTime: record.executionTime,
			status: record.status as 'running' | 'completed' | 'failed',
			trigger: record.trigger as 'manual' | 'scheduled' | 'retry' | 'api' | 'catchup',
			duration: record.duration || undefined,
			recordsProcessed: record.recordsProcessed || undefined,
			exportResult: (record.exportResult as ExportResult) || undefined,
			integrityReport: (record.integrityReport as IntegrityVerificationReport) || undefined,
			deliveryId: record.deliveryId || undefined,
			error: record.error || undefined,
		}))
	}

	/**
	 * Create a report template
	 */
	async createReportTemplate(
		template: Omit<ReportTemplate, 'id' | 'version' | 'usageCount' | 'createdAt' | 'updatedAt'> & {
			organizationId: string
		}
	): Promise<ReportTemplate> {
		const templateId = this.generateId('template')
		const now = new Date().toISOString()
		const db = this.client.getDatabase()

		const dbRecord = {
			id: templateId,
			name: template.name,
			description: template.description || null,
			organizationId: template.organizationId,
			category: template.category,
			isPublic: template.isPublic ? 'true' : 'false',
			reportType: template.reportType,
			defaultFormat: template.defaultFormat,
			defaultCriteria: template.defaultCriteria || null,
			defaultExportConfig: template.defaultExportConfig || null,
			defaultDeliveryConfig: template.defaultDeliveryConfig || null,
			defaultNotificationConfig: template.defaultNotificationConfig || null,
			tags: template.tags,
			isActive: template.isActive ? 'true' : 'false',
			isDefault: template.isDefault ? 'true' : 'false',
			createdBy: template.createdBy,
			updatedBy: template.updatedBy,
		}

		await db.insert(reportTemplates).values(dbRecord)

		return {
			...template,
			id: templateId,
			version: 1,
			usageCount: 0,
			createdAt: now,
			updatedAt: now,
		}
	}

	/**
	 * Get all report templates
	 */
	async getReportTemplates(
		organizationId?: string,
		limit: number = 50,
		offset: number = 0
	): Promise<ReportTemplate[]> {
		const whereConditions = organizationId
			? and(
					eq(reportTemplates.isActive, 'true'),
					eq(reportTemplates.organizationId, organizationId)
				)
			: eq(reportTemplates.isActive, 'true')

		const cacheKey = this.client.generateCacheKey('get_report_templates', {
			organizationId,
			limit,
			offset,
		})
		const records = await this.client.executeOptimizedQuery(
			(db) => db.select().from(reportTemplates).where(whereConditions).limit(limit).offset(offset),
			{ cacheKey }
		)

		return records.map((record) => ({
			id: record.id,
			name: record.name,
			description: record.description || undefined,
			category: record.category as ReportTemplate['category'],
			isPublic: record.isPublic === 'true',
			reportType: record.reportType as ReportTemplate['reportType'],
			defaultFormat: record.defaultFormat as ReportFormat,
			defaultCriteria: (record.defaultCriteria as Partial<ReportCriteria>) || undefined,
			defaultExportConfig: (record.defaultExportConfig as Partial<ExportConfig>) || undefined,
			defaultDeliveryConfig: (record.defaultDeliveryConfig as DeliveryConfig) || undefined,
			defaultNotificationConfig:
				(record.defaultNotificationConfig as Partial<NotificationConfig>) || undefined,
			tags: (record.tags as string[]) || [],
			isActive: record.isActive === 'true',
			isDefault: record.isDefault === 'true',
			configuration: record.configuration as TemplateConfiguration,
			version: record.version,
			usageCount: record.usageCount,
			createdAt: record.createdAt,
			createdBy: record.createdBy,
			updatedAt: record.updatedAt,
			updatedBy: record.updatedBy || '',
		}))
	}

	/**
	 * Get a specific report template
	 */
	async getReportTemplate(
		templateId: string,
		organizationId?: string
	): Promise<ReportTemplate | null> {
		const whereConditions = organizationId
			? and(eq(reportTemplates.id, templateId), eq(reportTemplates.organizationId, organizationId))
			: eq(reportTemplates.id, templateId)

		const records = await this.client.executeOptimizedQuery(
			(db) => db.select().from(reportTemplates).where(whereConditions),
			{ cacheKey: `${templateId}` }
		)

		if (records.length === 0) {
			return null
		}

		const record = records[0]
		return {
			id: record.id,
			name: record.name,
			description: record.description || undefined,
			category: record.category as ReportTemplate['category'],
			isPublic: record.isPublic === 'true',
			reportType: record.reportType as ReportTemplate['reportType'],
			defaultFormat: record.defaultFormat as ReportFormat,
			defaultCriteria: (record.defaultCriteria as Partial<ReportCriteria>) || undefined,
			defaultExportConfig: (record.defaultExportConfig as Partial<ExportConfig>) || undefined,
			defaultDeliveryConfig: (record.defaultDeliveryConfig as DeliveryConfig) || undefined,
			defaultNotificationConfig:
				(record.defaultNotificationConfig as Partial<NotificationConfig>) || undefined,
			tags: (record.tags as string[]) || [],
			isActive: record.isActive === 'true',
			isDefault: record.isDefault === 'true',
			configuration: record.configuration as TemplateConfiguration,
			version: record.version,
			usageCount: record.usageCount,
			createdAt: record.createdAt,
			createdBy: record.createdBy,
			updatedAt: record.updatedAt,
			updatedBy: record.updatedBy || '',
		}
	}

	/**
	 * Create scheduled report from template
	 */
	async createReportFromTemplate(
		templateId: string,
		overrides: Partial<ScheduledReportConfig> & { organizationId: string }
	): Promise<ScheduledReportConfig> {
		const template = await this.getReportTemplate(templateId)
		if (!template) {
			throw new Error(`Report template not found: ${templateId}`)
		}

		const reportConfig: Omit<
			ScheduledReportConfig,
			'id' | 'createdAt' | 'updatedAt' | 'nextRun' | 'version'
		> & {
			organizationId: string
		} = {
			...overrides,
			name: overrides.name || `${template.name} - ${new Date().toISOString().split('T')[0]}`,
			description: overrides.description || template.description,
			organizationId: overrides.organizationId,
			templateId,
			reportType: template.reportType,
			criteria: {
				...template.defaultCriteria,
				...overrides.criteria,
			} as ReportCriteria,
			format: overrides.format || template.defaultFormat,
			schedule: overrides.schedule || {
				frequency: 'monthly',
				timezone: 'UTC',
				hour: 9,
				minute: 0,
				dayOfMonth: 1,
				skipWeekends: false,
				skipHolidays: false,
				maxMissedRuns: 3,
				catchUpMissedRuns: false,
			},
			delivery: overrides.delivery || {
				destinations: 'default',
			},
			export: overrides.export || {
				format: 'json',
				includeMetadata: true,
				includeIntegrityReport: false,
			},
			notification: overrides.notification || {
				recipients: ['reports@smedrec.com'],
				onSuccess: false,
				onFailure: true,
				onSkip: false,
				includeReport: false,
			},
			enabled: overrides.enabled !== undefined ? overrides.enabled : true,
			createdBy: overrides.createdBy || 'system',
			tags: overrides.tags || template.tags || [],
			metadata: overrides.metadata || {},
		}

		return await this.createScheduledReport(reportConfig)
	}

	/**
	 * Check for due reports and execute them
	 */
	async processDueReports(): Promise<ReportExecution[]> {
		const now = new Date().toISOString()

		// Find all enabled reports that are due for execution
		const dueRecords = await this.client.executeOptimizedQuery(
			(db) =>
				db
					.select()
					.from(scheduledReports)
					.where(and(eq(scheduledReports.enabled, 'true'), lte(scheduledReports.nextRun, now))),
			{ skipCache: true }
		)

		const executions: ReportExecution[] = []

		for (const record of dueRecords) {
			try {
				const execution = await this.executeReport(record.id)
				executions.push(execution)
			} catch (error) {
				console.error(`Failed to execute scheduled report ${record.id}:`, error)
			}
		}

		return executions
	}

	/**
	 * Private helper methods
	 */

	private async scheduleReport(config: ScheduledReportConfig): Promise<void> {
		const db = this.client.getDatabase()
		// Send an event to Inngest
		const event = await this.inngest.send({
			// The event name
			name: 'reports/schedule.report',
			// The event's data
			data: {
				config: config,
			},
		})

		if (!event) {
			throw new Error(`Failed to schedule report ${config.id}`)
		}

		await db
			.update(scheduledReports)
			.set({ runId: event.ids[0], updatedBy: 'inngest' })
			.where(eq(scheduledReports.id, config.id))

		console.log(`Scheduling report ${config.id} for ${config.nextRun}. Run ID: ${event.ids[0]}`)
	}

	private async unscheduleReport(reportId: string): Promise<void> {
		const db = this.client.getDatabase()
		// Send an event to Inngest
		const event = await this.inngest.send({
			// The event name
			name: 'reports/unschedule.report',
			// The event's data
			data: {
				reportId: reportId,
			},
		})

		if (!event) {
			throw new Error(`Failed to unschedule report ${reportId}`)
		}

		await db
			.update(scheduledReports)
			.set({ runId: null, updatedBy: 'inngest' })
			.where(eq(scheduledReports.id, reportId))

		console.log(`Unscheduling report ${reportId}. Run ID: ${event.ids[0]}`)
	}

	private calculateNextRun(schedule: ScheduledReportConfig['schedule']): string {
		const now = new Date()
		const hours = schedule.hour
		const minutes = schedule.minute

		let nextRun = new Date(now)
		nextRun.setHours(hours, minutes, 0, 0)

		if (schedule.timezone) {
			// Note: Proper timezone handling would require a library like 'luxon' or 'date-fns-tz'
			// TODO: This is a placeholder implementation assuming server is in UTC
			// In production, convert 'nextRun' to the specified timezone
		}

		// If the time has already passed today, move to the next occurrence
		if (nextRun <= now) {
			switch (schedule.frequency) {
				case 'hourly':
					nextRun.setHours(nextRun.getHours() + 1)
					break
				case 'daily':
					nextRun.setDate(nextRun.getDate() + 1)
					break
				case 'weekly': {
					const targetDay = Number(schedule.dayOfWeek ?? 0) // Default to Sunday
					const currentDay = Number(nextRun.getDay())
					const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7
					nextRun.setDate(nextRun.getDate() + daysUntilTarget)
					break
				}
				case 'monthly': {
					const targetDate = schedule.dayOfMonth || 1
					nextRun.setMonth(nextRun.getMonth() + 1, targetDate)
					break
				}
				case 'quarterly':
					nextRun.setMonth(nextRun.getMonth() + 3, schedule.dayOfMonth || 1)
					break
				case 'yearly':
					nextRun.setFullYear(
						nextRun.getFullYear() + 1,
						schedule.monthOfYear || 1,
						schedule.dayOfMonth || 1
					)
					break
				default:
					throw new Error(`Unsupported schedule frequency: ${schedule.frequency}`)
			}
		}

		return nextRun.toISOString()
	}

	private async generateReport(
		config: ScheduledReportConfig
	): Promise<ExportResult | IntegrityVerificationReport | undefined> {
		let result: ExportResult | IntegrityVerificationReport | undefined = undefined

		switch (config.reportType) {
			case 'HIPAA_AUDIT_TRAIL':
				result = await this.exportService.exportComplianceReport(
					await this.reportService.generateHIPAAReport(config.criteria),
					config.export
				)
				break
			case 'GDPR_PROCESSING_ACTIVITIES':
				result = await this.exportService.exportComplianceReport(
					await this.reportService.generateGDPRReport(config.criteria),
					config.export
				)
				break
			case 'GENERAL_COMPLIANCE':
				break
			case 'INTEGRITY_VERIFICATION':
				result = await this.reportService.generateIntegrityVerificationReport(config.criteria)
				break
			default:
				throw new Error(`Unsupported report type: ${config.reportType}`)
		}

		return result
	}

	private async deliverReport(
		config: ScheduledReportConfig,
		reportResult: ExportResult,
		execution: ReportExecution
	): Promise<DeliveryResponse> {
		const deliveryRequest = {
			organizationId: config.organizationId,
			destinations: config.delivery.destinations,
			payload: {
				type: 'report' as const,
				data: {
					...reportResult,
				},
				metadata: {
					reportId: config.id,
					reportName: config.name,
					reportType: config.reportType,
					format: config.format,
					recordsProcessed: execution.recordsProcessed,
					executionTime: execution.executionTime,
					scheduledTime: execution.scheduledTime,
					scheduledReportId: execution.scheduledReportId,
					trigger: execution.trigger,
					executionId: execution.executionId,
				},
			},
			options: {
				correlationId: execution.executionId,
				priority: Math.floor(Math.random() * 10),
			},
		}

		try {
			return await this.deliveryService.deliver(deliveryRequest)
		} catch (error) {
			console.error(`Failed to deliver report ${config.id}:`, error)
			throw error
		}
	}

	private generateId(prefix: string): string {
		return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
	}

	/**
	 * Map database audit log record to AuditLog interface
	 */
	private mapDatabaseScheduledReportToScheduledReport(scheduledReport: any): ScheduledReportConfig {
		return {
			id: scheduledReport.id,
			name: scheduledReport.name,
			description: scheduledReport.description || undefined,
			organizationId: scheduledReport.organizationId,
			templateId: scheduledReport.templateId || undefined,
			format: scheduledReport.format as ReportFormat,
			enabled: scheduledReport.enabled,
			reportType: scheduledReport.reportType,
			criteria:
				typeof scheduledReport.criteria === 'string'
					? JSON.parse(scheduledReport.criteria)
					: scheduledReport.criteria,
			delivery:
				typeof scheduledReport.delivery === 'string'
					? JSON.parse(scheduledReport.delivery)
					: scheduledReport.delivery,
			export:
				typeof scheduledReport.export === 'string'
					? JSON.parse(scheduledReport.export)
					: scheduledReport.export,
			schedule:
				typeof scheduledReport.schedule === 'string'
					? JSON.parse(scheduledReport.schedule)
					: scheduledReport.schedule,
			notification:
				typeof scheduledReport.notification === 'string'
					? JSON.parse(scheduledReport.notification)
					: scheduledReport.notification.recipients,
			tags: scheduledReport.tags,
			metadata:
				typeof scheduledReport.metadata === 'string'
					? JSON.parse(scheduledReport.metadata)
					: scheduledReport.metadata,
			createdAt: scheduledReport.createdAt,
			lastRun: scheduledReport.lastRun,
			nextRun: scheduledReport.nextRun,
			version: scheduledReport.version,
			createdBy: scheduledReport.createdBy,
		}
	}
}
