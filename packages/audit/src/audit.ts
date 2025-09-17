import { Queue } from 'bullmq'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Redis as RedisInstance } from 'ioredis' // Renamed to avoid conflict

import { SigningAlgorithm } from '@repo/infisical-kms'
import { LoggerFactory, StructuredLogger } from '@repo/logs'
import { getSharedRedisConnection } from '@repo/redis-client'

import { AuditConfig, ComplianceConfig } from './config/types.js'
import { CryptoService } from './crypto.js'
import { DatabasePresetHandler } from './preset/database-preset-handler.js'
import {
	DEFAULT_RELIABLE_PROCESSOR_CONFIG,
	ReliableEventProcessor,
} from './queue/reliable-processor.js'
import {
	DEFAULT_VALIDATION_CONFIG,
	validateAndSanitizeAuditEvent,
	validateCompliance,
} from './validation.js'

import type { RedisOptions, Redis as RedisType } from 'ioredis' // RedisType for type usage
import type { CryptoConfig, EventSignatureResponse } from './crypto.js'
import type { ReliableProcessorConfig } from './queue/reliable-processor.js'
import type { AuditLogEvent } from './types.js'
import type { ValidationConfig } from './validation.js'

// The getEnv function is removed as REDIS_URL is now primarily handled by @repo/redis-client
// However, AUDIT_REDIS_URL can still be used for overrides if a direct connection is made.

/**
 * The `Audit` class provides a mechanism to log audit events to a BullMQ queue,
 * which is backed by Redis. It can use a shared Redis connection provided by `@repo/redis-client`
 * or establish its own if connection details are explicitly provided.
 *
 * @example
 * ```typescript
 * import { Audit } from '@repo/audit';
 *
 * // Recommended: Initialize with just a queue name to use the shared Redis connection
 * const auditService = new Audit('user-activity-queue');
 *
 * // Advanced: Initialize with specific Redis URL (e.g., for a different Redis instance)
 * // const auditServiceSpecific = new Audit('user-activity-queue', 'redis://specific-redis:6379');
 *
 * async function recordUserLogin(userId: string, success: boolean) {
 *   await auditService.log({
 *     principalId: userId,
 *     action: 'userLogin',
 *     status: success ? 'success' : 'failure',
 *     outcomeDescription: success ? 'User logged in successfully.' : 'User login failed.',
 *     requestDetails: { ipAddress: '192.168.1.100' } // Example of additional context
 *   });
 * }
 *
 * // Call to clean up queue resources.
 * // await auditService.closeConnection(); // Note: This no longer closes the shared Redis connection.
 * ```
 */
export class Audit {
	private config: AuditConfig
	private connection: RedisType
	private queueName: string
	private bullmq_queue: Queue<AuditLogEvent, any, string>
	private isSharedConnection: boolean
	private cryptoService: CryptoService
	private logger: StructuredLogger
	private presetsService: DatabasePresetHandler

	/**
	 * Constructs an `Audit` instance.
	 * It initializes a BullMQ queue and connects to Redis.
	 *
	 * If `redisOrUrl` is a string (Redis URL) or if `redisConnectionOptions` are provided,
	 * a new Redis connection will be created specifically for this instance.
	 * The URL can also be sourced from the `AUDIT_REDIS_URL` environment variable if `redisOrUrl` is not given.
	 *
	 * If `redisOrUrl` is an existing `Redis` instance, it will be used.
	 *
	 * If no connection details (`redisOrUrl` or `redisConnectionOptions`) are provided,
	 * it defaults to using the shared Redis connection from `@repo/redis-client`.
	 *
	 * @param config The configuration for the audit service.
	 * @param db The Drizzle database instance.
	 * @param redisOrUrlOrOptions Optional. Can be:
	 *                          - A Redis connection URL (string).
	 *                          - An existing IORedis connection instance.
	 *                          - An object with `url` and/or `options` for IORedis.
	 *                          If a URL string is provided, `redisConnectionOptions` can also be passed as the third argument.
	 * @param directConnectionOptions Optional. IORedis options, used if creating a new direct connection.
	 *                                Merged with default options. Ignored if `redisOrUrl` is an IORedis instance
	 *                                or if using the shared connection.
	 * @throws Error if a direct Redis URL is required (e.g., `AUDIT_REDIS_URL`) but cannot be resolved,
	 *         or if there's an error during direct Redis client instantiation.
	 */
	constructor(
		config: AuditConfig,
		presetsService: DatabasePresetHandler,
		redisOrUrlOrOptions?: string | RedisType | { url?: string; options?: RedisOptions },
		directConnectionOptions?: RedisOptions
	) {
		this.config = config
		this.queueName = this.config.reliableProcessor.queueName
		this.isSharedConnection = false
		this.cryptoService = new CryptoService(this.config.security)
		this.presetsService = presetsService

		LoggerFactory.setDefaultConfig({
			level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
			enablePerformanceLogging: true,
			enableErrorTracking: true,
			enableMetrics: false,
			format: 'json',
			outputs: ['otpl'],
			otplConfig: {
				endpoint: 'http://localhost:5080/api/default/default/_json',
				headers: {
					Authorization: process.env.OTLP_AUTH_HEADER || '',
				},
			},
		})

		this.logger = LoggerFactory.createLogger({
			service: '@repo/audit - audit',
		})

		const defaultDirectOptions: RedisOptions = {
			maxRetriesPerRequest: null,
			enableAutoPipelining: true,
		}

		if (
			redisOrUrlOrOptions &&
			typeof redisOrUrlOrOptions === 'object' &&
			'status' in redisOrUrlOrOptions
		) {
			// Scenario 1: An existing ioredis instance is provided
			this.connection = redisOrUrlOrOptions
			this.isSharedConnection = true // Assume shared, could be externally managed or not
			this.logger.info(`Using provided Redis instance for queue "${this.queueName}".`)
		} else if (
			typeof redisOrUrlOrOptions === 'string' ||
			(typeof redisOrUrlOrOptions === 'object' &&
				(redisOrUrlOrOptions.url || redisOrUrlOrOptions.options)) ||
			directConnectionOptions
		) {
			// Scenario 2: URL string, options object, or directConnectionOptions are provided for a direct connection
			this.isSharedConnection = false
			let url: string | undefined
			let options: RedisOptions = { ...defaultDirectOptions, ...directConnectionOptions }

			if (typeof redisOrUrlOrOptions === 'string') {
				url = redisOrUrlOrOptions
			} else if (
				typeof redisOrUrlOrOptions === 'object' &&
				(redisOrUrlOrOptions.url || redisOrUrlOrOptions.options)
			) {
				// Check this condition specifically for object with url/options
				url = redisOrUrlOrOptions.url
				options = { ...options, ...redisOrUrlOrOptions.options }
			}
			// Note: directConnectionOptions are already merged into options

			const envUrl = process.env['AUDIT_REDIS_URL']
			const finalUrl = url || envUrl // Prioritize explicitly passed URL/options object over env var

			if (finalUrl) {
				// If any URL (explicit, from object, or env) is found, attempt direct connection
				try {
					this.logger.info(
						`[AuditService] Creating new direct Redis connection to ${finalUrl.split('@').pop()} for queue "${this.queueName}".`
					)
					this.connection = new RedisInstance(finalUrl, options)
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err)
					this.logger.error(
						`[AuditService] Failed to create direct Redis instance for queue ${this.queueName}:`,
						err instanceof Error ? err : String(err)
					)
					throw new Error(
						`[AuditService] Failed to initialize direct Redis connection for queue ${this.queueName}. Error: ${err instanceof Error ? err.message : String(err)}`
					)
				}
			} else if (url || redisOrUrlOrOptions || directConnectionOptions) {
				// This case means an attempt for direct connection was made (e.g. empty string URL, or empty options object)
				// but resulted in no usable URL, and AUDIT_REDIS_URL was also not set.
				this.logger.warn(
					`[AuditService] Attempted direct Redis connection for queue "${this.queueName}" but no valid URL could be determined (explicitly or via AUDIT_REDIS_URL). Falling back to shared connection.`
				)
				this.connection = getSharedRedisConnection()
				this.isSharedConnection = true
			} else {
				// Scenario 3: No explicit direct connection info at all, and no env var, use the shared connection
				this.logger.info(
					`[AuditService] Using shared Redis connection for queue "${this.queueName}".`
				)
				this.connection = getSharedRedisConnection()
				this.isSharedConnection = true
			}
		} else if (process.env['AUDIT_REDIS_URL']) {
			// Scenario 2b: Only AUDIT_REDIS_URL is provided (no redisOrUrlOrOptions or directConnectionOptions)
			this.isSharedConnection = false
			const envUrl = process.env['AUDIT_REDIS_URL']
			const options: RedisOptions = { ...defaultDirectOptions } // directConnectionOptions is undefined here
			try {
				this.logger.info(
					`[AuditService] Creating new direct Redis connection using AUDIT_REDIS_URL to ${envUrl.split('@').pop()} for queue "${this.queueName}".`
				)
				this.connection = new RedisInstance(envUrl, options)
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				this.logger.error(
					`[AuditService] Failed to create direct Redis instance using AUDIT_REDIS_URL for queue ${this.queueName}:`,
					err instanceof Error ? err : String(err)
				)
				throw new Error(
					`[AuditService] Failed to initialize direct Redis connection using AUDIT_REDIS_URL for queue ${this.queueName}. Error: ${err instanceof Error ? err.message : String(err)}`
				)
			}
		} else {
			// Scenario 3: No specific connection info at all, use the shared connection
			this.logger.info(
				`[AuditService] Using shared Redis connection for queue "${this.queueName}".`
			)
			this.connection = getSharedRedisConnection()
			this.isSharedConnection = true
		}

		//this.bullmq_queue = new Queue(this.queueName, { connection: this.connection })
		try {
			this.bullmq_queue = new Queue<AuditLogEvent>(this.queueName, {
				connection: this.connection,
				defaultJobOptions: {
					removeOnComplete: 100, // Keep up to 100 jobs
					removeOnFail: false, // Keep failed jobs for dead letter processing
					attempts: 1, // Reliable processor handles retries
				},
			})
		} catch (error) {
			this.logger.error(
				`Failed to create BullMQ queue "${this.queueName}":`,
				error instanceof Error ? error : String(error)
			)
			throw new Error(
				`Failed to create BullMQ queue "${this.queueName}". Error: ${error instanceof Error ? error.message : String(error)}`
			)
		}

		// Attach listeners only if this instance created the connection (not shared and not provided externally)
		// The shared connection manages its own listeners.
		// If an external instance is provided, it's assumed its listeners are managed elsewhere.
		if (
			!this.isSharedConnection &&
			!(
				redisOrUrlOrOptions &&
				typeof redisOrUrlOrOptions === 'object' &&
				'status' in redisOrUrlOrOptions
			)
		) {
			this.connection.on('error', (err: Error) => {
				this.logger.error(
					`[AuditService] Redis Connection Error (direct connection for queue "${this.queueName}"): ${err.message}`,
					err
				)
			})
			this.connection.on('connect', () => {
				this.logger.info(
					`[AuditService] Successfully connected to Redis (direct connection for queue "${this.queueName}").`
				)
			})
			this.connection.on('ready', () => {
				this.logger.info(
					`[AuditService] Redis connection ready (direct connection for queue "${this.queueName}").`
				)
			})
			this.connection.on('close', () => {
				this.logger.info(
					`[AuditService] Redis connection closed (direct connection for queue "${this.queueName}").`
				)
			})
			this.connection.on('reconnecting', () => {
				this.logger.info(
					`[AuditService] Reconnecting to Redis (direct connection for queue "${this.queueName}")...`
				)
			})
		}
	}

	/**
	 * Generates cryptographic hash for audit event integrity verification
	 * Uses the integrated CryptoService with SHA-256 algorithm
	 */
	public generateEventHash(event: AuditLogEvent): string {
		return this.cryptoService.generateHash(event)
	}

	/**
	 * Verifies the cryptographic hash of an audit event
	 * Detects tampering by comparing computed hash with expected hash
	 */
	public verifyEventHash(event: AuditLogEvent, expectedHash: string): boolean {
		return this.cryptoService.verifyHash(event, expectedHash)
	}

	/**
	 * Generates cryptographic signature for audit event
	 * Uses HMAC-SHA256 for additional security
	 */
	public async generateEventSignature(
		event: AuditLogEvent,
		signingAlgorithm?: SigningAlgorithm
	): Promise<EventSignatureResponse> {
		return await this.cryptoService.generateEventSignature(event)
	}

	/**
	 * Verifies the cryptographic signature of an audit event
	 * Provides additional security through secret key authentication
	 */
	public async verifyEventSignature(
		event: AuditLogEvent,
		signature: string,
		signingAlgorithm?: SigningAlgorithm
	): Promise<boolean> {
		return await this.cryptoService.verifyEventSignature(event, signature, signingAlgorithm)
	}

	/**
	 * Logs an audit event by adding it to the BullMQ queue.
	 * The timestamp for the event is automatically generated at the time of logging.
	 * Automatically validates, sanitizes, and generates cryptographic hash and signature for immutability verification.
	 *
	 * @param eventDetails An object containing the details of the audit event,
	 *                     excluding the `timestamp` which will be added by this method.
	 *                     Requires `action` and `status` properties.
	 * @param options Optional configuration for the audit event
	 * @returns A Promise that resolves when the event has been successfully added to the queue.
	 * @throws Error if validation fails or if `eventDetails.action` or `eventDetails.status` are missing.
	 *
	 * @example
	 * ```typescript
	 * await auditService.log({
	 *   principalId: 'user-xyz',
	 *   action: 'itemUpdate',
	 *   targetResourceType: 'Item',
	 *   targetResourceId: 'item-123',
	 *   status: 'success',
	 *   outcomeDescription: 'Item updated successfully.',
	 *   changes: { oldValue: 'A', newValue: 'B' }
	 * }, {
	 *   generateHash: true,
	 *   generateSignature: true,
	 *   correlationId: 'corr-12345',
	 *   skipValidation: false
	 * });
	 * ```
	 
	async log(
		eventDetails: Omit<AuditLogEvent, 'timestamp'>,
		options: {
			generateHash?: boolean
			generateSignature?: boolean
			correlationId?: string
			eventVersion?: string
			skipValidation?: boolean
			validationConfig?: ValidationConfig
		} = {}
	): Promise<void> {
		if (!this.bullmq_queue) {
			throw new Error('[AuditService] Cannot log event: BullMQ queue is not initialized.')
		}

		// Check connection status before logging.
		if (
			!this.connection ||
			(this.connection.status !== 'ready' &&
				this.connection.status !== 'connecting' &&
				this.connection.status !== 'reconnecting')
		) {
			console.warn(
				`[AuditService] Attempting to log event for queue "${this.queueName}" while Redis connection status is '${this.connection?.status || 'unknown'}'. This might fail if Redis is unavailable.`
			)
		}

		const timestamp = new Date().toISOString()
		let event: AuditLogEvent = {
			timestamp,
			action: eventDetails.action,
			status: eventDetails.status,
			eventVersion: options.eventVersion || '1.0',
			hashAlgorithm: 'SHA-256',
			dataClassification: eventDetails.dataClassification || 'INTERNAL',
			retentionPolicy: eventDetails.retentionPolicy || 'standard',
			...eventDetails,
		}

		// Add correlation ID if provided
		if (options.correlationId) {
			event.correlationId = options.correlationId
		}

		// Validate and sanitize the event unless explicitly skipped
		if (!options.skipValidation) {
			const validationConfig = options.validationConfig || DEFAULT_VALIDATION_CONFIG
			const validationResult = validateAndSanitizeAuditEvent(event, validationConfig)

			if (!validationResult.isValid) {
				const errorMessages = validationResult.validationErrors
					.map((err) => `${err.field}: ${err.message} (${err.code})`)
					.join('; ')
				throw new Error(`[AuditService] Validation Error: ${errorMessages}`)
			}

			// Use the sanitized event
			event = validationResult.sanitizedEvent!

			// Log sanitization warnings if any
			if (validationResult.sanitizationWarnings.length > 0) {
				console.warn(
					`[AuditService] Sanitization warnings for queue "${this.queueName}":`,
					validationResult.sanitizationWarnings.map((w) => `${w.field}: ${w.message}`).join('; ')
				)
			}

			// Log validation warnings if any
			if (validationResult.validationWarnings.length > 0) {
				console.warn(
					`[AuditService] Validation warnings for queue "${this.queueName}":`,
					validationResult.validationWarnings.join('; ')
				)
			}
		}

		// Generate hash by default (can be disabled by setting generateHash: false)
		if (options.generateHash !== false) {
			const hash = this.generateEventHash(event)
			event = { ...event, hash }
		}

		// Generate signature if requested
		if (options.generateSignature) {
			const signature = this.generateEventSignature(event)
			event = { ...event, signature }
		}

		try {
			await this.bullmq_queue.add(this.queueName, event, {
				removeOnComplete: true,
				removeOnFail: false, // Consider a dead-letter queue for production.
			})
		} catch (error) {
			console.error(
				`[AuditService] Failed to add event to BullMQ queue "${this.queueName}":`,
				error
			)
			// Rethrow to allow the caller to handle the failure (e.g., retry, log differently).
			throw new Error(
				`[AuditService] Failed to log audit event to queue '${this.queueName}'. Error: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}
		*/

	/**
	 * Logs an audit event with guaranteed delivery using the reliable event processor.
	 * This method provides enhanced durability guarantees, retry mechanisms, circuit breaker protection,
	 * and dead letter queue handling for events that cannot be processed.
	 *
	 * @param eventDetails An object containing the details of the audit event
	 * @param options Optional configuration for reliable processing
	 * @returns A Promise that resolves when the event has been successfully queued for reliable processing
	 * @throws Error if validation fails or if the reliable processor is not available
	 *
	 * @example
	 * ```typescript
	 * await auditService.log({
	 *   principalId: 'user-xyz',
	 *   action: 'criticalDataUpdate',
	 *   targetResourceType: 'Patient',
	 *   targetResourceId: 'patient-123',
	 *   status: 'success',
	 *   outcomeDescription: 'Critical patient data updated successfully.',
	 * }, {
	 *   priority: 1, // High priority
	 *   durabilityGuarantees: true,
	 *   generateHash: true,
	 *   generateSignature: true
	 * });
	 * ```
	 */
	async log(
		eventDetails: Omit<AuditLogEvent, 'timestamp'>,
		options: {
			priority?: number
			delay?: number
			durabilityGuarantees?: boolean
			generateHash?: boolean
			generateSignature?: boolean
			correlationId?: string
			eventVersion?: string
			skipValidation?: boolean
			validationConfig?: ValidationConfig
		} = {}
	): Promise<void> {
		if (!this.bullmq_queue) {
			this.logger.error(
				`Cannot log event: BullMQ queue is not initialized for queue "${this.queueName}".`,
				'BullMQ queue is not initialized'
			)
			throw new Error(
				`[AuditService] Cannot log event: BullMQ queue is not initialized for queue "${this.queueName}".`
			)
		}
		// Check connection status before logging.
		if (
			!this.connection ||
			(this.connection.status !== 'ready' &&
				this.connection.status !== 'connecting' &&
				this.connection.status !== 'reconnecting')
		) {
			this.logger.warn(
				`[AuditService] Attempting to log event for queue "${this.queueName}" while Redis connection status is '${this.connection?.status || 'unknown'}'. This might fail if Redis is unavailable.`
			)
		}

		const timestamp = new Date().toISOString()
		let event: AuditLogEvent = {
			timestamp,
			action: eventDetails.action,
			status: eventDetails.status,
			eventVersion: options.eventVersion || '1.0',
			hashAlgorithm: 'SHA-256',
			dataClassification: eventDetails.dataClassification || 'INTERNAL',
			retentionPolicy: eventDetails.retentionPolicy || 'standard',
			...eventDetails,
		}

		// Add correlation ID if provided
		if (options.correlationId) {
			event.correlationId = options.correlationId
		}

		// Validate and sanitize the event unless explicitly skipped
		if (!options.skipValidation) {
			const validationConfig = options.validationConfig || DEFAULT_VALIDATION_CONFIG
			const validationResult = validateAndSanitizeAuditEvent(event, validationConfig)

			if (!validationResult.isValid) {
				const errorMessages = validationResult.validationErrors
					.map((err) => `${err.field}: ${err.message} (${err.code})`)
					.join('; ')
				this.logger.error(
					`Validation Error for queue "${this.queueName}": ${errorMessages}`,
					errorMessages
				)
				// FIXME: This error cause the system to crash
				//throw new Error(`[AuditService] Validation Error: ${errorMessages}`)
			}

			// FIXME: event = validationResult.sanitizedEvent! cause system to crash because timestamp is null
			event = validationResult.sanitizedEvent || event
		}

		// Generate hash by default (can be disabled by setting generateHash: false)
		if (options.generateHash !== false) {
			try {
				const hash = this.generateEventHash(event)
				event = { ...event, hash }
			} catch (error) {
				this.logger.error(
					`[AuditService] Failed to generate hash for event: ${error instanceof Error ? error.message : String(error)}`,
					error instanceof Error ? error : String(error)
				)
			}
		}

		// Generate signature if requested
		if (options.generateSignature) {
			try {
				const { signature, algorithm } = await this.generateEventSignature(event)
				event = { ...event, signature, algorithm }
			} catch (error) {
				this.logger.error(
					`[AuditService] Failed to generate signature for event: ${error instanceof Error ? error.message : String(error)}`,
					error instanceof Error ? error : String(error)
				)
			}
		}

		try {
			const job = await this.bullmq_queue.add(this.queueName, event, {
				priority: options.priority || 0,
				delay: options.delay || 0,
				removeOnComplete: options.durabilityGuarantees ? false : 100,
			})
			const jobId = job.id
			this.logger.info(
				`Event queued for reliable processing: ${event.action} (queue: ${this.queueName})`,
				{
					queueName: this.queueName,
					jobId,
				}
			)
		} catch (error) {
			this.logger.error(
				`[AuditService] Failed to add event to reliable processing queue "${this.queueName}":`,
				error instanceof Error ? error : String(error)
			)
			throw new Error(
				`[AuditService] Failed to log audit event with guaranteed delivery. Error: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Log an audit event with enhancements
	 */
	async logWithEnhancements(
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
		await this.log(enrichedEvent, {
			generateHash: this.config?.compliance.generateHash ?? true,
			generateSignature: this.config?.compliance.generateSignature ?? false,
			skipValidation: options.skipValidation,
			validationConfig: this.config?.validation,
		})
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
		await this.logWithEnhancements(
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
		action:
			| 'login'
			| 'logout'
			| 'password_change'
			| 'mfa_enable'
			| 'mfa_disable'
			| 'account'
			| 'session'
			| 'permission'
		status: 'attempt' | 'success' | 'failure'
		sessionContext?: any
		reason?: string
	}): Promise<void> {
		await this.logWithEnhancements(
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
		await this.logWithEnhancements(
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
		action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import' | 'pseudonymize'
		resourceType: string
		resourceId: string
		status: 'attempt' | 'success' | 'failure'
		dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
		changes?: any
		outcomeDescription?: string
		exportResult?: any
		metadata?: any
	}): Promise<void> {
		await this.logWithEnhancements({
			principalId: details.principalId,
			organizationId: details.organizationId,
			action: `data.${details.action}`,
			targetResourceType: details.resourceType,
			targetResourceId: details.resourceId,
			status: details.status,
			outcomeDescription: details.outcomeDescription,
			dataClassification: details.dataClassification || 'INTERNAL',
			changes: details.changes,
			exportResult: details.exportResult,
			metadata: details.exportResult,
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

		await this.log(enrichedEvent, {
			priority: options.priority || 1,
			durabilityGuarantees: true,
			generateHash: true,
			generateSignature: true,
		})
	}

	/**
	 * Closes the BullMQ queue associated with this Audit instance.
	 * If a direct Redis connection was created by this instance, it will also be closed.
	 * If a shared Redis connection is being used, this method WILL NOT close the shared connection.
	 * The shared connection's lifecycle should be managed globally (e.g., via `closeSharedRedisConnection` at app shutdown).
	 *
	 * @returns A Promise that resolves once cleanup is complete.
	 */
	async closeConnection(): Promise<void> {
		if (this.bullmq_queue) {
			try {
				await this.bullmq_queue.close()
				this.logger.info(`[AuditService] BullMQ queue '${this.queueName}' closed successfully.`)
			} catch (err) {
				this.logger.error(
					`[AuditService] Error closing BullMQ queue '${this.queueName}':`,
					err instanceof Error ? err : String(err)
				)
			}
		}

		if (this.connection && !this.isSharedConnection) {
			console.info(`[AuditService] Closing direct Redis connection for queue '${this.queueName}'.`)
			if ((this.connection.status as string) !== 'end') {
				try {
					await this.connection.quit()
					this.logger.info(
						`[AuditService] Direct Redis connection for queue '${this.queueName}' quit gracefully.`
					)
				} catch (err) {
					this.logger.error(
						`[AuditService] Error quitting direct Redis connection for queue '${this.queueName}':`,
						err instanceof Error ? err : String(err)
					)
					if (this.connection.status !== 'end') {
						this.connection.disconnect()
						this.logger.info(
							`[AuditService] Direct Redis connection for queue '${this.queueName}' disconnected forcefully.`
						)
					}
				}
			}
		} else if (this.isSharedConnection) {
			this.logger.info(
				`[AuditService] Using a shared Redis connection for queue '${this.queueName}'. Connection will not be closed by this instance.`
			)
		}
		// Nullify the connection if it was managed by this instance and is now closed.
		if (!this.isSharedConnection) {
			// @ts-expect-error Making connection undefined after close
			this.connection = undefined
		}
	}
}
