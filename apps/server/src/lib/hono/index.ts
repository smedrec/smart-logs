import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'

import { useNotFound } from '@repo/hono-helpers'

import { handleError, handleZodError } from '../errors/index.js'

import type { Context as GenericContext } from 'hono'
import type { AuditConfig } from '@repo/audit'
import type { HonoEnv } from './context.js'

//import { sentry } from '@hono/sentry';

export function newApp(config: AuditConfig) {
	const app = new Hono<HonoEnv>()

	app.use(prettyJSON())
	app.onError(handleError)
	app.notFound(useNotFound())
	//app.use('*', sentry({
	//  dsn: process.env.SENTRY_DSN,
	//}));

	app.use('*', async (c, next) => {
		// FIXME: This is a temporary fix for Hono's bug with IP address parsing
		// @ts-ignore
		c.set(
			'location',
			c.req.header('True-Client-IP') ??
				c.req.header('CF-Connecting-IP') ??
				//c.req.raw?.cf?.colo ??
				'127.0.0.1'
		)
		c.set('userAgent', c.req.header('User-Agent') ?? 'unknown')

		return next()
	})

	return app
}

export type App = ReturnType<typeof newApp>
export type Context = GenericContext<HonoEnv>
