import { db as authDb } from '@/db/index.js'

import {
	Audit,
	DatabaseAlertHandler,
	DatabaseErrorLogger,
	DatabaseHealthCheck,
	ErrorHandler,
	HealthCheckService,
	MonitoringService,
	RedisHealthCheck,
} from '@repo/audit'
import { AuditDb, errorAggregation, errorLog } from '@repo/audit-db'

//import { InfisicalKmsClient } from '@repo/infisical-kms';

import { auth } from '../auth.js'
import { ConsoleLogger } from '../logs/index.js'

import type { MiddlewareHandler } from 'hono'
//import {initCache} from "../cache";
import type { HonoEnv } from '../hono/context.js'

/**
 * These maps persist between worker executions and are used for caching
 */
//const rlMap = new Map();

let isolateId: string | undefined = undefined
let isolateCreatedAt: number | undefined = undefined

let auditDbInstance: AuditDb | undefined = undefined

export { auditDbInstance }

let audit: Audit | undefined = undefined
export { audit }

// Alert and health check services
let databaseAlertHandler: DatabaseAlertHandler | undefined = undefined
let monitoringService: MonitoringService | undefined = undefined
let healthCheckService: HealthCheckService | undefined = undefined

// Error handling services
let errorHandler: ErrorHandler | undefined = undefined
let databaseErrorLogger: DatabaseErrorLogger | undefined = undefined

/**
 * Initialize all services.
 *
 * Call this once before any hono handlers run.
 */
export function init(): MiddlewareHandler<HonoEnv> {
	return async (c, next) => {
		if (!isolateId) {
			isolateId = crypto.randomUUID()
		}
		if (!isolateCreatedAt) {
			isolateCreatedAt = Date.now()
		}
		c.set('isolateId', isolateId)
		c.set('isolateCreatedAt', isolateCreatedAt)
		const requestId = crypto.randomUUID()
		c.set('requestId', requestId)

		c.set('requestStartedAt', Date.now())

		c.res.headers.set('x-requestId', requestId)

		const logger = new ConsoleLogger({
			requestId,
			application: 'api',
			environment: c.env.ENVIRONMENT as 'VITEST' | 'development' | 'staging' | 'production',
			defaultFields: { environment: c.env.ENVIRONMENT },
		})

		if (!auditDbInstance) {
			auditDbInstance = new AuditDb(c.env.AUDIT_DB_URL)
			// Check the database connection
			const isConnected = await auditDbInstance.checkAuditDbConnection()
			if (!isConnected) {
				console.error('Failed to connect to the audit database. Exiting.')
				process.exit(1)
			}
		}

		// Get the Drizzle ORM instance
		const db = {
			auth: authDb,
			audit: auditDbInstance.getDrizzleInstance(),
		}

		if (!healthCheckService) {
			healthCheckService = new HealthCheckService()
			// Register health checks
			healthCheckService.registerHealthCheck(
				new DatabaseHealthCheck(() => auditDbInstance!.checkAuditDbConnection())
			)
			//healthCheckService.registerHealthCheck(new RedisHealthCheck(() => getRedisConnectionStatus()))
		}

		if (!audit) audit = new Audit('audit')

		if (!databaseAlertHandler) databaseAlertHandler = new DatabaseAlertHandler(db.audit)

		if (!databaseErrorLogger)
			databaseErrorLogger = new DatabaseErrorLogger(db.audit, errorLog, errorAggregation)
		if (!errorHandler) errorHandler = new ErrorHandler(undefined, undefined, databaseErrorLogger)

		/**const kms = new InfisicalKmsClient({
			baseUrl: c.env.INFISICAL_URL!,
			keyId: c.env.KMS_KEY_ID!,
			accessToken: c.env.INFISICAL_ACCESS_TOKEN!,
		})*/

		//const cache = initCache(c);
		//const cache = null

		c.set('services', {
			auth,
			//cerbos,
			//fhir,
			db,
			//kms,
			//redis,
			health: healthCheckService,
			alert: databaseAlertHandler,
			audit,
			logger,
			error: errorHandler,
			//cache,
		})

		await next()
	}
}
