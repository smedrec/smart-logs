import { AuditClient } from '@smedrec/audit-client'

import type { PartialAuditClientConfig } from '@smedrec/audit-client'

const options: PartialAuditClientConfig = {
	baseUrl: import.meta.env.VITE_SERVER_URL,
	apiVersion: 'v1',
	timeout: 60000,
	environment: 'development',
	authentication: {
		type: 'session',
		autoRefresh: true,
	},
	// Enable automatic retries on network errors or server issues
	retry: {
		enabled: true,
		maxAttempts: 3,
	},
	// Enable in-memory caching for GET requests to reduce latency
	cache: {
		enabled: true,
		defaultTtlMs: 60000, // Cache responses for 1 minute
	},
	// Configure logging for better observability
	logging: {
		enabled: true,
		level: 'info', // Can be 'debug', 'info', 'warn', or 'error'
	},
}

export const auditClient = new AuditClient(options)
