import { protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import z from 'zod'

import type { TRPCRouterRecord } from '@trpc/server'

const alertsRouter = {
	active: protectedProcedure.query(async ({ ctx }) => {
		const { alert, logger, error } = ctx.services
		try {
			//const alerts = await alert.getActiveAlerts(ctx.session.session.activeOrganizationId as string)
			const alerts = await alert.getActiveAlerts('G47R3UBSyF2aVGT3hwMKbh06aZngIA8m')
			return alerts
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get active alerts: ${message}`)
			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to get active alerts: ${message}`,
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
				'alerts.active'
			)
			throw err
		}
	}),
	statistics: protectedProcedure.query(async ({ ctx }) => {
		const { alert, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string
		try {
			//const statistics = await alert.getAlertStatistics(organizationId)
			const statistics = await alert.getAlertStatistics('G47R3UBSyF2aVGT3hwMKbh06aZngIA8m')
			return statistics
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get alerts statistics: ${message}`)
			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to get alerts statistics: ${message}`,
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
				'alerts.statistics'
			)
			throw err
		}
	}),
	resolve: protectedProcedure
		.input(
			z.object({
				alertId: z.string(),
				resolvedBy: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { alert, logger, error } = ctx.services
			const resolvedBy = input.resolvedBy || ctx.session.session.userId
			try {
				await alert.resolveAlert(input.alertId, resolvedBy)
				return {
					success: true,
					message: `Alert ${input.alertId} resolved by ${resolvedBy}`,
					timestamp: new Date().toISOString(),
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to resolve alert ${input.alertId}: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to resolve alert ${input.alertId}: ${message}`,
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
					'alerts.resolve'
				)
				throw err
			}
		}),
} satisfies TRPCRouterRecord

export { alertsRouter }
