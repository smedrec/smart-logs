import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'

import type { Context } from './context'

export const t = initTRPC.context<Context>().create({
	transformer: superjson,
})

export const router = t.router

export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.session) {
		const { error } = ctx.services
		const err = new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'Authentication required',
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
