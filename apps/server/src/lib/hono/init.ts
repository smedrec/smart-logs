import {
	Audit,
	AuditBottleneckAnalyzer,
	AuditMonitoringDashboard,
	AuditTracer,
	ComplianceReportingService,
	ConfigurationManager,
	createDatabasePresetHandler,
	DatabaseAlertHandler,
	DatabaseErrorLogger,
	DatabaseHealthCheck,
	DataExportService,
	DEFAULT_DASHBOARD_CONFIG,
	DEFAULT_OBSERVABILITY_CONFIG,
	ErrorHandler,
	HealthCheckService,
	MonitoringService,
	RedisEnhancedMetricsCollector,
	RedisHealthCheck,
	RedisMetricsCollector,
	ScheduledReportingService,
} from '@repo/audit'
import {
	EnhancedAuditDb,
	errorAggregation,
	errorLog,
	reportExecutions,
	reportTemplates,
	scheduledReports,
} from '@repo/audit-db'
import { createAuthorizationService } from '@repo/auth'
import { ConsoleLogger } from '@repo/hono-helpers'
import { getSharedRedisConnectionWithConfig } from '@repo/redis-client'

import { getAuthDb, getAuthRedis } from '../auth.js'
import { LoggerFactory, StructuredLogger } from '../services/logging.js'
import { MetricsCollectionService } from '../services/metrics.js'

import type { MiddlewareHandler } from 'hono'
import type { AuditConfig, DatabasePresetHandler, DeliveryConfig } from '@repo/audit'
import type { Redis } from '@repo/redis-client'
import type { HonoEnv } from '../hono/context.js'

/**
 * These maps persist between worker executions and are used for caching
 */
//const rlMap = new Map();

let isolateId: string | undefined = undefined
let isolateCreatedAt: number | undefined = undefined

let connection: Redis | undefined = undefined

let auditDbInstance: EnhancedAuditDb | undefined = undefined

export { auditDbInstance }

let audit: Audit | undefined = undefined
export { audit }

// Alert and health check services
let metricsCollector: RedisMetricsCollector | undefined = undefined
let databaseAlertHandler: DatabaseAlertHandler | undefined = undefined
let monitoringService: MonitoringService | undefined = undefined
let healthCheckService: HealthCheckService | undefined = undefined

// Observability services
let tracer: AuditTracer | undefined = undefined
let enhancedMetricsCollector: RedisEnhancedMetricsCollector | undefined = undefined
let bottleneckAnalyzer: AuditBottleneckAnalyzer | undefined = undefined
let dashboard: AuditMonitoringDashboard | undefined = undefined

// Enhanced monitoring services
let metricsCollectionService: MetricsCollectionService | undefined = undefined
let structuredLogger: StructuredLogger | undefined = undefined

// Authorization service
let authorizationService: ReturnType<typeof createAuthorizationService> | undefined = undefined

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
export function init(config: AuditConfig): MiddlewareHandler<HonoEnv> {
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

		// Initialize enhanced structured logger
		/**if (!structuredLogger) {
			LoggerFactory.setDefaultConfig({
				level: config.server.monitoring.logLevel,
				enablePerformanceLogging: true,
				enableErrorTracking: true,
				enableMetrics: config.server.monitoring.enableMetrics,
				format: config.server.server.environment === 'development' ? 'pretty' : 'json',
				outputs: ['console'],
			})

			structuredLogger = LoggerFactory.createLogger({
				requestId,
				application,
				environment: config.server.server.environment,
				version,
			})
		}*/

		const logger = new ConsoleLogger({
			requestId,
			application,
			environment: config.server.environment as 'VITEST' | 'development' | 'staging' | 'production',
			version,
			defaultFields: { environment: config.server.environment },
		})

		if (!connection) connection = getSharedRedisConnectionWithConfig(config.redis)

		if (!auditDbInstance) {
			auditDbInstance = new EnhancedAuditDb(connection, config.enhancedClient)
			// Check the database connection
			const isConnected = await auditDbInstance.checkAuditDbConnection()
			if (!isConnected) {
				console.error('Failed to connect to the audit database. Exiting.')
				process.exit(1)
			}
		}

		const authDb = await getAuthDb(config)
		const authRedis = await getAuthRedis(config)
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

		if (!audit) audit = new Audit(config, db.audit, connection)

		if (!databaseAlertHandler) databaseAlertHandler = new DatabaseAlertHandler(db.audit)
		if (!monitoringService) {
			if (!metricsCollector) metricsCollector = new RedisMetricsCollector(connection)
			monitoringService = new MonitoringService(undefined, metricsCollector)
			monitoringService.addAlertHandler(databaseAlertHandler)
		}

		// Initialize enhanced monitoring services
		if (!metricsCollectionService) {
			metricsCollectionService = new MetricsCollectionService(connection, logger, monitoringService)
		}

		// Initialize authorization service
		if (!authorizationService) {
			authorizationService = createAuthorizationService(db.auth, authRedis)
		}

		const monitor = {
			alert: databaseAlertHandler,
			metrics: monitoringService,
			// Enhanced monitoring services
			metricsCollection: metricsCollectionService,
		}

		if (!tracer) {
			tracer = new AuditTracer(DEFAULT_OBSERVABILITY_CONFIG.tracing)
		}
		if (!enhancedMetricsCollector) {
			enhancedMetricsCollector = new RedisEnhancedMetricsCollector(
				monitoringService,
				DEFAULT_OBSERVABILITY_CONFIG.metrics,
				connection
			)
		}
		if (!bottleneckAnalyzer) {
			bottleneckAnalyzer = new AuditBottleneckAnalyzer()
		}
		if (!dashboard) {
			dashboard = new AuditMonitoringDashboard(
				monitoringService,
				enhancedMetricsCollector,
				bottleneckAnalyzer,
				DEFAULT_DASHBOARD_CONFIG
			)
		}

		const observability = {
			tracer,
			metrics: enhancedMetricsCollector,
			bottleneck: bottleneckAnalyzer,
			dashboard,
		}

		if (!databaseErrorLogger)
			databaseErrorLogger = new DatabaseErrorLogger(db.audit, errorLog, errorAggregation)
		if (!errorHandler) errorHandler = new ErrorHandler(undefined, undefined, databaseErrorLogger)

		if (!reportingService)
			reportingService = new ComplianceReportingService(db.audit, {
				secretKey: config.security.encryptionKey,
			})
		if (!dataExportService) dataExportService = new DataExportService()
		if (!scheduledReportingService) {
			const deliveryConfig = createDeliveryConfig(config.server.externalServices)
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
			authorization: authorizationService,
			compliance,
			monitor,
			observability,
			audit,
			logger,
			//structuredLogger,
			error: errorHandler,
			//cache,
		})

		await next()
	}
}
