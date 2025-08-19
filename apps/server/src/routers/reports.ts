import { protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import z from 'zod'

import type { TRPCRouterRecord } from '@trpc/server'
import type { ReportCriteria } from '@repo/audit'

const reportsRouter = {
	hipaa: protectedProcedure
		.input(
			z.object({
				criteria: z.object({
					dateRange: z.object({
						startDate: z.string(), // Start date for the data range
						endDate: z.string(), // End date for the data range
					}),
					principalIds: z.array(z.string()).optional(), // Filter by organization
					organizationIds: z.array(z.string()).optional(), // Filter by specific principals/users
					actions: z.array(z.string()).optional(), // Filter by specific actions
					dataClassifications: z
						.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
						.optional(), //  Filter by data classification levels
					statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(), // Filter by event status
					resourceTypes: z.array(z.string()).optional(), // Filter by resource types
					verifiedOnly: z.boolean().optional(), // Include only events with integrity verification
					includeIntegrityFailures: z.boolean().optional(), // Include failed integrity checks
					limit: z.number().default(50), // Maximum number of events to include
					offset: z.number().default(0), // Offset for pagination
					sortBy: z.enum(['timestamp', 'status']).optional(), // Sorting criteria
					sortOrder: z.enum(['asc', 'desc']).optional(), // Sorting direction
				}),
			})
		)
		.query(async ({ ctx, input }) => {
			const { compliance, db, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string
			const criteria: ReportCriteria = {
				...input.criteria,
				dateRange: {
					startDate: input.criteria.dateRange.startDate,
					endDate: input.criteria.dateRange.endDate,
				},
				organizationIds: [organizationId],
			}

			try {
				const report = await compliance.report.generateHIPAAReport(criteria)
				return report
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate hipaa report: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate hipaa report: ${message}`,
				})
				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session.session.userId,
						sessionId: ctx.session.session.id,
						metadata: {
							organizationId: ctx.session.session.activeOrganizationId,
							message: err.message,
							name: err.name,
							code: err.code,
							cause: err.cause,
						},
					},
					'trpc-api',
					'reports.hipaa'
				)
				throw err
			}
		}),
	gdpr: protectedProcedure
		.input(
			z.object({
				criteria: z.object({
					dateRange: z.object({
						startDate: z.string(), // Start date for the data range
						endDate: z.string(), // End date for the data range
					}),
					principalIds: z.array(z.string()).optional(), // Filter by organization
					organizationIds: z.array(z.string()).optional(), // Filter by specific principals/users
					actions: z.array(z.string()).optional(), // Filter by specific actions
					dataClassifications: z
						.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
						.optional(), //  Filter by data classification levels
					statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(), // Filter by event status
					resourceTypes: z.array(z.string()).optional(), // Filter by resource types
					verifiedOnly: z.boolean().optional(), // Include only events with integrity verification
					includeIntegrityFailures: z.boolean().optional(), // Include failed integrity checks
					limit: z.number().default(50), // Maximum number of events to include
					offset: z.number().default(0), // Offset for pagination
					sortBy: z.enum(['timestamp', 'status']).optional(), // Sorting criteria
					sortOrder: z.enum(['asc', 'desc']).optional(), // Sorting direction
				}),
			})
		)
		.query(async ({ ctx, input }) => {
			const { compliance, db, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string
			const criteria: ReportCriteria = {
				...input.criteria,
				dateRange: {
					startDate: input.criteria.dateRange.startDate,
					endDate: input.criteria.dateRange.endDate,
				},
				organizationIds: [organizationId],
			}

			try {
				const report = await compliance.report.generateGDPRReport(criteria)
				return report
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate gdpr report: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate gdpr report: ${message}`,
				})
				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session.session.userId,
						sessionId: ctx.session.session.id,
						metadata: {
							organizationId: ctx.session.session.activeOrganizationId,
							message: err.message,
							name: err.name,
							code: err.code,
							cause: err.cause,
						},
					},
					'trpc-api',
					'reports.gdpr'
				)
				throw err
			}
		}),

	/**
	 * Generate integrity verification report
	 * Requirement 7.3: Compliance reporting API integration
	 */
	integrity: protectedProcedure
		.input(
			z.object({
				criteria: z.object({
					dateRange: z.object({
						startDate: z.string(),
						endDate: z.string(),
					}),
					principalIds: z.array(z.string()).optional(),
					actions: z.array(z.string()).optional(),
					statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
					dataClassifications: z
						.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
						.optional(),
					resourceTypes: z.array(z.string()).optional(),
					verifiedOnly: z.boolean().optional(),
					limit: z.number().default(1000),
					offset: z.number().default(0),
				}),
				performVerification: z.boolean().default(true),
			})
		)
		.query(async ({ ctx, input }) => {
			const { compliance, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string

			try {
				const criteria: ReportCriteria = {
					...input.criteria,
					dateRange: {
						startDate: input.criteria.dateRange.startDate,
						endDate: input.criteria.dateRange.endDate,
					},
					organizationIds: [organizationId],
				}

				const report = await compliance.report.generateIntegrityVerificationReport(
					criteria,
					input.performVerification
				)

				logger.info('Integrity verification report generated', {
					organizationId,
					totalEvents: report.results.totalEvents,
					verifiedEvents: report.results.verifiedEvents,
					failedVerifications: report.results.failedVerifications,
					verificationRate: report.results.verificationRate,
				})

				return report
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate integrity report: ${message}`)

				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate integrity report: ${message}`,
				})

				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session.session.userId,
						sessionId: ctx.session.session.id,
						metadata: {
							organizationId,
							criteria: input.criteria,
							performVerification: input.performVerification,
							message: err.message,
							name: err.name,
							code: err.code,
						},
					},
					'trpc-api',
					'reports.integrity'
				)

				throw err
			}
		}),

	/**
	 * Generate custom compliance report
	 * Requirement 7.3: Compliance reporting API integration
	 */
	custom: protectedProcedure
		.input(
			z.object({
				reportName: z.string().min(1, 'Report name is required'),
				criteria: z.object({
					dateRange: z.object({
						startDate: z.string(),
						endDate: z.string(),
					}),
					principalIds: z.array(z.string()).optional(),
					organizationIds: z.array(z.string()).optional(),
					actions: z.array(z.string()).optional(),
					dataClassifications: z
						.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
						.optional(),
					statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
					resourceTypes: z.array(z.string()).optional(),
					verifiedOnly: z.boolean().optional(),
					includeIntegrityFailures: z.boolean().optional(),
					limit: z.number().default(1000),
					offset: z.number().default(0),
					sortBy: z.enum(['timestamp', 'status']).optional(),
					sortOrder: z.enum(['asc', 'desc']).optional(),
				}),
				includeIntegrityReport: z.boolean().default(false),
				customFields: z
					.array(
						z.object({
							name: z.string(),
							description: z.string(),
							calculation: z.enum(['count', 'sum', 'avg', 'min', 'max']),
							field: z.string(),
							groupBy: z.string().optional(),
						})
					)
					.optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const { compliance, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string

			try {
				const criteria: ReportCriteria = {
					...input.criteria,
					dateRange: {
						startDate: input.criteria.dateRange.startDate,
						endDate: input.criteria.dateRange.endDate,
					},
					organizationIds: [organizationId],
				}

				// Generate base compliance report
				const baseReport = await compliance.report.generateComplianceReport(
					[], // Events will be fetched internally
					criteria,
					`CUSTOM_${input.reportName.toUpperCase().replace(/\s+/g, '_')}`
				)

				// Add integrity report if requested
				let integrityReport = null
				if (input.includeIntegrityReport) {
					integrityReport = await compliance.report.generateIntegrityVerificationReport(
						criteria,
						true
					)
				}

				// Process custom fields (placeholder implementation)
				let customCalculations = null
				if (input.customFields?.length) {
					customCalculations = {}
					for (const field of input.customFields) {
						// This would need proper implementation based on the calculation type
						customCalculations[field.name] = {
							description: field.description,
							value: 0, // Placeholder
							calculation: field.calculation,
							field: field.field,
						}
					}
				}

				const customReport = {
					...baseReport,
					reportName: input.reportName,
					integrityReport,
					customCalculations,
					generatedBy: ctx.session.session.userId,
				}

				logger.info('Custom compliance report generated', {
					organizationId,
					reportName: input.reportName,
					totalEvents: baseReport.metadata.totalEvents,
					includeIntegrityReport: input.includeIntegrityReport,
					customFieldCount: input.customFields?.length || 0,
				})

				return customReport
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate custom report: ${message}`)

				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate custom report: ${message}`,
				})

				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session.session.userId,
						sessionId: ctx.session.session.id,
						metadata: {
							organizationId,
							reportName: input.reportName,
							criteria: input.criteria,
							message: err.message,
							name: err.name,
							code: err.code,
						},
					},
					'trpc-api',
					'reports.custom'
				)

				throw err
			}
		}),

	/**
	 * List available report templates
	 * Requirement 7.3: Compliance reporting API integration
	 */
	templates: protectedProcedure.query(async ({ ctx }) => {
		const { compliance, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string

		try {
			// Get scheduled reporting service to access templates
			const templates = await compliance.scheduled.getReportTemplates()

			logger.info('Report templates retrieved', {
				organizationId,
				templateCount: templates.length,
			})

			return templates
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get report templates: ${message}`)

			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to get report templates: ${message}`,
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						organizationId,
						message: err.message,
						name: err.name,
						code: err.code,
					},
				},
				'trpc-api',
				'reports.templates'
			)

			throw err
		}
	}),

	/**
	 * Get scheduled reports for the organization
	 * Requirement 7.3: Compliance reporting API integration
	 */
	scheduled: protectedProcedure.query(async ({ ctx }) => {
		const { compliance, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string

		try {
			const scheduledReports = await compliance.scheduled.getScheduledReports(organizationId)

			logger.info('Scheduled reports retrieved', {
				organizationId,
				reportCount: scheduledReports.length,
			})

			return scheduledReports
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get scheduled reports: ${message}`)

			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to get scheduled reports: ${message}`,
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						organizationId,
						message: err.message,
						name: err.name,
						code: err.code,
					},
				},
				'trpc-api',
				'reports.scheduled'
			)

			throw err
		}
	}),
} satisfies TRPCRouterRecord

export { reportsRouter }
