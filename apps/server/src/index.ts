import 'dotenv/config'

import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import { cors } from 'hono/cors'

import { auth } from './lib/auth'
import { newApp } from './lib/hono/'
import { init } from './lib/hono/init'
import { nodeEnv } from './lib/hono/node-env'
import { logger } from './lib/logs/middleware.js'
import { createContext } from './lib/trpc/context'
import { appRouter } from './routers/index'

const app = newApp()

if (process.env.NODE_ENV !== 'production') {
	app.use('*', nodeEnv())
}

app.use('*', init())
app.use(logger())

app.use(
	'/*',
	cors({
		origin: process.env.CORS_ORIGIN || '',
		allowMethods: ['GET', 'POST', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	})
)

app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw))

app.use(
	'/trpc/*',
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context })
		},
	})
)

app.get('/', (c) => {
	return c.text('OK')
})

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`)
	}
)
