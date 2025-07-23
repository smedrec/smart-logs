import { Inngest } from 'inngest'

import { bindingsMiddleware } from './middleware.js'
import { schemas } from './types.js'

export const inngest = new Inngest({
	id: 'smart-logs-app-dev',
	eventKey: process.env.INNGEST_EVENT_KEY,
	baseUrl: process.env.INNGEST_BASE_URL,
	schemas,
	middleware: [bindingsMiddleware],
})
