import 'dotenv/config'

import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import { cors } from 'hono/cors'

import { auth } from '@repo/auth'

import { newApp } from './lib/hono/'
import { init } from './lib/hono/init'
import { nodeEnv } from './lib/hono/node-env'
import { logger } from './lib/logs/middleware.js'
import { appRouter } from './routers/index'
import { createComplianceAPI } from './routes/compliance-api'

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

app.use('/trpc/*', async (c, next) =>
	trpcServer({
		router: appRouter,
		createContext: () => ({
			services: c.get('services'),
			session: c.get('session'),
			requestId: c.get('requestId'),
		}),
	})(c, next)
)

// Mount compliance API routes
const complianceAPI = createComplianceAPI(app)
app.route('/api/compliance', complianceAPI)

app.get('/session', (c) => {
	return c.json(c.get('session'))
})

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
