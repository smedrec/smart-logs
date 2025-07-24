import 'dotenv/config'

import { serve as honoServe } from '@hono/node-server'
import { serve } from 'inngest/hono'

import { useConsoleLogger } from '@repo/hono-helpers'

import { functions, inngest } from './inngest/index.js'
import { newApp } from './lib/hono'
import { init } from './lib/hono/init'
import { nodeEnv } from './lib/hono/node-env'

const app = newApp()

if (process.env.NODE_ENV !== 'production') {
	app.use('*', nodeEnv())
}

app.use('*', init())
app.use(useConsoleLogger())

app.on(
	['GET', 'PUT', 'POST'],
	'/api/inngest',
	serve({
		client: inngest,
		functions,
	})
)

app.post('/hello', async (c) => {
	const session = c.get('session')
	const event = await inngest.send({
		// The event name
		name: 'demo/event.sent',
		// The event's data
		data: {
			message: 'Hello from Inngest!',
		},
		user: {
			id: session?.session.userId,
			organizationId: session?.session.activeOrganizationId,
		},
	})
	return c.json({
		message: 'Event sent',
		id: event.ids[0],
	})
})

app.get('/session', (c) => {
	return c.json(c.get('session'))
})

honoServe(
	{
		fetch: app.fetch,
		port: 3002,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`)
	}
)
