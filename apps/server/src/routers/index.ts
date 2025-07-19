import { TRPCError } from '@trpc/server'

import { protectedProcedure, publicProcedure, router } from '../lib/trpc/index'

export const appRouter = router({
	healthCheck: publicProcedure.query(async ({ ctx }) => {
		const { health, logger, error } = ctx.services

		try {
			const healthStatus = await health.checkAllComponents()

			if (healthStatus.status === 'OK') {
				return healthStatus
			} else {
				logger.warn(`Health check failed with status: ${healthStatus.status}`)
				const err = new TRPCError({
					code: 'SERVICE_UNAVAILABLE',
					message: `Health check failed with status: ${healthStatus.status}`,
					cause: healthStatus.components,
				})
				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						metadata: {
							message: err.message,
							name: err.name,
							code: err.code,
							cause: err.cause,
							details: healthStatus,	
						},
					},
					'trpc-api',
					'processhealthCheck'
				)
				throw err
			}
		} catch (e) {
			logger.error('Health check failed with error:')
			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Health check failed with error',
				cause: 'No session',
			})
			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					metadata: {
						message: err.message,
						name: err.name,
						code: err.code,
						cause: err.cause,
					},
				},
				'trpc-api',
				'processhealthCheck'
			)
			throw err
		}
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: 'This is private',
			user: ctx.session.user,
		}
	}),
	alerts: protectedProcedure.query(async ({ ctx }) => {
		const { alert } = ctx.services
		const alerts = await alert.getActiveAlerts(ctx.session.session.activeOrganizationId as string)
		return alerts
	}),
})
export type AppRouter = typeof appRouter
