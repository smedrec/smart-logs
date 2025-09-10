/**
 * @fileoverview Inngest Functions API
 *
 * Provides REST API endpoints for Inngest functions:
 * - Hello World
 *
 */
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { openApiErrorResponses } from '../lib/errors/openapi_responses.js'

import type { HonoEnv } from '../lib/hono/context.js'

// Route definitions
const helloWorldRoute = createRoute({
	method: 'post',
	path: '/hello',
	tags: ['Inngest Functions'],
	summary: 'Hello World',
	description: 'Returns a simple "Hello World" message.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: z.object({
						message: z.string().optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Event sent successfully',
			content: {
				'application/json': {
					schema: z.object({
						message: z.string(),
						id: z.string(),
					}),
				},
			},
		},
		...openApiErrorResponses,
	},
})

/**
 * Create Inngest functions API router
 */
export function createFunctionsAPI(): OpenAPIHono<any> {
	const app = new OpenAPIHono<HonoEnv>()

	// Hello World function
	app.openapi(helloWorldRoute, async (c) => {
		const { inngest } = c.get('services')
		const session = c.get('session')

		const { message } = c.req.valid('json')
		// Send an event to Inngest
		const event = await inngest.send({
			// The event name
			name: 'demo/event.sent',
			// The event's data
			data: {
				message: message || 'Hello from Inngest!',
			},
			user: {
				id: session?.session.userId,
				organizationId: session?.session.activeOrganizationId,
			},
		})
		return c.json(
			{
				message: 'Event sent',
				id: event.ids[0],
			},
			200
		)
	})

	return app
}
