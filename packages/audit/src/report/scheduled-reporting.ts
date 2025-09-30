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

import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { Inngest } from 'inngest'

import {
	EnhancedAuditDatabaseClient,
	reportExecutions,
	reportTemplates,
	scheduledReports,
} from '@repo/audit-db'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type {
	ComplianceReportingService,
	ExportConfig,
	GDPRComplianceReport,
	HIPAAComplianceReport,
	IntegrityVerificationReport,
	ReportCriteria,
	ReportFormat,
	ScheduledReportConfig,
} from './compliance-reporting.js'
import type { DataExportService, ExportResult } from './data-export.js'

/**
 * Delivery status for scheduled reports
 */
export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying'

/**
 * Delivery attempt record
 */
export interface DeliveryAttempt {
	attemptId: string
	timestamp: string
	status: DeliveryStatus
	method: 'email' | 'webhook' | 'storage' | 'sftp' | 'download'
	target: string
	error?: Error | string
	responseCode?: number
	responseTime?: number
	retryCount: number
}

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
	deliveryAttempts: DeliveryAttempt[]
	error?: Error | string
}

/**
 * Report template for reusable configurations
 */
export interface ReportTemplate {
	id: string
	name: string
	description?: string
	reportType:
		| 'HIPAA_AUDIT_TRAIL'
		| 'GDPR_PROCESSING_ACTIVITIES'
		| 'GENERAL_COMPLIANCE'
		| 'INTEGRITY_VERIFICATION'
	defaultCriteria: Partial<ReportCriteria>
	defaultFormat: ReportFormat
	defaultExportConfig: Partial<ExportConfig>
	tags: string[]
	createdAt: string
	createdBy: string
	updatedAt: string
	updatedBy: string
	isActive: boolean
}

/**
 * Delivery configuration for different methods
 */
export interface DeliveryConfig {
	method: 'email' | 'webhook' | 'storage' | 'sftp' | 'download'
	email?: {
		smtpConfig: {
			host: string
			port: number
			secure: boolean
			auth: {
				user: string
				pass: string
			}
		}
		from: string
		subject: string
		bodyTemplate: string
		attachmentName?: string
	}

	webhook?: {
		url: string
		method: 'POST' | 'PUT'
		headers: Record<string, string>
		timeout: number
		retryConfig: {
			maxRetries: number
			backoffMultiplier: number
			maxBackoffDelay: number
		}
	}

	storage?: {
		provider: 'local' | 's3' | 'azure' | 'gcp'
		config: Record<string, any>
		path: string
		retention: {
			days: number
			autoCleanup: boolean
		}
	}

	sftp?: {
		host: string
		port: number
		username?: string
		password?: string
		privateKey?: string
		path: string
		filename?: string
	}

	download?: {
		expiryHours: number
	}

	// General options
	compression?: 'none' | 'gzip' | 'zip'
	encryption?: boolean
	encryptionKey?: string
	retentionDays?: number
}

/**
 * Scheduled Reporting Service
 */
export class ScheduledReportingService {
	private reportService: ComplianceReportingService
	private exportService: DataExportService
	private client: EnhancedAuditDatabaseClient
	private inngest: Inngest
	private deliveryConfig: DeliveryConfig

	constructor(
		reportService: ComplianceReportingService,
		exportService: DataExportService,
		client: EnhancedAuditDatabaseClient,
		inngest: Inngest,
		deliveryConfig: DeliveryConfig
	) {
		this.reportService = reportService
		this.exportService = exportService
		this.client = client
		this.inngest = inngest
		this.deliveryConfig = deliveryConfig
	}

	/**
	 * Create a new scheduled report configuration
	 */
	async createScheduledReport(
		config: Omit<ScheduledReportConfig, 'id' | 'createdAt' | 'nextRun'> & { organizationId: string }
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
			enabled: config.enabled ? 'true' : 'false',
			lastRun: null,
			nextRun,
			runId: null,
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
		if (updates.enabled !== undefined) updateData.enabled = updates.enabled ? 'true' : 'false'
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
			reportType: updated.reportType as ReportTemplate['reportType'],
			criteria: updated.criteria as ReportCriteria,
			format: updated.format as ReportFormat,
			schedule: updated.schedule as ScheduledReportConfig['schedule'],
			delivery: updated.delivery as ScheduledReportConfig['delivery'],
			export: updated.export as ScheduledReportConfig['export'],
			enabled: updated.enabled === 'true',
			lastRun: updated.lastRun || undefined,
			nextRun: updated.nextRun || undefined,
			runId: updated.runId || undefined,
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
	async getScheduledReports(organizationId?: string): Promise<ScheduledReportConfig[]> {
		const records = await this.client.executeOptimizedQuery(
			async (db) => {
				const query = db.select().from(scheduledReports)

				return organizationId
					? await query.where(eq(scheduledReports.organizationId, organizationId))
					: await query.limit(100)
			},
			{ cacheKey: `scheduled-reports-${organizationId || 'all'}` }
		)

		return records.map((record) => ({
			id: record.id,
			name: record.name,
			description: record.description || undefined,
			reportType: record.reportType as ReportTemplate['reportType'],
			criteria: record.criteria as ReportCriteria,
			format: record.format as ReportFormat,
			schedule: record.schedule as ScheduledReportConfig['schedule'],
			delivery: record.delivery as ScheduledReportConfig['delivery'],
			export: record.export as ScheduledReportConfig['export'],
			enabled: record.enabled === 'true',
			lastRun: record.lastRun || undefined,
			nextRun: record.nextRun || undefined,
			runId: record.runId || undefined,
			createdAt: record.createdAt,
			createdBy: record.createdBy,
		}))
	}

	/**
	 * Get a specific scheduled report configuration
	 */
	async getScheduledReport(reportId: string): Promise<ScheduledReportConfig | null> {
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
			reportType: record.reportType as ReportTemplate['reportType'],
			criteria: record.criteria as ReportCriteria,
			format: record.format as ReportFormat,
			schedule: record.schedule as ScheduledReportConfig['schedule'],
			delivery: record.delivery as ScheduledReportConfig['delivery'],
			export: record.export as ScheduledReportConfig['export'],
			enabled: record.enabled === 'true',
			lastRun: record.lastRun || undefined,
			nextRun: record.nextRun || undefined,
			runId: record.runId || undefined,
			createdAt: record.createdAt,
			createdBy: record.createdBy,
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
			deliveryAttempts: [],
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
				deliveryAttempts: [],
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
				await this.deliverReport(config, reportResult, execution)
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
					deliveryAttempts: execution.deliveryAttempts,
				})
				.where(eq(reportExecutions.id, executionId))

			// Update next run time
			const nextRun = this.calculateNextRun(config.schedule)
			await db
				.update(scheduledReports)
				.set({
					lastRun: execution.executionTime,
					nextRun,
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
					deliveryAttempts: execution.deliveryAttempts,
				})
				.where(eq(reportExecutions.id, executionId))
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
			deliveryAttempts: (record.deliveryAttempts as DeliveryAttempt[]) || [],
			error: record.error || undefined,
		}))
	}

	/**
	 * Create a report template
	 */
	async createReportTemplate(
		template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'> & { organizationId: string }
	): Promise<ReportTemplate> {
		const templateId = this.generateId('template')
		const now = new Date().toISOString()
		const db = this.client.getDatabase()

		const dbRecord = {
			id: templateId,
			name: template.name,
			description: template.description || null,
			organizationId: template.organizationId,
			reportType: template.reportType,
			defaultCriteria: template.defaultCriteria,
			defaultFormat: template.defaultFormat,
			defaultExportConfig: template.defaultExportConfig,
			tags: template.tags,
			isActive: template.isActive ? 'true' : 'false',
			createdBy: template.createdBy,
			updatedBy: template.updatedBy,
		}

		await db.insert(reportTemplates).values(dbRecord)

		return {
			...template,
			id: templateId,
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
			reportType: record.reportType as ReportTemplate['reportType'],
			defaultCriteria: record.defaultCriteria as Partial<ReportCriteria>,
			defaultFormat: record.defaultFormat as ReportFormat,
			defaultExportConfig: record.defaultExportConfig as Partial<ExportConfig>,
			tags: (record.tags as string[]) || [],
			createdAt: record.createdAt,
			createdBy: record.createdBy,
			updatedAt: record.updatedAt,
			updatedBy: record.updatedBy || '',
			isActive: record.isActive === 'true',
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
			reportType: record.reportType as ReportTemplate['reportType'],
			defaultCriteria: record.defaultCriteria as Partial<ReportCriteria>,
			defaultFormat: record.defaultFormat as ReportFormat,
			defaultExportConfig: record.defaultExportConfig as Partial<ExportConfig>,
			tags: (record.tags as string[]) || [],
			createdAt: record.createdAt,
			createdBy: record.createdBy,
			updatedAt: record.updatedAt,
			updatedBy: record.updatedBy || '',
			isActive: record.isActive === 'true',
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

		const reportConfig: Omit<ScheduledReportConfig, 'id' | 'createdAt' | 'nextRun'> & {
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
				dayOfMonth: 1,
				time: '09:00',
				timezone: 'UTC',
			},
			delivery: overrides.delivery || {
				method: 'email',
				recipients: [],
			},
			export: overrides.export || {
				format: 'json',
				includeMetadata: true,
				includeIntegrityReport: false,
			},
			enabled: overrides.enabled !== undefined ? overrides.enabled : true,
			createdBy: overrides.createdBy || 'system',
		}

		return this.createScheduledReport(reportConfig)
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
	 * Retry failed deliveries
	 */
	async retryFailedDeliveries(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
		const cutoffTime = new Date(Date.now() - maxAge).toISOString()
		const db = this.client.getDatabase()

		// Get recent executions that might have failed deliveries
		const recentExecutions = await this.client.executeOptimizedQuery(
			(db) =>
				db.select().from(reportExecutions).where(gte(reportExecutions.executionTime, cutoffTime)),
			{ skipCache: true }
		)

		for (const executionRecord of recentExecutions) {
			const deliveryAttempts = (executionRecord.deliveryAttempts as DeliveryAttempt[]) || []

			const failedAttempts = deliveryAttempts.filter(
				(attempt) => attempt.status === 'failed' && attempt.retryCount < 3
			)

			if (failedAttempts.length > 0) {
				const execution: ReportExecution = {
					executionId: executionRecord.id,
					scheduledReportId: executionRecord.scheduledReportId,
					scheduledTime: executionRecord.scheduledTime,
					executionTime: executionRecord.executionTime,
					status: executionRecord.status as 'running' | 'completed' | 'failed',
					trigger: executionRecord.trigger as 'manual' | 'scheduled' | 'retry' | 'api' | 'catchup',
					duration: executionRecord.duration || undefined,
					recordsProcessed: executionRecord.recordsProcessed || undefined,
					exportResult: (executionRecord.exportResult as ExportResult) || undefined,
					integrityReport:
						(executionRecord.integrityReport as IntegrityVerificationReport) || undefined,
					deliveryAttempts,
					error: executionRecord.error || undefined,
				}

				for (const attempt of failedAttempts) {
					try {
						await this.retryDelivery(execution, attempt)

						// Update the execution record with the updated delivery attempts
						await db
							.update(reportExecutions)
							.set({
								deliveryAttempts: execution.deliveryAttempts,
							})
							.where(eq(reportExecutions.id, executionRecord.id))
					} catch (error) {
						console.error(`Failed to retry delivery ${attempt.attemptId}:`, error)
					}
				}
			}
		}
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
		const [hours, minutes] = schedule.time.split(':').map(Number)

		let nextRun = new Date(now)
		nextRun.setHours(hours, minutes, 0, 0)

		// If the time has already passed today, move to the next occurrence
		if (nextRun <= now) {
			switch (schedule.frequency) {
				case 'daily':
					nextRun.setDate(nextRun.getDate() + 1)
					break
				case 'weekly': {
					const targetDay = schedule.dayOfWeek || 1 // Default to Monday
					const currentDay = nextRun.getDay()
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
	): Promise<void> {
		const deliveryAttempt: DeliveryAttempt = {
			attemptId: this.generateId('delivery'),
			timestamp: new Date().toISOString(),
			status: 'pending',
			method: config.delivery.method,
			target: this.getDeliveryTarget(config.delivery),
			retryCount: 0,
		}

		execution.deliveryAttempts.push(deliveryAttempt)

		try {
			switch (config.delivery.method) {
				case 'email':
					await this.deliverViaEmail(config.delivery, reportResult, deliveryAttempt)
					break
				case 'webhook':
					await this.deliverViaWebhook(config.delivery, reportResult, deliveryAttempt)
					break
				case 'storage':
					await this.deliverViaStorage(config.delivery, reportResult, deliveryAttempt)
					break
				case 'sftp':
				case 'download':
					console.warn(`Delivery method ${config.delivery.method} not yet implemented`)
					deliveryAttempt.status = 'failed'
					deliveryAttempt.error = `Delivery method ${config.delivery.method} not yet implemented`
					throw new Error(deliveryAttempt.error)
				default:
					throw new Error(`Unsupported delivery method: ${config.delivery.method}`)
			}

			deliveryAttempt.status = 'delivered'
		} catch (error) {
			deliveryAttempt.status = 'failed'
			deliveryAttempt.error = error instanceof Error ? error.message : 'Unknown error'
			throw error
		}
	}

	private async deliverViaEmail(
		delivery: ScheduledReportConfig['delivery'],
		reportResult: ExportResult,
		attempt: DeliveryAttempt
	): Promise<void> {
		// TODO Placeholder email delivery implementation
		console.log(`Delivering report via email to: ${delivery.recipients?.join(', ')}`)
		attempt.responseTime = 250 // Placeholder
	}

	private async deliverViaWebhook(
		delivery: ScheduledReportConfig['delivery'],
		reportResult: ExportResult,
		attempt: DeliveryAttempt
	): Promise<void> {
		// TODO Placeholder webhook delivery implementation
		console.log(`Delivering report via webhook to: ${delivery.webhookUrl}`)
		attempt.responseCode = 200
		attempt.responseTime = 150 // Placeholder
	}

	private async deliverViaStorage(
		delivery: ScheduledReportConfig['delivery'],
		reportResult: ExportResult,
		attempt: DeliveryAttempt
	): Promise<void> {
		// TODO Placeholder storage delivery implementation
		console.log(`Storing report at: ${delivery.storageLocation}`)
		attempt.responseTime = 100 // Placeholder
	}

	private async retryDelivery(execution: ReportExecution, attempt: DeliveryAttempt): Promise<void> {
		const config = await this.getScheduledReport(execution.scheduledReportId)
		if (!config || !execution.exportResult) return

		attempt.retryCount++
		attempt.status = 'retrying'
		attempt.timestamp = new Date().toISOString()

		try {
			await this.deliverReport(config, execution.exportResult, execution)
		} catch (error) {
			attempt.status = 'failed'
			attempt.error = error instanceof Error ? error.message : 'Unknown error'
		}
	}

	private getDeliveryTarget(delivery: ScheduledReportConfig['delivery']): string {
		switch (delivery.method) {
			case 'email':
				return delivery.recipients?.join(', ') || 'unknown'
			case 'webhook':
				return delivery.webhookUrl || 'unknown'
			case 'storage':
				return delivery.storageLocation || 'unknown'
			default:
				return 'unknown'
		}
	}

	private generateId(prefix: string): string {
		return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
	}
}
