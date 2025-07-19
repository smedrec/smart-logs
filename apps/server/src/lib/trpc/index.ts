import { initTRPC, TRPCError } from '@trpc/server'

import type { Context } from './context'

export const t = initTRPC.context<Context>().create()

export const router = t.router

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.session) {
		const err = new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'Authentication required',
			cause: 'No session',
		})
		await ctx.errorHandler.handleError(
			err,
			{
				metadata: {
					message: err.message,
					name: err.name,
					code: err.code,
					cause: err.cause,
				},
			},
			'trpc-api',
			'processProtectedProcedure'
		)
		throw err
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	})
})
