import { protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import z from 'zod'

import type { TRPCRouterRecord } from '@trpc/server'

const templatesRouter = {
	all: protectedProcedure.query(async ({ ctx }) => {
		const { compliance, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string
		try {
			const templates = await compliance.scheduled.getReportTemplates(organizationId)
			return templates
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get all compliance report templates: ${message}`)
			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to get all compliance report templates: ${message}`,
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
				'templates.all'
			)
			throw err
		}
	}),
	id: protectedProcedure
		.input(
			z.object({
				id: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			const { compliance, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string
			try {
				const template = await compliance.scheduled.getReportTemplate(input.id, organizationId)
				return template
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get the compliance report template: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to get the compliance report template: ${message}`,
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
					'templates.id'
				)
				throw err
			}
		}),
	create: protectedProcedure
		.input(
			z.object({
				name: z.string(),
				description: z.string().optional(),
				reportType: z.enum([
					'HIPAA_AUDIT_TRAIL',
					'GDPR_PROCESSING_ACTIVITIES',
					'GENERAL_COMPLIANCE',
					'INTEGRITY_VERIFICATION',
				]),
				defaultCriteria: z.object({
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
					limit: z.number().optional(), // Maximum number of events to include
					offset: z.number().optional(), // Offset for pagination
				}),
				defaultFormat: z.enum(['json', 'csv', 'xml', 'pdf']),
				defaultExportConfig: z.object({
					format: z.enum(['json', 'csv', 'xml', 'pdf']),
					includeMetadata: z.boolean().optional(),
					includeIntegrityReport: z.boolean().optional(),
					compression: z.enum(['none', 'gzip', 'zip']).optional(),
					encryption: z
						.object({
							enabled: z.boolean(),
							algorithm: z.string().optional(),
							keyId: z.string().optional(),
						})
						.optional(),
				}),
				tags: z.array(z.string()),
				isActive: z.boolean(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { compliance, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string
			const userId = ctx.session.session.userId as string
			const record = {
				name: input.name,
				description: input.description || undefined,
				organizationId,
				reportType: input.reportType,
				defaultCriteria: input.defaultCriteria,
				defaultFormat: input.defaultFormat,
				defaultExportConfig: input.defaultExportConfig,
				tags: input.tags,
				isActive: input.isActive,
				createdBy: userId,
				updatedBy: userId,
			}
			try {
				const template = await compliance.scheduled.createReportTemplate(record)
				return {
					success: true,
					message: `Report Template ${template.id} created by ${userId}`,
					timestamp: new Date().toISOString(),
					template,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to create report template: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to create report template: ${message}`,
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
					'templates.create'
				)
				throw err
			}
		}),
} satisfies TRPCRouterRecord

export { templatesRouter }
