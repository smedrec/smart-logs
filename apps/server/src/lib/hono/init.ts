import { Inngest } from 'inngest'

import {
	AlertingService,
	Audit,
	AuditBottleneckAnalyzer,
	AuditMonitoringDashboard,
	AuditTracer,
	ComplianceReportingService,
	createDatabasePresetHandler,
	DatabaseAlertHandler,
	DatabaseErrorLogger,
	DatabaseHealthCheck,
	DataExportService,
	DEFAULT_DASHBOARD_CONFIG,
	DEFAULT_OBSERVABILITY_CONFIG,
	ErrorHandler,
	GDPRComplianceService,
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
import { Auth, createAuthorizationService } from '@repo/auth'
import { InfisicalKmsClient } from '@repo/infisical-kms'
import { StructuredLogger } from '@repo/logs'
import { getRedisConnectionStatus, getSharedRedisConnectionWithConfig } from '@repo/redis-client'

import { bindingsMiddleware } from '../inngest/middleware.js'
import { schemas } from '../inngest/types.js'
import { PerformanceService } from '../services/performance.js'
import { createResilienceService } from '../services/resilience.js'

import type { MiddlewareHandler } from 'hono'
import type {
	AuditConfig,
	ConfigurationManager,
	DatabasePresetHandler,
	DeliveryConfig,
} from '@repo/audit'
import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'
import type { Redis } from '@repo/redis-client'
import type { HonoEnv } from '../hono/context.js'
import type { ResilienceService } from '../services/resilience.js'

/**
 * These maps persist between worker executions and are used for caching
 */
//const rlMap = new Map();

let isolateId: string | undefined = undefined
let isolateCreatedAt: number | undefined = undefined

let connection: Redis | undefined = undefined

let auditDbInstance: EnhancedAuditDb | undefined = undefined

let authInstance: Auth | undefined = undefined
let inngest: Inngest | undefined = undefined
let kms: InfisicalKmsClient | undefined = undefined
let audit: Audit | undefined = undefined

// Alert and health check services
let metricsCollector: RedisMetricsCollector | undefined = undefined
let databaseAlertHandler: DatabaseAlertHandler | undefined = undefined
let monitoringService: MonitoringService | undefined = undefined
let alertingService: AlertingService | undefined = undefined
let healthCheckService: HealthCheckService | undefined = undefined

// Observability services
let tracer: AuditTracer | undefined = undefined
let enhancedMetricsCollector: RedisEnhancedMetricsCollector | undefined = undefined
let bottleneckAnalyzer: AuditBottleneckAnalyzer | undefined = undefined
let dashboard: AuditMonitoringDashboard | undefined = undefined

// Enhanced logger service
let structuredLogger: StructuredLogger | undefined = undefined

// Resilience services
let resilienceService: ResilienceService | undefined = undefined

// Performance service
let performanceService: PerformanceService | undefined = undefined

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
let gdprComplianceService: GDPRComplianceService | undefined = undefined

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
export function init(configManager: ConfigurationManager): MiddlewareHandler<HonoEnv> {
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

		const config = configManager.getConfig()

		// Initialize enhanced structured logger
		if (!structuredLogger) {
			/**LoggerFactory.setDefaultConfig({
				level: config.server.monitoring.logLevel,
				enablePerformanceLogging: true,
				enableErrorTracking: true,
				enableMetrics: config.server.monitoring.enableMetrics,
				format: config.server.environment === 'development' ? 'pretty' : 'json',
				outputs: ['console', 'otpl'],
				otplConfig: {
					endpoint: config.logging.exporterEndpoint || '',
					headers: config.logging.exporterHeaders || {},
				},
			})

			structuredLogger = LoggerFactory.createLogger({
				requestId,
				service: application,
			})*/
			structuredLogger = new StructuredLogger({
				service: 'api',
				environment: 'development',
				console: {
					name: 'console',
					enabled: true,
					format: 'pretty',
					colorize: true,
					level: 'info',
				},
				otlp: {
					name: 'otpl',
					enabled: true,
					level: 'info',
					endpoint: config.logging.exporterEndpoint || '',
					headers: config.logging.exporterHeaders || {},
				},
			})
		}

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

		const client: EnhancedAuditDatabaseClient = auditDbInstance.getEnhancedClientInstance()

		if (!inngest)
			inngest = new Inngest({
				id: config.server.inngest.id,
				eventKey: config.server.inngest.eventKey,
				signingKey: config.server.inngest.signingKey,
				baseUrl: config.server.inngest.baseUrl,
				schemas,
				middleware: [bindingsMiddleware],
			})

		if (!healthCheckService) {
			healthCheckService = new HealthCheckService()
			// Register health checks
			healthCheckService.registerHealthCheck(
				new DatabaseHealthCheck(() => auditDbInstance!.checkAuditDbConnection())
			)
			healthCheckService.registerHealthCheck(new RedisHealthCheck(() => getRedisConnectionStatus()))
		}

		if (!presetDatabaseHandler) presetDatabaseHandler = createDatabasePresetHandler(auditDbInstance)

		if (!audit) audit = new Audit(config, presetDatabaseHandler, connection)

		if (!authInstance) authInstance = new Auth(config, inngest, audit)

		const auth = authInstance.getAuthInstance()
		// Get the Drizzle ORM instances
		const db = {
			auth: authInstance.getDrizzleInstance(),
			audit: auditDbInstance.getDrizzleInstance(),
		}

		if (!kms)
			kms = new InfisicalKmsClient({
				baseUrl: config.security.kms.baseUrl,
				encryptionKey: config.security.kms.encryptionKey,
				signingKey: config.security.kms.signingKey,
				accessToken: config.security.kms.accessToken,
			})

		if (!databaseAlertHandler) databaseAlertHandler = new DatabaseAlertHandler(auditDbInstance)
		if (!monitoringService) {
			if (!metricsCollector) metricsCollector = new RedisMetricsCollector(connection)
			monitoringService = new MonitoringService(config.monitoring, metricsCollector)
		}
		if (!alertingService) {
			alertingService = new AlertingService(config.monitoring, metricsCollector)
			// Set alerting service config for database alert handler
			alertingService.addAlertHandler(databaseAlertHandler)
		}
		// Initialize resilience service
		if (!resilienceService) {
			resilienceService = createResilienceService(structuredLogger)
		}

		// Initialize authorization service
		if (!authorizationService) {
			authorizationService = createAuthorizationService(db.auth, authInstance.getRedisInstance())
		}

		// Initialize performance service
		if (!performanceService) {
			const basePerformanceConfig = config.server.performance
			const performanceConfig = {
				...basePerformanceConfig,
				// Override with config values if available
				responseCache: {
					...basePerformanceConfig.responseCache,
					enabled: config.server.monitoring.enableMetrics,
				},
				monitoring: {
					...basePerformanceConfig.monitoring,
					enableMetrics: config.server.monitoring.enableMetrics,
				},
			}
			performanceService = new PerformanceService(
				connection,
				client,
				structuredLogger,
				performanceConfig
			)
		}

		const monitor = {
			alerts: alertingService,
			metrics: monitoringService,
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

		if (!reportingService) reportingService = new ComplianceReportingService(client, audit)
		if (!dataExportService) dataExportService = new DataExportService()
		if (!scheduledReportingService) {
			const deliveryConfig = createDeliveryConfig(config.server.externalServices)
			scheduledReportingService = new ScheduledReportingService(
				reportingService,
				dataExportService,
				client,
				inngest,
				deliveryConfig
			)
		}

		if (!gdprComplianceService)
			gdprComplianceService = new GDPRComplianceService(client, audit, kms)

		const compliance = {
			report: reportingService,
			export: dataExportService,
			scheduled: scheduledReportingService,
			preset: presetDatabaseHandler,
			gdpr: gdprComplianceService,
		}

		//const cache = initCache(c);
		//const cache = null

		// System startup
		audit.logSystem({
			action: 'startup',
			status: 'success',
			component: 'api-server',
			outcomeDescription: 'API server started successfully',
			systemContext: {
				version: '0.1.0',
				environment: configManager.getEnvironment(),
				nodeVersion: process.version,
			},
		})

		c.set('services', {
			config: configManager,
			auth,
			inngest,
			//cerbos,
			//fhir,
			db,
			client,
			kms,
			redis: connection,
			health: healthCheckService,
			authorization: authorizationService,
			compliance,
			monitor,
			observability,
			audit,
			logger: structuredLogger,
			resilience: resilienceService,
			error: errorHandler,
			performance: performanceService,
			//cache,
		})

		await next()
	}
}
