import { protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import z from 'zod'

import type { TRPCRouterRecord } from '@trpc/server'
import type { DataClassification } from '@repo/audit'

const presetsRouter = {
	all: protectedProcedure.query(async ({ ctx }) => {
		const { compliance, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string
		try {
			const presets = await compliance.preset.getPresets(organizationId)
			return presets
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get all audit presets: ${message}`)
			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to get all audit presets: ${message}`,
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
				'presets.all'
			)
			throw err
		}
	}),
	name: protectedProcedure
		.input(
			z.object({
				name: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			const { compliance, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string
			try {
				const preset = await compliance.preset.getPreset(input.name, organizationId)
				return preset
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get the audit preset: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to get the audit preset: ${message}`,
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
					'presets.name'
				)
				throw err
			}
		}),
	create: protectedProcedure
		.input(
			z.object({
				name: z.string(),
				description: z.string().optional(),
				action: z.string(),
				dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
				requiredFields: z.array(z.string()),
				defaultValues: z
					.object({
						retentionPolicy: z.string(),
					})
					.optional(),
				validation: z
					.object({
						maxStringLength: z.number(),
						allowedDataClassifications: z.array(
							z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'])
						),
						requiredFields: z.array(z.string()),
						maxCustomFieldDepth: z.number(),
						allowedEventVersions: z.array(z.string()),
					})
					.optional(),
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
				action: input.action,
				dataClassification: input.dataClassification as DataClassification,
				requiredFields: input.requiredFields as string[],
				defaultValues: input.defaultValues || {},
				validation: input.validation,
				createdBy: userId,
			}
			try {
				const preset = await compliance.preset.createPreset(record)
				return {
					success: true,
					message: `Audit Preset ${preset.name} created by ${userId}`,
					timestamp: new Date().toISOString(),
					preset,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to create audit preset: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to create audit preset: ${message}`,
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
					'presets.create'
				)
				throw err
			}
		}),
} satisfies TRPCRouterRecord

export { presetsRouter }
