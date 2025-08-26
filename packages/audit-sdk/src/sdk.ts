import { Audit, ConfigurationManager, createDatabasePresetHandler } from '@repo/audit'
import { AuditDbWithConfig } from '@repo/audit-db'
import { ConsoleLogger } from '@repo/logs'
import { LogSchema } from '@repo/logs/dist/log.js'
import { getSharedRedisConnectionWithConfig } from '@repo/redis-client'

import { validateCompliance } from './compliance.js'

import type { AuditConfig, AuditLogEvent, DatabasePresetHandler, StorageType } from '@repo/audit'
import type { Fields, Logger } from '@repo/logs'
import type { AuditSDKConfig } from './types.js'

/**
 * Represents an option function for configuring an AuditSDK instance.
 * @param s - The AuditSDK instance to configure.
 */
type AuditSDKOption = (s: AuditSDK) => void

/**
 * Error thrown when the AuditSDK is not initialized before use.
 */
export class AuditSDKNotInitializedError extends Error {
	constructor(message = 'AuditSDK has not been initialized.') {
		super(message)
		this.name = 'AuditSDKNotInitializedError'
	}
}

/**
 * Error thrown when an operation with the Audit SDK fails.
 */
export class AuditSDKError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown
	) {
		super(message)
		this.name = 'AuditSDKError'
	}
}

/**
 * Main SDK class that provides a high-level interface for audit logging
 * with built-in compliance, security, and healthcare-specific features.
 */
export class AuditSDK {
	private audit: Audit | undefined
	private auditDb: AuditDbWithConfig | undefined
	private config: AuditConfig | undefined
	private presetsService: DatabasePresetHandler | undefined
	private logger: Logger | undefined

	constructor(...options: AuditSDKOption[]) {
		// Initialize all properties to undefined
		this.config = undefined
		this.logger = undefined
		this.audit = undefined
		this.auditDb = undefined
		this.presetsService = undefined
		// Apply the options
		for (const option of options) {
			option(this)
		}
	}

	/**
	 * Creates a configuration option to set logger details.
	 * @param loggerOptions - The project options to configure.
	 * @returns An AuditSDKOption function.
	 *
	 */
	public static withLogger(opts: {
		environment: LogSchema['environment']
		application: LogSchema['application']
		module: LogSchema['module']
		version?: LogSchema['version']
		requestId?: LogSchema['requestId']
		defaultFields?: Fields
	}): AuditSDKOption {
		return (s: AuditSDK): void => {
			s.logger = new ConsoleLogger(opts)
		}
	}

	public static async initialize(options: AuditSDKConfig): Promise<any> {
		// Initialize configuration manager
		const configManager = new ConfigurationManager(options.configPath, options.storageType)
		try {
			await configManager.initialize()
		} catch (error) {
			// Exit if initialization fails
			const message =
				error instanceof Error
					? error.message
					: 'Unknown error during configuration manager initialization'
			//this.logger.error('Configuration manager initialization failed:', { error: message })
			throw new AuditSDKNotInitializedError(message)
		}
		const config = configManager.getConfig()

		// Initialize Redis connection
		const connection = getSharedRedisConnectionWithConfig(config.redis)
		const auditDb = new AuditDbWithConfig(config.database)

		// Initialize core audit service
		const audit = new Audit(config, auditDb.getDrizzleInstance(), connection)

		const presetsService = createDatabasePresetHandler(auditDb.getDrizzleInstance())

		return (s: AuditSDK): void => {
			s.audit = audit
			s.auditDb = auditDb
			s.config = config
			s.presetsService = presetsService
		}
	}

	/**
	 * Log an audit event with SDK enhancements
	 */
	async log(
		eventDetails: Omit<AuditLogEvent, 'timestamp'>,
		options: {
			preset?: string
			compliance?: string[]
			skipValidation?: boolean
		} = {}
	): Promise<void> {
		const timestamp = new Date().toISOString()
		let enrichedEvent = { ...eventDetails }

		// Apply preset if specified
		if (options.preset && this.presetsService) {
			//const preset = AUDIT_PRESETS[options.preset]
			const preset = await this.presetsService.getPreset(
				options.preset,
				eventDetails.organizationId || undefined
			)
			if (preset) {
				enrichedEvent = {
					...preset.defaultValues,
					...enrichedEvent,
					action: enrichedEvent.action || preset.action,
					dataClassification: enrichedEvent.dataClassification || preset.dataClassification,
				}
			}
		}

		// Apply default values from config
		if (this.config?.compliance) {
			enrichedEvent = {
				dataClassification: this.config.compliance.defaultDataClassification,
				retentionPolicy: this.config.compliance.defaultRetentionDays,
				...enrichedEvent,
			}
		}

		// Add timestamp before compliance validation
		enrichedEvent = {
			timestamp,
			...enrichedEvent,
		}

		// Validate compliance if specified
		if (options.compliance && this.config?.compliance) {
			for (const complianceType of options.compliance) {
				validateCompliance(enrichedEvent, complianceType, this.config.compliance)
			}
		}

		// Log the event
		if (this.audit) {
			await this.audit.log(enrichedEvent, {
				generateHash: this.config?.compliance.generateHash ?? true,
				generateSignature: this.config?.compliance.generateSignature ?? false,
				skipValidation: options.skipValidation,
				validationConfig: this.config?.validation,
			})
		} else {
			this.logger?.error('Audit service not initialized')
			throw new AuditSDKError('Audit service not initialized')
		}
	}

	/**
	 * Log a healthcare-specific FHIR event
	 */
	async logFHIR(details: {
		principalId: string
		action: string
		resourceType: string
		resourceId: string
		status: 'attempt' | 'success' | 'failure'
		outcomeDescription?: string
		organizationId?: string
		sessionContext?: any
		fhirContext?: {
			version?: string
			interaction?: string
			compartment?: string
		}
	}): Promise<void> {
		await this.log(
			{
				principalId: details.principalId,
				organizationId: details.organizationId,
				action: `fhir.${details.resourceType.toLowerCase()}.${details.action}`,
				targetResourceType: details.resourceType,
				targetResourceId: details.resourceId,
				status: details.status,
				outcomeDescription: details.outcomeDescription,
				sessionContext: details.sessionContext,
				dataClassification: 'PHI',
				fhirContext: details.fhirContext,
			},
			{
				compliance: ['hipaa'],
			}
		)
	}

	/**
	 * Log an authentication event
	 */
	async logAuth(details: {
		principalId?: string
		organizationId?: string
		action: 'login' | 'logout' | 'password_change' | 'mfa_enable' | 'mfa_disable'
		status: 'attempt' | 'success' | 'failure'
		sessionContext?: any
		reason?: string
	}): Promise<void> {
		await this.log(
			{
				principalId: details.principalId,
				organizationId: details.organizationId,
				action: `auth.${details.action}.${details.status}`,
				status: details.status,
				outcomeDescription: details.reason || `User ${details.action} ${details.status}`,
				sessionContext: details.sessionContext,
				dataClassification: 'INTERNAL',
			},
			{
				preset: 'authentication',
			}
		)
	}

	/**
	 * Log a system event
	 */
	async logSystem(details: {
		action: string
		status: 'attempt' | 'success' | 'failure'
		component?: string
		outcomeDescription?: string
		systemContext?: any
	}): Promise<void> {
		await this.log(
			{
				principalId: `system-${details.component || 'unknown'}`,
				action: `system.${details.action}`,
				status: details.status,
				outcomeDescription: details.outcomeDescription,
				dataClassification: 'INTERNAL',
				systemContext: details.systemContext,
			},
			{
				preset: 'system',
			}
		)
	}

	/**
	 * Log a data operation event
	 */
	async logData(details: {
		principalId: string
		organizationId?: string
		action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import'
		resourceType: string
		resourceId: string
		status: 'attempt' | 'success' | 'failure'
		dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
		changes?: any
		outcomeDescription?: string
	}): Promise<void> {
		await this.log({
			principalId: details.principalId,
			organizationId: details.organizationId,
			action: `data.${details.action}`,
			targetResourceType: details.resourceType,
			targetResourceId: details.resourceId,
			status: details.status,
			outcomeDescription: details.outcomeDescription,
			dataClassification: details.dataClassification || 'INTERNAL',
			changes: details.changes,
		})
	}

	/**
	 * Log with guaranteed delivery for critical events
	 */
	async logCritical(
		eventDetails: Omit<AuditLogEvent, 'timestamp'>,
		options: {
			priority?: number
			preset?: string
			compliance?: string[]
		} = {}
	): Promise<void> {
		const timestamp = new Date().toISOString()
		let enrichedEvent = { ...eventDetails }

		// Apply preset if specified
		if (options.preset && this.presetsService) {
			const preset = await this.presetsService.getPreset(
				options.preset,
				eventDetails.organizationId || undefined
			)
			if (preset) {
				enrichedEvent = {
					...preset.defaultValues,
					...enrichedEvent,
					action: enrichedEvent.action || preset.action,
					dataClassification: enrichedEvent.dataClassification || preset.dataClassification,
				}
			}
		}

		// Add timestamp before compliance validation
		enrichedEvent = {
			timestamp,
			...enrichedEvent,
		}

		// Validate compliance if specified
		if (options.compliance && this.config?.compliance) {
			for (const complianceType of options.compliance) {
				validateCompliance(enrichedEvent, complianceType, this.config.compliance)
			}
		}

		if (this.audit) {
			await this.audit.log(enrichedEvent, {
				priority: options.priority || 1,
				durabilityGuarantees: true,
				generateHash: true,
				generateSignature: true,
			})
		} else {
			this.logger?.error('Audit service not initialized')
			throw new AuditSDKError('Audit service not initialized')
		}
	}

	/**
	 * Query audit logs from the database
	 */
	async query(
		filters: {
			principalId?: string
			action?: string
			resourceType?: string
			resourceId?: string
			status?: string
			startDate?: Date
			endDate?: Date
			limit?: number
			offset?: number
		} = {}
	) {
		if (!this.auditDb) {
			this.logger?.error('Database not configured. Provide databaseUrl in config.')
			throw new AuditSDKError('Database not configured. Provide databaseUrl in config.')
		}

		const db = this.auditDb.getDrizzleInstance()
		// TODO Implementation would use Drizzle ORM to query with filters
		// This is a placeholder for the actual query implementation
		throw new AuditSDKError('Query implementation pending')
	}

	/**
	 * Generate compliance report
	 */
	async generateComplianceReport(
		type: 'hipaa' | 'gdpr' | 'custom',
		options: {
			startDate: Date
			endDate: Date
			format?: 'json' | 'csv' | 'pdf'
		}
	) {
		if (!this.auditDb) {
			this.logger?.error('Database not configured for reporting')
			throw new AuditSDKError('Database not configured for reporting')
		}

		// TODO Implementation would generate compliance-specific reports
		throw new AuditSDKError('Compliance reporting implementation pending')
	}

	/**
	 * Verify audit log integrity
	 */
	async verifyIntegrity(
		options: {
			startDate?: Date
			endDate?: Date
			limit?: number
		} = {}
	) {
		if (!this.auditDb) {
			this.logger?.error('Database not configured for integrity verification')
			throw new AuditSDKError('Database not configured for integrity verification')
		}

		// TODO Implementation would verify hashes and signatures
		throw new AuditSDKError('Integrity verification implementation pending')
	}

	/**
	 * Get audit service health status
	 */
	async getHealth() {
		const redisStatus = this.audit ? 'connected' : 'disconnected'
		let dbStatus = 'not_configured'

		if (this.auditDb) {
			try {
				const isConnected = await this.auditDb.checkAuditDbConnection()
				dbStatus = isConnected ? 'connected' : 'disconnected'
			} catch (error) {
				dbStatus = 'error'
			}
		}

		return {
			redis: redisStatus,
			database: dbStatus,
			timestamp: new Date().toISOString(),
		}
	}

	/**
	 * Close all connections
	 */
	async close(): Promise<void> {
		if (this.audit) {
			await this.audit.closeConnection()
			this.logger?.info('Audit service closed')
		}
	}
}
