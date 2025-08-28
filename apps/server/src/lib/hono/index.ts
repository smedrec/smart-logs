import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'

import { getActiveOrganization } from '@repo/auth'
import { useNotFound } from '@repo/hono-helpers'

import { getAuthDb, getAuthInstance } from '../auth.js'
import { handleError, handleZodError } from '../errors/index.js'

import type { Context as GenericContext } from 'hono'
import type { AuditConfig } from '@repo/audit'
import type { Session } from '@repo/auth'
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

		const auth = await getAuthInstance(config)
		const apiKey =
			c.req.header('x-api-key') || c.req.header('authorization')?.replace('Bearer ', '')

		// Try API key authentication first
		if (apiKey) {
			c.set('isApiKeyAuth', true)
			try {
				// Validate API key using Better Auth's API key plugin
				let apiKeySession = (await auth.api.getSession({
					headers: new Headers({
						'x-api-key': apiKey,
					}),
				})) as Session

				if (apiKeySession) {
					if (!apiKeySession.session.ipAddress || apiKeySession.session.ipAddress === '') {
						apiKeySession.session.ipAddress = c.get('location')
					}

					if (!apiKeySession.session.userAgent || apiKeySession.session.userAgent === '') {
						apiKeySession.session.userAgent = c.get('userAgent')
					}
					const db = await getAuthDb(config)
					const org = await getActiveOrganization(apiKeySession.session.userId, db)
					if (org) {
						apiKeySession = {
							session: {
								...apiKeySession.session,
								activeOrganizationId: org.organizationId,
								activeOrganizationRole: org.role,
							},
							user: {
								...apiKeySession.user,
							},
						}
					}
					c.set('session', apiKeySession as Session)
					return next()
				}
			} catch (error) {
				// API key validation failed, continue with session auth
				console.warn('API key validation failed:', error)
				c.set('session', null)
				return next()
			}
		}

		// Try session authentication
		c.set('isApiKeyAuth', false)
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

		if (!session.session.ipAddress || session.session.ipAddress === '') {
			session.session.ipAddress = c.get('location')
		}

		if (!session.session.userAgent || session.session.userAgent === '') {
			session.session.userAgent = c.get('userAgent')
		}

		c.set('session', session as Session)
		return next()
	})

	return app
}

export type App = ReturnType<typeof newApp>
export type Context = GenericContext<HonoEnv>
