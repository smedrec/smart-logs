import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'

import { useNotFound } from '@repo/hono-helpers'

import { auth } from '../auth/index.js'
import { handleError, handleZodError } from '../errors/index.js'

import type { Context as GenericContext } from 'hono'
import type { HonoEnv } from './context.js'

//import { sentry } from '@hono/sentry';

export function newApp() {
	const app = new Hono<HonoEnv>()

	app.use(prettyJSON())
	app.onError(handleError)
	app.notFound(useNotFound())
	//app.use('*', sentry({
	//  dsn: process.env.SENTRY_DSN,
	//}));

	app.use('*', async (c, next) => {
		// @ts-ignore
		c.set(
			'location',
			c.req.header('True-Client-IP') ??
				c.req.header('CF-Connecting-IP') ??
				//c.req.raw?.cf?.colo ??
				''
		)
		c.set('userAgent', c.req.header('User-Agent'))

		const session = await auth.api.getSession({
			query: {
				disableCookieCache: true,
			},
			headers: c.req.raw.headers,
		})

		if (!session) {
			c.set('session', null)
			return next()
		}

		// FIXME - solve this session type structure
		/**if (c.req.header('x-api-key')) {
			const organization = await getActiveOrganization(session.session?.userId)
			session.session.activeOrganizationId = organization?.organizationId
			session.session.activeOrganizationRole = organization?.role ?? null
		}*/

		c.set('session', session)

		return next()
	})

	return app
}

export type App = ReturnType<typeof newApp>
export type Context = GenericContext<HonoEnv>
