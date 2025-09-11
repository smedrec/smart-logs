import { AuditClient } from '@smedrec/audit-client'

import type { PartialAuditClientConfig } from '@smedrec/audit-client'

const options: PartialAuditClientConfig = {
	baseUrl: 'http://localhost:3000',
	apiVersion: 'v1',
	timeout: 60000,
	environment: 'development',
	authentication: {
		type: 'session',
		autoRefresh: true,
	},
}

export const auditClient = new AuditClient(options)
