import 'dotenv/config'

import { serve as honoServe } from '@hono/node-server'
import { serve } from 'inngest/hono'

import { functions, inngest } from './inngest/index.js'
import { newApp } from './lib/hono'
import { init } from './lib/hono/init'
import { nodeEnv } from './lib/hono/node-env'
import { logger } from './lib/logs/middleware'

const app = newApp()

if (process.env.NODE_ENV !== 'production') {
	app.use('*', nodeEnv())
}

app.use('*', init())
app.use(logger())

app.on(
	['GET', 'PUT', 'POST'],
	'/api/inngest',
	serve({
		client: inngest,
		functions,
	})
)

honoServe(
	{
		fetch: app.fetch,
		port: 3002,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`)
	}
)
