import { inngest } from '../client'

export const helloWorld = inngest.createFunction(
	{ id: 'hello-world' },
	{ event: 'demo/event.sent' },
	async ({ event, step, env, session, services }) => {
		const { health } = services
		const healthStatus = await health.checkAllComponents()

		// Use "env" to access the Cloudflare Workers environment variables
		// (e.g. env.TEST_ENV_VAR)
		// This is passed using the bindingsMiddleware in middleware.ts
		return {
			message: `Hello ${event.data.message}!`,
			healthStatus,
		}
	}
)
