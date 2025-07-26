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
} satisfies TRPCRouterRecord

export { reportsRouter }
