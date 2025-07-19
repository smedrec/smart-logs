import { protectedProcedure, publicProcedure, router } from '../lib/trpc/index'

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return 'OK'
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: 'This is private',
			user: ctx.session.user,
		}
	}),
	alerts: protectedProcedure.query(async ({ ctx }) => {
		const alerts = await ctx.databaseAlertHandler.getActiveAlerts(
			ctx.session.session.activeOrganizationId as string
		)
		return alerts
	}),
})
export type AppRouter = typeof appRouter
