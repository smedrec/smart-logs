import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type {
	Audit,
	AuditBottleneckAnalyzer,
	AuditMonitoringDashboard,
	AuditTracer,
	ComplianceReportingService,
	DatabaseAlertHandler,
	DatabasePresetHandler,
	DataExportService,
	ErrorHandler,
	HealthCheckService,
	MonitoringService,
	RedisEnhancedMetricsCollector,
	ScheduledReportingService,
} from '@repo/audit'
import type * as auditSchema from '@repo/audit-db/dist/db/schema.js'
import type { Session } from '@repo/auth'
import type * as authSchema from '@repo/auth/dist/db/schema/index.js'
//import type { fhir } from '@repo/fhir'

//import type { InfisicalKmsClient } from '@repo/infisical-kms'
//import type { cerbos } from '../cerbos/index.js'
import type { HonoApp, Logger } from '@repo/hono-helpers'
import type { SharedHonoEnv, SharedHonoVariables } from '@repo/hono-helpers/src/types.js'
import type { Redis } from '@repo/redis-client'
import type { AlertingService } from '../services/alerting.js'
import type { AuthorizationService } from '../services/authorization.js'
import type { StructuredLogger } from '../services/logging.js'
import type { MetricsCollectionService } from '../services/metrics.js'

export type Env = SharedHonoEnv & {
	// add additional Bindings here
	ALLOWED_ORIGINS: string
}

export type ServiceContext = {
	//auth: ReturnType<typeof betterAuth>
	//cerbos: typeof cerbos
	//fhir: typeof fhir
	//cache: Cache;
	//db: { primary: Database; readonly: Database };
	db: {
		auth: PostgresJsDatabase<typeof authSchema>
		audit: PostgresJsDatabase<typeof auditSchema>
	}
	//kms: InfisicalKmsClient
	redis: Redis
	health: HealthCheckService
	authorization: AuthorizationService
	compliance: {
		report: ComplianceReportingService
		export: DataExportService
		scheduled: ScheduledReportingService
		preset: DatabasePresetHandler
	}
	monitor: {
		alert: DatabaseAlertHandler
		metrics: MonitoringService
		metricsCollection: MetricsCollectionService
	}
	observability: {
		tracer: AuditTracer
		metrics: RedisEnhancedMetricsCollector
		bottleneck: AuditBottleneckAnalyzer
		dashboard: AuditMonitoringDashboard
	}
	audit: Audit
	logger: Logger
	//structuredLogger: StructuredLogger
	error: ErrorHandler
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
}

export interface HonoEnv extends HonoApp {
	Bindings: Env
	Variables: Variables
}
