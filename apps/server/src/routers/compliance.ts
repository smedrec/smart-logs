import { protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import z from 'zod'

import { auditLog } from '@repo/audit-db'

import { createTRPCRouter } from '.'

import type { TRPCRouterRecord } from '@trpc/server'
import type { ReportCriteria } from '@repo/audit'

/**
 * Helper function to fetch audit events from database based on criteria
 */
async function fetchAuditEvents(db: any, criteria: ReportCriteria): Promise<any[]> {
	// This is a simplified implementation
	// In a real implementation, would use proper database queries with the criteria

	const events = await db
		.select()
		.from(auditLog)
		.where((event: any) => {
			return (
				event.timestamp >= criteria.dateRange.startDate &&
				event.timestamp <= criteria.dateRange.endDate
			)
		})
		.limit(criteria.limit || 1000)

	return events
}

const complianceReportsRouter = {
	/**
	 * Generate general compliance report
	 */
	generate: protectedProcedure
		.input(
			z.object({
				reportType: z.string(),
				criteria: z.object({
					dateRange: z.object({
						startDate: z.string(),
						endDate: z.string(),
					}),
					limit: z.number().optional(),
				}),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { compliance, db, logger, error } = ctx.services
			const reportType = input.reportType
			let criteria: ReportCriteria = input.criteria
			criteria = {
				...criteria,
				organizationIds: [ctx.session.session.activeOrganizationId as string],
			}
			try {
				const events = await fetchAuditEvents(db.audit, criteria)
				// Generate report
				const report = await compliance.report.generateComplianceReport(
					events,
					criteria,
					reportType
				)
				return {
					success: true,
					report,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate compliance report:: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate compliance report:: ${message}`,
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
					'processComplianceReportsGenerate'
				)
				throw err
			}
		}),
} satisfies TRPCRouterRecord

const complianceExportRouter = {
	/**
	 * Generate general compliance export
	 */
	report: protectedProcedure
		.input(
			z.object({
				report: z.any(),
				config: z.object({
					format: z.enum(['json', 'csv', 'xml', 'pdf']),
					includeMetadata: z.boolean().optional(),
					includeIntegrityReport: z.boolean().optional(),
					compression: z.enum(['none', 'zip', 'gzip']).optional(),
					encryption: z
						.object({
							enabled: z.boolean(),
							algorithm: z.string().optional(),
							key: z.string().optional(),
						})
						.optional(),
				}),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { compliance, db, logger, error } = ctx.services
			const { report, config } = input
			try {
				// Generate report
				const exportResult = await compliance.export.exportComplianceReport(report, config)
				return {
					success: true,
					exportResult,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate compliance report:: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate compliance report:: ${message}`,
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
					'processComplianceReportsGenerate'
				)
				throw err
			}
		}),
} satisfies TRPCRouterRecord

const complianceRouter = createTRPCRouter({
	report: complianceReportsRouter,
	export: complianceExportRouter,
})

export { complianceRouter }
