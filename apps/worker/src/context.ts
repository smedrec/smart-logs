import {
	DatabaseAlertHandler,
	DatabaseErrorLogger,
	ErrorHandler,
	HealthCheckService,
	MonitoringService,
} from '@repo/audit'
import {
	AuditDb,
	auditLog as auditLogTableSchema,
	errorAggregation,
	errorLog,
} from '@repo/audit-db'

import { auth } from './auth'

import type { Context as HonoContext } from 'hono'

export type CreateContextOptions = {
	context: HonoContext
}

// Using environment variable AUDIT_DB_URL
let auditDbService: AuditDb | undefined = undefined
export { auditDbService }
// Monitoring and health check services
let databaseAlertHandler: DatabaseAlertHandler | undefined = undefined
let monitoringService: MonitoringService | undefined = undefined
let healthCheckService: HealthCheckService | undefined = undefined

// Error handling services
let errorHandler: ErrorHandler | undefined = undefined
let databaseErrorLogger: DatabaseErrorLogger | undefined = undefined

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	})
	if (!auditDbService) {
		auditDbService = new AuditDb(process.env.AUDIT_DB_URL)
	}
	const db = auditDbService.getDrizzleInstance()
	databaseErrorLogger = new DatabaseErrorLogger(db, errorLog, errorAggregation)
	databaseAlertHandler = new DatabaseAlertHandler(db)
	return {
		databaseErrorLogger,
		databaseAlertHandler,
		session,
	}
}

export type Context = Awaited<ReturnType<typeof createContext>>
