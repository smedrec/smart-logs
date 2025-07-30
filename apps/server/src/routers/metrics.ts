import { protectedProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'

import type { TRPCRouterRecord } from '@trpc/server'

const metricsRouter = {
	status: protectedProcedure.query(async ({ ctx }) => {
		const { monitor, logger, error } = ctx.services

		try {
			const healthStatus = await monitor.metrics.getHealthStatus()

			return healthStatus
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Metrics status check failed with error: ${message}`)
			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Metrics status check failed with error: ${message}`,
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
				'metrics.status'
			)
			throw err
		}
	}),
} satisfies TRPCRouterRecord
export { metricsRouter }
