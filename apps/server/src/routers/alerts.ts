import { protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import z from 'zod'

import type { TRPCRouterRecord } from '@trpc/server'
import type { AlertQueryFilters } from '@repo/audit'

const alertsRouter = {
	active: protectedProcedure.query(async ({ ctx }) => {
		const { monitor, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string
		try {
			const alerts = await monitor.alert.getActiveAlerts(organizationId)
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
	resolved: protectedProcedure.query(async ({ ctx }) => {
		const { monitor, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string
		const filter: AlertQueryFilters = {
			organizationId,
			resolved: true,
		}
		try {
			const alerts = await monitor.alert.getAlerts(filter)
			return alerts
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get resolved alerts: ${message}`)
			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to get resolved alerts: ${message}`,
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
				'alerts.resolved'
			)
			throw err
		}
	}),
	statistics: protectedProcedure.query(async ({ ctx }) => {
		const { monitor, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string
		try {
			const statistics = await monitor.alert.getAlertStatistics(organizationId)
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
				resolutionNotes: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { monitor, logger, error } = ctx.services
			const resolvedBy = ctx.session.session.userId
			const resolutionData = {
				resolvedBy,
				resolutionNotes: input.resolutionNotes,
			}
			try {
				const result = await monitor.alert.resolveAlert(input.alertId, resolvedBy, resolutionData)
				return {
					success: result.success,
					message: `Alert ${input.alertId} resolved by ${resolvedBy}`,
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
	cleanup: protectedProcedure
		.input(
			z.object({
				retentionDays: z.number().min(1).max(365).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { monitor, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string
			try {
				const result = await monitor.alert.cleanupResolvedAlerts(
					organizationId,
					input.retentionDays
				)
				return {
					deletedAlerts: result,
					message: `${result > 0 ? `Deleted ${result} resolved alerts` : 'No resolved alerts to delete'}`,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to delete resolved alerts: ${message}`)
				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to delete resolved alerts: ${message}`,
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
					'alerts.cleanup'
				)
				throw err
			}
		}),
} satisfies TRPCRouterRecord

export { alertsRouter }
