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
import { Auth, createAuthorizationService, getActiveOrganization } from '@repo/auth'
import { getSharedRedisConnectionWithConfig } from '@repo/redis-client'

import { LoggerFactory, StructuredLogger } from '../services/logging.js'
import { MetricsCollectionService } from '../services/metrics.js'

import type { MiddlewareHandler } from 'hono'
import type { AuditConfig, DatabasePresetHandler, DeliveryConfig } from '@repo/audit'
import type { Session } from '@repo/auth'
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

let authInstance: Auth | undefined = undefined
let audit: Audit | undefined = undefined

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

// Resilience services
let resilienceService: import('../services/resilience').ResilienceService | undefined = undefined

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
		if (!structuredLogger) {
			LoggerFactory.setDefaultConfig({
				level: config.server.monitoring.logLevel,
				enablePerformanceLogging: true,
				enableErrorTracking: true,
				enableMetrics: config.server.monitoring.enableMetrics,
				format: config.server.environment === 'development' ? 'pretty' : 'json',
				outputs: ['console'],
			})

			structuredLogger = LoggerFactory.createLogger({
				requestId,
				service: application,
			})
		}

		/**const logger = new ConsoleLogger({
			requestId,
			application,
			environment: config.server.environment as 'VITEST' | 'development' | 'staging' | 'production',
			version,
			defaultFields: { environment: config.server.environment },
		})*/

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

		const client = auditDbInstance.getEnhancedClientInstance()

		if (!healthCheckService) {
			healthCheckService = new HealthCheckService()
			// Register health checks
			healthCheckService.registerHealthCheck(
				new DatabaseHealthCheck(() => auditDbInstance!.checkAuditDbConnection())
			)
			//healthCheckService.registerHealthCheck(new RedisHealthCheck(() => getRedisConnectionStatus()))
		}

		if (!audit) audit = new Audit(config, auditDbInstance.getDrizzleInstance(), connection)

		if (!authInstance) authInstance = new Auth(config, audit)

		const auth = authInstance.getAuthInstance()
		// Get the Drizzle ORM instance
		const db = {
			auth: authInstance.getDbInstance(),
			audit: auditDbInstance.getDrizzleInstance(),
		}

		if (!databaseAlertHandler) databaseAlertHandler = new DatabaseAlertHandler(db.audit)
		if (!monitoringService) {
			if (!metricsCollector) metricsCollector = new RedisMetricsCollector(connection)
			monitoringService = new MonitoringService(undefined, metricsCollector)
			monitoringService.addAlertHandler(databaseAlertHandler)
		}

		// Initialize enhanced monitoring services
		if (!metricsCollectionService) {
			metricsCollectionService = new MetricsCollectionService(
				connection,
				structuredLogger,
				monitoringService
			)
		}

		// Initialize resilience service
		if (!resilienceService) {
			const { createResilienceService } = await import('../services/resilience.js')
			resilienceService = createResilienceService(structuredLogger)
		}

		// Initialize authorization service
		if (!authorizationService) {
			authorizationService = createAuthorizationService(db.auth, authInstance.getRedisInstance())
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
		if (!gdprComplianceService) gdprComplianceService = new GDPRComplianceService(client)

		const compliance = {
			report: reportingService,
			export: dataExportService,
			scheduled: scheduledReportingService,
			preset: presetDatabaseHandler,
			gdpr: gdprComplianceService,
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
			client,
			//kms,
			redis: connection,
			health: healthCheckService,
			authorization: authorizationService,
			compliance,
			monitor,
			observability,
			audit,
			logger: structuredLogger,
			resilience: resilienceService,
			//structuredLogger,
			error: errorHandler,
			//cache,
		})

		const apiKey =
			c.req.header('x-api-key') || c.req.header('authorization')?.replace('Bearer ', '')

		// Try API key authentication first
		if (apiKey) {
			c.set('isApiKeyAuth', true)
			try {
				// Validate API key using Better Auth's API key plugin
				let apiKeySession = (await auth.api.getSession({
					headers: new Headers({
						'x-api-key': apiKey,
					}),
				})) as Session

				if (apiKeySession) {
					if (!apiKeySession.session.ipAddress || apiKeySession.session.ipAddress === '') {
						apiKeySession.session.ipAddress = c.get('location')
					}

					if (!apiKeySession.session.userAgent || apiKeySession.session.userAgent === '') {
						apiKeySession.session.userAgent = c.get('userAgent')
					}

					const org = await getActiveOrganization(apiKeySession.session.userId, db.auth)
					if (org) {
						apiKeySession = {
							session: {
								...apiKeySession.session,
								activeOrganizationId: org.organizationId,
								activeOrganizationRole: org.role,
							},
							user: {
								...apiKeySession.user,
							},
						}
					}
					c.set('session', apiKeySession as Session)
					return next()
				}
			} catch (error) {
				// API key validation failed, continue with session auth
				console.warn('API key validation failed:', error)
				c.set('session', null)
				return next()
			}
		}

		// Try session authentication
		c.set('isApiKeyAuth', false)
		const session = await auth.api.getSession({
			query: {
				disableCookieCache: true,
			},
			headers: c.req.raw.headers,
		})

		if (!session) {
			c.set('session', null)
			return next()
		}

		if (!session.session.ipAddress || session.session.ipAddress.length < 1) {
			session.session.ipAddress = c.get('location')
		}

		if (!session.session.userAgent || session.session.userAgent.length < 1) {
			session.session.userAgent = c.get('userAgent')
		}

		c.set('session', session as Session)

		return next()
	}
}
