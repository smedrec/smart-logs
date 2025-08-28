import { protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import z from 'zod'

import { auditLog } from '@repo/audit-db'

import { createTRPCRouter } from '.'

import type { TRPCRouterRecord } from '@trpc/server'
import type { ReportCriteria } from '@repo/audit'

const complianceReportsRouter = {
	/**
	 * Generate compliance report for HIPAA
	 */
	hipaa: protectedProcedure
		.input(
			z.object({
				criteria: z.object({
					startDate: z.string().datetime().optional(),
					endDate: z.string().datetime().optional(),
					principalIds: z.array(z.string()).optional(),
					organizationIds: z.array(z.string()).optional(),
					actions: z.array(z.string()).optional(),
					statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
					dataClassifications: z
						.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
						.optional(),
					resourceTypes: z.array(z.string()).optional(),
				}),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { compliance, logger, error } = ctx.services

			const criteria = input.criteria
			const criteriaWithOrganizationId = {
				...criteria,
				dateRange: {
					startDate:
						criteria.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
					endDate: criteria.endDate || new Date().toISOString(),
				},
				organizationIds: [ctx.session?.session.activeOrganizationId as string],
			}

			try {
				// Generate HIPAA report
				const report = await compliance.report.generateHIPAAReport(criteriaWithOrganizationId)
				return {
					success: true,
					report,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate HIPAA report: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate HIPAA report: ${message}`,
				})
				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session?.session.userId,
						sessionId: ctx.session?.session.id,
						metadata: {
							organizationId: ctx.session?.session.activeOrganizationId,
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
	/**
	 * Generate compliance report for GDPR
	 */
	gdpr: protectedProcedure
		.input(
			z.object({
				criteria: z.object({
					startDate: z.string().datetime().optional(),
					endDate: z.string().datetime().optional(),
					principalIds: z.array(z.string()).optional(),
					organizationIds: z.array(z.string()).optional(),
					actions: z.array(z.string()).optional(),
					statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
					dataClassifications: z
						.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
						.optional(),
					resourceTypes: z.array(z.string()).optional(),
				}),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { compliance, logger, error } = ctx.services

			const criteria = input.criteria
			const criteriaWithOrganizationId = {
				...criteria,
				dateRange: {
					startDate:
						criteria.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
					endDate: criteria.endDate || new Date().toISOString(),
				},
				organizationIds: [ctx.session?.session.activeOrganizationId as string],
			}

			try {
				// Generate GDPR report
				const report = await compliance.report.generateGDPRReport(criteriaWithOrganizationId)
				return {
					success: true,
					report,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate GDPR report: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate GDPR report: ${message}`,
				})
				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session?.session.userId,
						sessionId: ctx.session?.session.id,
						metadata: {
							organizationId: ctx.session?.session.activeOrganizationId,
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
	/**
	 * Generate integrity verification report
	 */
	integrity: protectedProcedure
		.input(
			z.object({
				criteria: z.object({
					startDate: z.string().datetime().optional(),
					endDate: z.string().datetime().optional(),
					principalIds: z.array(z.string()).optional(),
					organizationIds: z.array(z.string()).optional(),
					actions: z.array(z.string()).optional(),
					statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
					dataClassifications: z
						.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
						.optional(),
					resourceTypes: z.array(z.string()).optional(),
				}),
				performVerification: z.boolean().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { compliance, logger, error } = ctx.services

			const criteria = input.criteria
			const performVerification = input.performVerification ?? true
			const criteriaWithDateRange = {
				...criteria,
				dateRange: {
					startDate:
						criteria.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
					endDate: criteria.endDate || new Date().toISOString(),
				},
				organizationIds: [ctx.session?.session.activeOrganizationId as string],
			}

			try {
				// Generate integrity verification report
				const report = await compliance.report.generateIntegrityVerificationReport(
					criteriaWithDateRange,
					performVerification
				)
				return {
					success: true,
					report,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate integrity verification report: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate integrity verification report: ${message}`,
				})
				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session?.session.userId,
						sessionId: ctx.session?.session.id,
						metadata: {
							organizationId: ctx.session?.session.activeOrganizationId,
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
			const { compliance, logger, error } = ctx.services
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
						userId: ctx.session?.session.userId,
						sessionId: ctx.session?.session.id,
						metadata: {
							organizationId: ctx.session?.session.activeOrganizationId,
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
