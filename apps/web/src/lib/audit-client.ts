import { AuditClient } from '@repo/audit-client'

import type { ClientOptions } from '@repo/audit-client'

const options: ClientOptions = {
	baseUrl: 'http://localhost:3000',
}

export const auditClient = new AuditClient(options)
