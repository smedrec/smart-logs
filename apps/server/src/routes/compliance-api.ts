/**
 * @fileoverview Compliance API Routes
 *
 * Provides REST API endpoints for compliance reporting and data export:
 * - Generate compliance reports (HIPAA, GDPR, General)
 * - Export audit data in multiple formats
 * - Manage scheduled reports
 * - Verify audit trail integrity
 *
 * Requirements: 4.1, 4.4, 8.1
 */
import { validator } from 'hono/validator'

import type { HonoEnv } from '@/lib/hono/context'
import type { Hono } from 'hono'
import type { ExportConfig, ReportCriteria, ScheduledReportConfig } from '@repo/audit'
import { ApiError } from '@/lib/errors'
import { t } from '@/lib/trpc'
import { th } from 'zod/locales'

/**
 * Create compliance API router
 */
export function createComplianceAPI(app: Hono<HonoEnv>): Hono<HonoEnv> {
	/**
	 * Generate general compliance report
	 * POST /api/compliance/reports/generate
	 */
	app.post(
		'/reports/generate',
		validator('json', (value, c) => {
			const { criteria, reportType } = value
			if (!criteria || typeof criteria !== 'object') {
				return c.text('Invalid criteria', 400)
			}
			return { criteria: criteria as ReportCriteria, reportType: reportType as string }
		}),
		async (c) => {
			const { compliance, db, logger } = c.get('services')
			try {
				const { criteria, reportType } = c.req.valid('json')

				// Fetch audit events from database based on criteria
				const events = await fetchAuditEvents(db.audit, criteria)

				// Generate report
				const report = await compliance.report.generateComplianceReport(
					events,
					criteria,
					reportType
				)

				logger.info(`Generated compliance report: ${report.metadata.reportId}`)

				return c.json({
					success: true,
					report,
				})
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate compliance report: ${message}`)
				const error = new ApiError({
					code: 'INTERNAL_SERVER_ERROR',
					message,
				})
				throw error
			}
		}
	)

	/**
	 * Generate HIPAA compliance report
	 * POST /api/compliance/reports/hipaa
	 */
	app.post(
		'/reports/hipaa',
		validator('json', (value, c) => {
			const { criteria } = value
			if (!criteria || typeof criteria !== 'object') {
				return c.text('Invalid criteria', 400)
			}
			return { criteria: criteria as ReportCriteria }
		}),
		async (c) => {
			const { compliance, db, logger } = c.get('services')
			try {
				const { criteria } = c.req.valid('json')

				// Fetch audit events from database
				const events = await fetchAuditEvents(db.audit, criteria)

				// Generate HIPAA report
				const report = await compliance.report.generateHIPAAReport(events, criteria)

				logger.info(`Generated HIPAA report: ${report.metadata.reportId}`)

				return c.json({
					success: true,
					report,
				})
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate HIPAA report: ${message}`)
				const error = new ApiError({
					code: 'INTERNAL_SERVER_ERROR',
					message,
				})
				throw error
			}
		}
	)

	/**
	 * Generate GDPR compliance report
	 * POST /api/compliance/reports/gdpr
	 */
	app.post(
		'/reports/gdpr',
		validator('json', (value, c) => {
			const { criteria } = value
			if (!criteria || typeof criteria !== 'object') {
				return c.text('Invalid criteria', 400)
			}
			return { criteria: criteria as ReportCriteria }
		}),
		async (c) => {
			const { compliance, db, logger } = c.get('services')
			try {
				const { criteria } = c.req.valid('json')

				// Fetch audit events from database
				const events = await fetchAuditEvents(db.audit, criteria)

				// Generate GDPR report
				const report = await compliance.report.generateGDPRReport(events, criteria)

				logger.info(`Generated GDPR report: ${report.metadata.reportId}`)

				return c.json({
					success: true,
					report,
				})
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate GDPR report: ${message}`)
				const error = new ApiError({
					code: 'INTERNAL_SERVER_ERROR',
					message,
				})
				throw error
			}
		}
	)

	/**
	 * Generate integrity verification report
	 * POST /api/compliance/reports/integrity
	 */
	app.post(
		'/reports/integrity',
		validator('json', (value, c) => {
			const { criteria, performVerification } = value
			if (!criteria || typeof criteria !== 'object') {
				return c.text('Invalid criteria', 400)
			}
			return {
				criteria: criteria as ReportCriteria,
				performVerification: performVerification as boolean,
			}
		}),
		async (c) => {
			const { compliance, db, logger } = c.get('services')
			try {
				const { criteria, performVerification = true } = c.req.valid('json')

				// Fetch audit events from database
				const events = await fetchAuditEvents(db.audit, criteria)

				// Generate integrity verification report
				const report = await compliance.report.generateIntegrityVerificationReport(
					events,
					performVerification
				)

				logger.info(`Generated integrity verification report: ${report.verificationId}`)

				return c.json({
					success: true,
					report,
				})
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate integrity verification report: ${message}`)
				const error = new ApiError({
					code: 'INTERNAL_SERVER_ERROR',
					message,
				})
				throw error
			}
		}
	)

	/**
	 * Export compliance report
	 * POST /api/compliance/export/report
	 */
	app.post(
		'/export/report',
		validator('json', (value, c) => {
			const { report, config } = value
			if (!report || !config) {
				return c.text('Missing report or export config', 400)
			}
			return { report, config: config as ExportConfig }
		}),
		async (c) => {
			const { compliance, logger } = c.get('services')
			try {
				const { report, config } = c.req.valid('json')

				// Export the report
				const exportResult = await compliance.export.exportComplianceReport(report, config)

				logger.info(`Exported report: ${exportResult.exportId}`)

				// Set appropriate headers for file download
				c.header('Content-Type', exportResult.contentType)
				c.header('Content-Disposition', `attachment; filename="${exportResult.filename}"`)
				c.header('Content-Length', exportResult.size.toString())
				c.header('X-Export-ID', exportResult.exportId)
				c.header('X-Checksum', exportResult.checksum)

				return c.body(exportResult.data)
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to export report: ${message}`)
				const error = new ApiError({
					code: 'INTERNAL_SERVER_ERROR',
					message,
				})
				throw error
			}
		}
	)

	/**
	 * Export audit events
	 * POST /api/compliance/export/events
	 */
	app.post(
		'/export/events',
		validator('json', (value, c) => {
			const { criteria, config } = value
			if (!criteria || !config) {
				return c.text('Missing criteria or export config', 400)
			}
			return {
				criteria: criteria as ReportCriteria,
				config: config as ExportConfig,
			}
		}),
		async (c) => {
			const { compliance, db, logger } = c.get('services')
			try {
				const { criteria, config } = c.req.valid('json')

				// Fetch audit events from database
				const events = await fetchAuditEvents(db.audit, criteria)

				// Convert to report events format
				const reportEvents = events.map((event) => ({
					id: event.id,
					timestamp: event.timestamp,
					principalId: event.principalId,
					organizationId: event.organizationId,
					action: event.action,
					targetResourceType: event.targetResourceType,
					targetResourceId: event.targetResourceId,
					status: event.status,
					outcomeDescription: event.outcomeDescription,
					dataClassification: event.dataClassification,
					sessionContext: event.sessionContext,
					integrityStatus: (event.hash ? 'verified' : 'not_checked') as
						| 'verified'
						| 'not_checked'
						| 'failed',
					correlationId: event.correlationId,
				}))

				// Export the events
				const exportResult = await compliance.export.exportAuditEvents(reportEvents, config, {
					criteria,
				})

				logger.info(`Exported ${reportEvents.length} audit events: ${exportResult.exportId}`)

				// Set appropriate headers for file download
				c.header('Content-Type', exportResult.contentType)
				c.header('Content-Disposition', `attachment; filename="${exportResult.filename}"`)
				c.header('Content-Length', exportResult.size.toString())
				c.header('X-Export-ID', exportResult.exportId)
				c.header('X-Checksum', exportResult.checksum)

				return c.body(exportResult.data)
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to export audit events: ${message}`)
				const error = new ApiError({
					code: 'INTERNAL_SERVER_ERROR',
					message,
				})
				throw error
			}
		}
	)

	/**
	 * Create scheduled report
	 * POST /api/compliance/scheduled-reports
	 */
	app.post(
		'/scheduled-reports',
		validator('json', (value, c) => {
			const config = value as Omit<ScheduledReportConfig, 'id' | 'createdAt' | 'nextRun'> & {
				organizationId: string
			}
			if (!config.name || !config.criteria || !config.schedule || !config.delivery) {
				return c.text('Missing required fields', 400)
			}
			return config
		}),
		async (c) => {
			const { compliance, logger } = c.get('services')
			try {
				const config = c.req.valid('json')

				const scheduledReport = await compliance.scheduled.createScheduledReport(config)

				logger.info(`Created scheduled report: ${scheduledReport.id}`)

				return c.json({
					success: true,
					scheduledReport,
				})
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to create scheduled report: ${message}`)
				const error = new ApiError({
					code: 'INTERNAL_SERVER_ERROR',
					message,
				})
				throw error
			}
		}
	)

	/**
	 * Get all scheduled reports
	 * GET /api/compliance/scheduled-reports
	 */
	app.get('/scheduled-reports', async (c) => {
		const { compliance, logger } = c.get('services')
		try {
			const scheduledReports = await compliance.scheduled.getScheduledReports()

			return c.json({
				success: true,
				scheduledReports,
			})
		} catch (error) {
			logger.error('Failed to get scheduled reports:', error)
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				},
				500
			)
		}
	})

	/**
	 * Get specific scheduled report
	 * GET /api/compliance/scheduled-reports/:id
	 */
	app.get('/scheduled-reports/:id', async (c) => {
		const { compliance, logger } = c.get('services')
		try {
			const reportId = c.req.param('id')
			const scheduledReport = await compliance.scheduled.getScheduledReport(reportId)

			if (!scheduledReport) {
				return c.json(
					{
						success: false,
						error: 'Scheduled report not found',
					},
					404
				)
			}

			return c.json({
				success: true,
				scheduledReport,
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get scheduled report: ${message}`)
			const error = new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
			throw error
		}
	})

	/**
	 * Update scheduled report
	 * PUT /api/compliance/scheduled-reports/:id
	 */
	app.put(
		'/scheduled-reports/:id',
		validator('json', (value, c) => {
			return value as Partial<ScheduledReportConfig>
		}),
		async (c) => {
			const { compliance, logger } = c.get('services')
			try {
				const reportId = c.req.param('id')
				const updates = c.req.valid('json')

				const updatedReport = await compliance.scheduled.updateScheduledReport(reportId, updates)

				logger.info(`Updated scheduled report: ${reportId}`)

				return c.json({
					success: true,
					scheduledReport: updatedReport,
				})
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to update scheduled report: ${message}`)
				const error = new ApiError({
					code: 'INTERNAL_SERVER_ERROR',
					message,
				})
				throw error
			}
		}
	)

	/**
	 * Delete scheduled report
	 * DELETE /api/compliance/scheduled-reports/:id
	 */
	app.delete('/scheduled-reports/:id', async (c) => {
		const { compliance, logger } = c.get('services')
		try {
			const reportId = c.req.param('id')

			await compliance.scheduled.deleteScheduledReport(reportId)

			logger.info(`Deleted scheduled report: ${reportId}`)

			return c.json({
				success: true,
				message: 'Scheduled report deleted successfully',
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to delete scheduled report: ${message}`)
			const error = new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
			throw error
		}
	})

	/**
	 * Execute scheduled report immediately
	 * POST /api/compliance/scheduled-reports/:id/execute
	 */
	app.post('/scheduled-reports/:id/execute', async (c) => {
		const { compliance, logger } = c.get('services')
		try {
			const reportId = c.req.param('id')

			const execution = await compliance.scheduled.executeReport(reportId)

			logger.info(`Executed scheduled report: ${reportId}`)

			return c.json({
				success: true,
				execution,
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to execute scheduled report: ${message}`)
			const error = new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
			throw error
		}
	})

	/**
	 * Get execution history for scheduled report
	 * GET /api/compliance/scheduled-reports/:id/executions
	 */
	app.get('/scheduled-reports/:id/executions', async (c) => {
		const { compliance, logger } = c.get('services')
		try {
			const reportId = c.req.param('id')
			const limit = parseInt(c.req.query('limit') || '50')

			const executions = await compliance.scheduled.getExecutionHistory(reportId, limit)

			return c.json({
				success: true,
				executions,
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get execution history: ${message}`)
			const error = new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
			throw error
		}
	})

	/**
	 * Get report templates
	 * GET /api/compliance/templates
	 */
	app.get('/templates', async (c) => {
		const { compliance, logger } = c.get('services')
		try {
			const templates = await compliance.scheduled.getReportTemplates()

			return c.json({
				success: true,
				templates,
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get report templates: ${message}`)
			const error = new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
			throw error
		}
	})

	return app
}

/**
 * Helper function to fetch audit events from database based on criteria
 */
async function fetchAuditEvents(db: any, criteria: ReportCriteria): Promise<any[]> {
	// This is a simplified implementation
	// In a real implementation, would use proper database queries with the criteria

	// Placeholder query - would implement proper filtering based on criteria
	// Import the audit log table schema
	const { auditLog } = await import('@repo/audit-db/src/db/schema.js')

	const events = await db
		.select()
		.from(auditLog)
		.limit(criteria.limit || 1000)

	return events
}
