import type { betterAuth } from 'better-auth'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Inngest } from 'inngest'
import type {
	Audit,
	AuditBottleneckAnalyzer,
	AuditMonitoringDashboard,
	AuditTracer,
	ComplianceReportingService,
	ConfigurationManager,
	DatabaseAlertHandler,
	DatabasePresetHandler,
	DataExportService,
	ErrorHandler,
	GDPRComplianceService,
	HealthCheckService,
	MonitoringService,
	RedisEnhancedMetricsCollector,
	ScheduledReportingService,
} from '@repo/audit'
import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'
import type * as auditSchema from '@repo/audit-db/dist/db/schema.js'
import type { AuthorizationService, Session } from '@repo/auth'
import type * as authSchema from '@repo/auth/dist/db/schema/index.js'
import type { HonoApp, SharedHonoEnv, SharedHonoVariables } from '@repo/hono-helpers'
import type { InfisicalKmsClient } from '@repo/infisical-kms'
import type { StructuredLogger } from '@repo/logs'
import type { Redis } from '@repo/redis-client'
import type { HealthStatus } from '../graphql/types.js'
import type { PerformanceService } from '../services/performance.js'
import type { ResilienceService } from '../services/resilience.js'

export type Env = SharedHonoEnv & {
	// add additional Bindings here
	ALLOWED_ORIGINS: string
}

export type ServiceContext = {
	config: ConfigurationManager
	auth: ReturnType<typeof betterAuth>
	inngest: Inngest
	//cerbos: typeof cerbos
	//fhir: typeof fhir
	//cache: Cache;
	//db: { primary: Database; readonly: Database };
	db: {
		auth: PostgresJsDatabase<typeof authSchema>
		audit: PostgresJsDatabase<typeof auditSchema>
	}
	client: EnhancedAuditDatabaseClient
	kms: InfisicalKmsClient
	redis: Redis
	health: HealthCheckService
	authorization: AuthorizationService
	compliance: {
		report: ComplianceReportingService
		export: DataExportService
		scheduled: ScheduledReportingService
		preset: DatabasePresetHandler
		gdpr: GDPRComplianceService
	}
	monitor: {
		alert: DatabaseAlertHandler
		metrics: MonitoringService
	}
	observability: {
		tracer: AuditTracer
		metrics: RedisEnhancedMetricsCollector
		bottleneck: AuditBottleneckAnalyzer
		dashboard: AuditMonitoringDashboard
	}
	audit: Audit
	logger: StructuredLogger
	resilience: ResilienceService
	error: ErrorHandler
	performance: PerformanceService
}

/** Variables can be extended */
export type Variables = SharedHonoVariables & {
	session: Session | null
	isApiKeyAuth: boolean
	services: ServiceContext
	apiVersion?: {
		requested: string
		resolved: string
		isDeprecated: boolean
		isSupported: boolean
	}
	healthStatus: HealthStatus
	isShuttingDown?: boolean
	requestStartTime: number
	requestMetadata: any
	performance: any
}

export interface HonoEnv extends HonoApp {
	Bindings: Env
	Variables: Variables
}
