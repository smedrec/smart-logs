import type { betterAuth } from 'better-auth'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type {
	Audit,
	ComplianceReportingService,
	DatabaseAlertHandler,
	DataExportService,
	ErrorHandler,
	HealthCheckService,
	ScheduledReportingService,
} from '@repo/audit'
import type * as auditSchema from '@repo/audit-db/dist/db/schema.js'
import type { Session } from '@repo/auth'
import type * as authSchema from '@repo/auth/dist/db/schema/index.js'
//import type { fhir } from '@repo/fhir'
import type { HonoApp } from '@repo/hono-helpers'
import type { SharedHonoEnv, SharedHonoVariables } from '@repo/hono-helpers/src/types.js'
//import type { InfisicalKmsClient } from '@repo/infisical-kms'
//import type { cerbos } from '../cerbos/index.js'
import type { Logger } from '../logs/index.js'

export type Env = SharedHonoEnv & {
	// add additional Bindings here
	ALLOWED_ORIGINS: string
}

export type ServiceContext = {
	auth: ReturnType<typeof betterAuth>
	//cerbos: typeof cerbos
	//fhir: typeof fhir
	//cache: Cache;
	//db: { primary: Database; readonly: Database };
	db: {
		auth: PostgresJsDatabase<typeof authSchema>
		audit: PostgresJsDatabase<typeof auditSchema>
	}
	//kms: InfisicalKmsClient
	//redis:  Redis,
	health: HealthCheckService
	compliance: {
		report: ComplianceReportingService
		export: DataExportService
		scheduled: ScheduledReportingService
	}
	alert: DatabaseAlertHandler
	audit: Audit
	logger: Logger
	error: ErrorHandler
}

/** Variables can be extended */
export type Variables = SharedHonoVariables & {
	isolateId: string
	isolateCreatedAt: number
	requestId: string
	requestStartedAt: number
	session: Session | null
	services: ServiceContext
	/**
	 * IP address or region information
	 */
	location: string
	userAgent?: string
}

export interface HonoEnv extends HonoApp {
	Bindings: Env
	Variables: Variables
}
