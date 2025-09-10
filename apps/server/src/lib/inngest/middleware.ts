import { type Context } from 'hono'
import { InngestMiddleware } from 'inngest'

import type { HonoEnv } from '../hono/context.js'

/**
 * This middleware is used to pass the Hono environment variables
 * to Inngest functions.
 */
export const bindingsMiddleware = new InngestMiddleware({
	name: 'Hono Environment',
	init({ client, fn }) {
		return {
			onFunctionRun({ ctx, fn, steps, reqArgs }) {
				return {
					transformInput({ ctx, fn, steps }) {
						const [honoCtx] = reqArgs as [Context<HonoEnv>]
						return {
							ctx: {
								env: honoCtx.env,
								session: honoCtx.var.session,
								services: honoCtx.var.services,
							},
						}
					},
				}
			},
		}
	},
})
