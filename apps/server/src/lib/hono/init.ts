import {
	Audit,
	ComplianceReportingService,
	ConfigurationManager,
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
import { auth } from '@repo/auth'
import { db as authDb } from '@repo/auth/dist/db/index.js'
import { ConsoleLogger } from '@repo/hono-helpers'
import { getSharedRedisConnectionWithConfig } from '@repo/redis-client'

import type { MiddlewareHandler } from 'hono'
import type { DatabasePresetHandler, DeliveryConfig } from '@repo/audit'
import type { Redis } from '@repo/redis-client'
//import {initCache} from "../cache";
import type { HonoEnv } from '../hono/context.js'

//import { InfisicalKmsClient } from '@repo/infisical-kms';

/**
 * These maps persist between worker executions and are used for caching
 */
//const rlMap = new Map();

let isolateId: string | undefined = undefined
let isolateCreatedAt: number | undefined = undefined

let configurationManager: ConfigurationManager | undefined = undefined

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

// Placeholder delivery config - in real implementation would come from environment
const deliveryConfig: DeliveryConfig = {
	email: {
		smtpConfig: {
			host: process.env.SMTP_HOST || 'localhost',
			port: parseInt(process.env.SMTP_PORT || '587'),
			secure: process.env.SMTP_SECURE === 'true',
			auth: {
				user: process.env.SMTP_USER || '',
				pass: process.env.SMTP_PASS || '',
			},
		},
		from: process.env.SMTP_FROM || 'audit@smedrec.com',
		subject: 'Scheduled Audit Report',
		bodyTemplate: 'Please find the attached audit report.',
		attachmentName: 'audit-report',
	},
	webhook: {
		url: process.env.WEBHOOK_URL || '',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${process.env.WEBHOOK_TOKEN || ''}`,
		},
		timeout: 30000,
		retryConfig: {
			maxRetries: 3,
			backoffMultiplier: 2,
			maxBackoffDelay: 30000,
		},
	},
	storage: {
		provider: 'local',
		config: {
			basePath: process.env.STORAGE_PATH || './reports',
		},
		path: '/audit-reports',
		retention: {
			days: 90,
			autoCleanup: true,
		},
	},
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

		const logger = new ConsoleLogger({
			requestId,
			application,
			environment: c.env.ENVIRONMENT as 'VITEST' | 'development' | 'staging' | 'production',
			version,
			defaultFields: { environment: c.env.ENVIRONMENT },
		})

		if (!configurationManager) {
			configurationManager = new ConfigurationManager('default/audit-development.json', 's3')
			await configurationManager.initialize()
		}

		const config = configurationManager.getConfig()

		if (!auditDbInstance) {
			auditDbInstance = new AuditDb(config.database.url)
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

		if (!connection) connection = getSharedRedisConnectionWithConfig(config.redis)

		if (!audit)
			audit = new Audit(
				config.reliableProcessor.queueName,
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
		if (!scheduledReportingService)
			scheduledReportingService = new ScheduledReportingService(
				db.audit,
				scheduledReports,
				reportTemplates,
				reportExecutions,
				deliveryConfig
			)
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
			auth,
			//cerbos,
			//fhir,
			db,
			//kms,
			//redis,
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
