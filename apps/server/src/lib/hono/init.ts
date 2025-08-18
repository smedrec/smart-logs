import {
	Audit,
	ComplianceReportingService,
	createDatabasePresetHandler,
	DatabaseAlertHandler,
	DatabaseErrorLogger,
	DatabaseHealthCheck,
	DataExportService,
	ErrorHandler,
	HealthCheckService,
	MonitoringService,
	RedisHealthCheck,
	RedisMetricsCollector,
	ScheduledReportingService,
} from '@repo/audit'
import {
	AuditDb,
	errorAggregation,
	errorLog,
	reportExecutions,
	reportTemplates,
	scheduledReports,
} from '@repo/audit-db'
import { ConsoleLogger } from '@repo/hono-helpers'
import { getSharedRedisConnectionWithConfig } from '@repo/redis-client'

import { getAuthDb } from '../auth.js'
import { configManager } from '../config/index.js'

import type { MiddlewareHandler } from 'hono'
import type { DatabasePresetHandler, DeliveryConfig } from '@repo/audit'
import type { Redis } from '@repo/redis-client'
import type { HonoEnv } from '../hono/context.js'

/**
 * These maps persist between worker executions and are used for caching
 */
//const rlMap = new Map();

let isolateId: string | undefined = undefined
let isolateCreatedAt: number | undefined = undefined

let connection: Redis | undefined = undefined

let auditDbInstance: AuditDb | undefined = undefined

export { auditDbInstance }

let audit: Audit | undefined = undefined
export { audit }

// Alert and health check services
let metricsCollector: RedisMetricsCollector | undefined = undefined
let databaseAlertHandler: DatabaseAlertHandler | undefined = undefined
let monitoringService: MonitoringService | undefined = undefined
let healthCheckService: HealthCheckService | undefined = undefined

// Error handling services
let errorHandler: ErrorHandler | undefined = undefined
let databaseErrorLogger: DatabaseErrorLogger | undefined = undefined

// Compliance services
let reportingService: ComplianceReportingService | undefined = undefined
let dataExportService: DataExportService | undefined = undefined
let scheduledReportingService: ScheduledReportingService | undefined = undefined
let presetDatabaseHandler: DatabasePresetHandler | undefined = undefined

/**
 * Create delivery configuration from server config
 */
function createDeliveryConfig(externalServices: any): DeliveryConfig {
	return {
		email: {
			smtpConfig: {
				host: externalServices?.smtp?.host || 'localhost',
				port: externalServices?.smtp?.port || 587,
				secure: externalServices?.smtp?.secure || false,
				auth: {
					user: externalServices?.smtp?.user || '',
					pass: externalServices?.smtp?.pass || '',
				},
			},
			from: externalServices?.smtp?.from || 'audit@smedrec.com',
			subject: 'Scheduled Audit Report',
			bodyTemplate: 'Please find the attached audit report.',
			attachmentName: 'audit-report',
		},
		webhook: {
			url: externalServices?.webhook?.url || '',
			method: externalServices?.webhook?.method || 'POST',
			headers: {
				'Content-Type': 'application/json',
				...externalServices?.webhook?.headers,
			},
			timeout: externalServices?.webhook?.timeout || 30000,
			retryConfig: {
				maxRetries: externalServices?.webhook?.retryConfig?.maxRetries || 3,
				backoffMultiplier: externalServices?.webhook?.retryConfig?.backoffMultiplier || 2,
				maxBackoffDelay: externalServices?.webhook?.retryConfig?.maxBackoffDelay || 30000,
			},
		},
		storage: {
			provider: externalServices?.storage?.provider || 'local',
			config: externalServices?.storage?.config || { basePath: './reports' },
			path: externalServices?.storage?.path || '/audit-reports',
			retention: {
				days: externalServices?.storage?.retention?.days || 90,
				autoCleanup: externalServices?.storage?.retention?.autoCleanup || true,
			},
		},
	}
}

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
		const application = 'api'
		c.set('application', application)
		const version = '0.1.0'
		c.set('version', version)

		c.set('requestStartedAt', Date.now())

		c.res.headers.set('x-requestId', requestId)
		c.res.headers.set('x-application', application)
		c.res.headers.set('x-version', version)

		// Initialize configuration manager
		await configManager.initialize()
		const config = configManager.getConfig()

		const logger = new ConsoleLogger({
			requestId,
			application,
			environment: config.server.environment as 'VITEST' | 'development' | 'staging' | 'production',
			version,
			defaultFields: { environment: config.server.environment },
		})

		if (!auditDbInstance) {
			auditDbInstance = new AuditDb(config.database.url)
			// Check the database connection
			const isConnected = await auditDbInstance.checkAuditDbConnection()
			if (!isConnected) {
				console.error('Failed to connect to the audit database. Exiting.')
				process.exit(1)
			}
		}

		const authDb = await getAuthDb()
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

		if (!connection) connection = getSharedRedisConnectionWithConfig(config.redis)

		if (!audit)
			audit = new Audit(
				'audit-reliable-dev', // Default queue name - could be made configurable
				{
					secretKey: config.security.encryptionKey,
				},
				connection
			)

		if (!databaseAlertHandler) databaseAlertHandler = new DatabaseAlertHandler(db.audit)
		if (!monitoringService) {
			if (!metricsCollector) metricsCollector = new RedisMetricsCollector(connection)
			monitoringService = new MonitoringService(undefined, metricsCollector)
			monitoringService.addAlertHandler(databaseAlertHandler)
		}

		const monitor = { alert: databaseAlertHandler, metrics: monitoringService }

		if (!databaseErrorLogger)
			databaseErrorLogger = new DatabaseErrorLogger(db.audit, errorLog, errorAggregation)
		if (!errorHandler) errorHandler = new ErrorHandler(undefined, undefined, databaseErrorLogger)

		if (!reportingService)
			reportingService = new ComplianceReportingService(db.audit, {
				secretKey: config.security.encryptionKey,
			})
		if (!dataExportService) dataExportService = new DataExportService()
		if (!scheduledReportingService) {
			const deliveryConfig = createDeliveryConfig(config.externalServices)
			scheduledReportingService = new ScheduledReportingService(
				reportingService,
				dataExportService,
				db.audit,
				scheduledReports,
				reportTemplates,
				reportExecutions,
				deliveryConfig
			)
		}
		if (!presetDatabaseHandler) presetDatabaseHandler = createDatabasePresetHandler(db.audit)

		const compliance = {
			report: reportingService,
			export: dataExportService,
			scheduled: scheduledReportingService,
			preset: presetDatabaseHandler,
		}

		/**const kms = new InfisicalKmsClient({
			baseUrl: c.env.INFISICAL_URL!,
			keyId: c.env.KMS_KEY_ID!,
			accessToken: c.env.INFISICAL_ACCESS_TOKEN!,
		})*/

		//const cache = initCache(c);
		//const cache = null

		c.set('services', {
			//auth,
			//cerbos,
			//fhir,
			db,
			//kms,
			redis: connection,
			health: healthCheckService,
			compliance,
			monitor,
			audit,
			logger,
			error: errorHandler,
			//cache,
		})

		await next()
	}
}
