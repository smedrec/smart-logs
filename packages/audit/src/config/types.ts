/**
 * Configuration management types for the audit system
 * Uses existing types from the audit system to avoid duplication
 */

import { ArchiveConfig } from '../archival/archival-service.js'
import { DeliveryConfig } from '../report/scheduled-reporting.js'
import { ValidationConfig } from '../validation.js'

import type { LoggingConfig } from '@repo/logs'
import type { ReliableProcessorConfig } from '../queue/reliable-processor.js'
import type { RetryConfig } from '../retry.js'

export type StorageType = 's3' | 'file'
export type Environment = 'development' | 'staging' | 'production' | 'test'

export interface AuditConfig {
	/** Environment identifier */
	environment: Environment

	/** Configuration version for tracking changes */
	version: string

	/** Timestamp when configuration was last updated */
	lastUpdated: string

	/** Redis configuration */
	redis: RedisConfig

	/** Database configuration */
	database: DatabaseConfig

	/** Enhanced client configuration */
	enhancedClient: EnhancedClientConfig

	/** Server configuration */
	server: ServerConfig

	/** Worker configuration */
	worker: WorkerConfig

	/** Retry configuration */
	retry: RetryConfig

	/** ReliableProcessor configuration */
	reliableProcessor: ReliableProcessorConfig

	/** Monitoring configuration */
	monitoring: MonitoringConfig

	/** Observability configuration */
	observability: ObservabilityConfig

	/** Security configuration */
	security: SecurityConfig

	/** Compliance configuration */
	compliance: ComplianceConfig

	/** Validation configuration */
	validation: ValidationConfig

	/** Delivery configuration */
	//delivery: DeliveryConfig

	// Archival configuration
	archive: ArchiveConfig

	/** Logging configuration */
	logging: LoggingConfig
}

export interface RedisConfig {
	/** Redis connection URL */
	url: string

	/** Connection timeout in milliseconds */
	connectTimeout: number

	/** Command timeout in milliseconds */
	commandTimeout: number

	/** Maximum number of retries */
	maxRetriesPerRequest: number | null

	/** Retry delay on failure */
	retryDelayOnFailover: number

	/** Enable offline queue */
	enableOfflineQueue: boolean

	/** Enable auto pipelining */
	enableAutoPipelining: boolean
}

export interface DatabaseConfig {
	/** Database connection URL */
	url: string

	/** Connection pool size */
	poolSize: number

	/** Connection timeout in milliseconds */
	connectionTimeout: number

	/** Query timeout in milliseconds */
	queryTimeout: number

	/** Enable SSL */
	ssl: boolean

	/** Maximum connection attempts */
	maxConnectionAttempts: number
}

export interface EnhancedClientConfig {
	/** Connection pool configuration */
	connectionPool: ConnectionPoolConfig
	/** Query cache configuration */
	queryCacheFactory: CacheFactoryConfig
	/** Replication configuration */
	replication: ReplicationConfig
	/** Partition management configuration */
	partitioning: {
		enabled: boolean
		tables: string[]
		strategy: 'range' | 'hash' | 'list'
		interval: 'monthly' | 'quarterly' | 'yearly'
		retentionDays: number
		autoMaintenance: boolean
		maintenanceInterval: number
	}
	/** Performance monitoring configuration */
	monitoring: {
		enabled: boolean
		slowQueryThreshold: number
		metricsRetentionDays: number
		autoOptimization: boolean
	}
}

export interface ConnectionPoolConfig {
	/** Database connection URL */
	url: string
	/** Minimum number of connections in pool */
	minConnections: number
	/** Maximum number of connections in pool */
	maxConnections: number
	/** Connection idle timeout in milliseconds */
	idleTimeout: number
	/** Connection acquisition timeout in milliseconds */
	acquireTimeout: number
	/** Connection validation query */
	validationQuery?: string
	/** Enable connection validation */
	validateConnections: boolean
	/** Connection retry attempts */
	retryAttempts: number
	/** Retry delay in milliseconds */
	retryDelay: number
	/** Enable SSL */
	ssl: boolean
}

export interface ReplicationConfig {
	enabled: boolean
	readReplicas?: string[]
	routingStrategy?: 'round-robin'
	fallbackToMaster?: boolean
}

export type CacheType = 'local' | 'redis' | 'hybrid'

export interface QueryCacheConfig {
	/** Enable query result caching */
	enabled: boolean
	/** Maximum cache size in MB */
	maxSizeMB: number
	/** Default TTL for cached queries in seconds */
	defaultTTL: number
	/** Maximum number of cached queries */
	maxQueries: number
	/** Cache key prefix */
	keyPrefix: string
}

export interface CacheFactoryConfig {
	/** Cache type */
	type: CacheType
	queryCache: QueryCacheConfig
	redis?: {
		/** Redis key prefix for distributed cache */
		redisKeyPrefix: string
		/** Enable local cache as L1 cache (Redis as L2) */
		enableLocalCache: boolean
		/** Local cache size limit (smaller than main cache) */
		localCacheSizeMB: number
		/** Compression for large values */
		enableCompression: boolean
		/** Serialization format */
		serializationFormat: 'json' | 'msgpack'
	}
}

export interface WorkerConfig {
	/** Worker concurrency level */
	concurrency: number

	/** Queue name for audit events */
	queueName: string

	/** Worker port for health checks */
	port: number

	/** Enable graceful shutdown */
	gracefulShutdown: boolean

	/** Shutdown timeout in milliseconds */
	shutdownTimeout: number
}

export interface PerformanceConfig {
	/** Response caching configuration */
	responseCache: {
		enabled: boolean
		defaultTTL: number
		maxSizeMB: number
		keyPrefix: string
		/** Endpoints to exclude from caching (supports patterns) */
		excludeEndpoints?: string[]
		/** Specific cache TTL overrides per endpoint pattern */
		endpointTTLOverrides?: Record<string, number>
		/** Disable caching for endpoints matching these patterns */
		disableCachePatterns?: string[]
	}
	/** Pagination configuration */
	pagination: {
		defaultLimit: number
		maxLimit: number
		enableCursor: boolean
	}
	/** Streaming configuration */
	streaming: {
		enabled: boolean
		chunkSize: number
		maxConcurrentStreams: number
	}
	/** Concurrency configuration */
	concurrency: {
		maxConcurrentRequests: number
		queueTimeout: number
		enableRequestQueue: boolean
	}
	/** Performance monitoring */
	monitoring: {
		enableMetrics: boolean
		slowRequestThreshold: number
		memoryThreshold: number
	}
}

export interface ServerConfig {
	/** Server port */
	port: number

	/** Server host */
	host: string

	/** Server environment */
	environment: Environment

	/** Server Timeout */
	timeout: number

	cors: {
		origin: string | string[]
		credentials: boolean
		allowedMethods: string[]
		allowedHeaders: string[]
		exposeHeaders: string[]
		maxAge: number
	}
	rateLimit: {
		windowMs: number
		maxRequests: number
		skipSuccessfulRequests: boolean
		keyGenerator: 'ip' | 'user' | 'session'
	}
	auth: {
		sessionSecret: string
		sessionMaxAge: number
		trustedOrigins: string[]
		betterAuthUrl: string
		redisUrl?: string
		dbUrl?: string
		poolSize?: number
	}
	inngest: {
		enabled: boolean
		inngestPath: string
		id: string
		eventKey: string
		signingKey: string
		baseUrl: string
	}
	monitoring: {
		enableMetrics: boolean
		metricsPath: string
		healthCheckPath: string
		logLevel: 'debug' | 'info' | 'warn' | 'error'
		enableTracing: boolean
		tracingEndpoint?: string
	}
	security: {
		apiKeyHeader: string
		enableApiKeyAuth: boolean
		trustedProxies: string[]
		maxRequestSize: string
	}
	performance: PerformanceConfig
	api: {
		enableTrpc: boolean
		enableRest: boolean
		enableGraphql: boolean
		trpcPath: string
		restPath: string
		graphqlPath: string
		enableOpenApi: boolean
		openApiPath: string
	}
	externalServices: {
		smtp?: {
			host: string
			port: number
			secure: boolean
			user: string
			pass: string
			from: string
		}
		webhook?: {
			url: string
			method: 'GET' | 'POST' | 'PUT' | 'PATCH'
			headers: Record<string, string>
			timeout: number
			retryConfig: {
				maxRetries: number
				backoffMultiplier: number
				maxBackoffDelay: number
			}
		}
		storage?: {
			provider: 'local' | 's3' | 'gcs'
			config: Record<string, any>
			path: string
			retention: {
				days: number
				autoCleanup: boolean
			}
		}
	}
}

/**
 * Pattern detection configuration
 */
export interface PatternDetectionConfig {
	// Failed authentication thresholds
	failedAuthThreshold: number
	failedAuthTimeWindow: number // in milliseconds

	// Unauthorized access detection
	unauthorizedAccessThreshold: number
	unauthorizedAccessTimeWindow: number

	// Suspicious data access patterns
	dataAccessVelocityThreshold: number
	dataAccessTimeWindow: number

	// Bulk operations detection
	bulkOperationThreshold: number
	bulkOperationTimeWindow: number

	// Off-hours access detection
	offHoursStart: number // hour (0-23)
	offHoursEnd: number // hour (0-23)
}

export interface MonitoringConfig {
	/** Enable real-time monitoring */
	enabled: boolean

	/** Metrics collection interval in milliseconds */
	metricsInterval: number

	/** Alert thresholds */
	alertThresholds: {
		errorRate: number
		processingLatency: number
		queueDepth: number
		memoryUsage: number
	}

	/** Health check interval in milliseconds */
	healthCheckInterval: number

	patternDetection: PatternDetectionConfig

	notification: {
		/** Notification enabled status */
		enabled: boolean

		/** Notification service configuration
		/** Notification service provider */
		provider: 'push' | 'email' | 'slack' | 'telegram' | 'webhook'

		/** Notification service url */
		url: string

		// Notification service credentials
		credentials: {
			// Notification secret
			secret?: string

			/** Notification service username */
			username?: string

			/** Notification service password */
			password?: string
		}

		/** Notification channels */
		channels?: {
			email: string[]
			slack: string[]
			telegram: string[]
			webhook: string[]
		}

		/** Notification templates */
		templates?: {
			/** Error notification template */
			error: string

			/** Alert notification template */
			alert: string

			/** Pattern detection notification template */
			patternDetection: string
		}
	}
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
	// Tracing configuration
	tracing: {
		enabled: boolean
		serviceName: string
		sampleRate: number
		exporterType: 'console' | 'jaeger' | 'zipkin' | 'otlp'
		exporterEndpoint?: string
		headers?: Record<string, string>
	}

	// Metrics configuration
	metrics: {
		enabled: boolean
		collectionInterval: number
		retentionPeriod: number
		exporterType: 'prometheus' | 'console' | 'custom'
		exporterEndpoint?: string
	}

	// Profiling configuration
	profiling: {
		enabled: boolean
		sampleRate: number
		maxProfiles: number
		profileDuration: number
	}

	// Dashboard configuration
	dashboard: {
		enabled: boolean
		refreshInterval: number
		historyRetention: number
	}
}

export interface SecurityConfig {
	/** Enable cryptographic integrity verification */
	enableIntegrityVerification: boolean

	/** Hash algorithm for integrity verification */
	hashAlgorithm: 'SHA-256'

	/** Enable event signing */
	enableEventSigning: boolean

	/** Encryption key for sensitive data */
	encryptionKey: string

	/** Enable audit log encryption */
	enableLogEncryption: boolean

	/** KMS encryption settings */
	kms: {
		/** Enable KMS encryption */
		enabled: boolean

		/** KMS encryption key ID */
		encryptionKey: string

		/** KMS signing key ID */
		signingKey: string

		/** KMS access token */
		accessToken: string

		/** KMS base URL */
		baseUrl: string

		/** KMS encryption algorithm */
		algorithm?: 'AES-256-GCM' | 'AES-256-CBC'

		/** KMS key derivation function */
		kdf?: 'PBKDF2' | 'scrypt'

		/** KMS salt for key derivation */
		salt?: string

		/** KMS number of iterations for key derivation */
		iterations?: number
	}
}

// use @repo/logs type
//export interface LoggingConfig {
/** Log level */
//level: 'debug' | 'info' | 'warn' | 'error'

/** Enable structured logging */
//structured: boolean

/** Log format */
//format: 'json' | 'text'

/** Enable log correlation IDs */
//enableCorrelationIds: boolean

/** Log retention period in days */
//retentionDays: number

/** Export type for log messages */
//exporterType: 'console' | 'jaeger' | 'zipkin' | 'otlp'

/** Exporter endpoint */
//exporterEndpoint?: string

/** Exporter headers */
//exporterHeaders?: Record<string, string>
//}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
	constructor(
		message: string,
		public field: string,
		public value: any,
		public constraint: string
	) {
		super(message)
		this.name = 'ConfigValidationError'
	}
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
	/** Unique identifier for the change */
	id: number

	/** Timestamp of the change */
	timestamp: string

	/** Configuration field that changed */
	field: string

	/** Previous value */
	previousValue: any

	/** New value */
	newValue: any

	/** User or system that made the change */
	changedBy: string

	/** Reason for the change */
	reason?: string

	/** Environment where change occurred */
	environment: string

	/** Previous version of the configuration */
	previousVersion?: string

	/** New version of the configuration */
	newVersion?: string
}

/**
 * Configuration hot-reload settings
 */
export interface HotReloadConfig {
	/** Enable hot reloading */
	enabled: boolean

	/** Fields that support hot reloading */
	reloadableFields: string[]

	/** Reload check interval in milliseconds */
	checkInterval: number

	/** Configuration file path to watch */
	configFilePath?: string
}

/**
 * Secure configuration storage settings
 */
export interface SecureStorageConfig {
	/** Enable secure storage */
	enabled: boolean

	/** Encryption algorithm */
	algorithm: 'AES-256-GCM' | 'AES-256-CBC'

	/** Key derivation function */
	kdf: 'PBKDF2' | 'scrypt'

	/** Salt for key derivation */
	salt: string

	/** Number of iterations for key derivation */
	iterations: number

	/** KMS encryption settings */
	kms: {
		/** Enable KMS encryption */
		enabled: boolean

		/** KMS encryption key ID */
		encryptionKey: string

		/** KMS signing key ID */
		signingKey: string

		/** KMS access token */
		accessToken: string

		/** KMS base URL */
		baseUrl: string

		/** KMS encryption algorithm */
		algorithm?: 'AES-256-GCM' | 'AES-256-CBC'

		/** KMS key derivation function */
		kdf?: 'PBKDF2' | 'scrypt'

		/** KMS salt for key derivation */
		salt?: string

		/** KMS number of iterations for key derivation */
		iterations?: number
	}
}

/**
 * Compliance configuration for regulatory requirements
 */
export interface ComplianceConfig {
	/** Enable HIPAA compliance features */
	hipaa: {
		enabled: boolean
		requiredFields?: string[]
		retentionYears?: number
	}

	/** Enable GDPR compliance features */
	gdpr: {
		enabled: boolean
		defaultLegalBasis?: string
		retentionDays?: number
	}

	defaultRetentionDays: number
	defaultDataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
	generateHash: boolean
	generateSignature: boolean
	enableAutoArchival: boolean
	enablePseudonymization: boolean
	reportingSchedule: {
		enabled: boolean
		frequency: 'daily' | 'weekly' | 'monthly'
		recipients: string[]
		includeHIPAA: boolean
		includeGDPR: boolean
	}

	/** Custom compliance rules */
	custom?: Array<{
		name: string
		rules: ComplianceRule[]
	}>
}

/**
 * Custom compliance rule definition
 */
export interface ComplianceRule {
	field: string
	required?: boolean
	validator?: (value: any) => boolean
	message?: string
}

/**
 * Comprehensive compliance configuration
 */
//export interface ComplianceConfig {
/** HIPAA compliance configuration */
//hipaa: HIPAAComplianceConfig

/** GDPR compliance configuration */
//gdpr: GDPRComplianceConfig

/** Default data retention period in days */
//defaultRetentionDays: number

/** Enable automatic data archival */
//enableAutoArchival: boolean

/** Enable data pseudonymization */
//enablePseudonymization: boolean

/** Compliance reporting schedule */
//reportingSchedule: {
//enabled: boolean
//frequency: 'daily' | 'weekly' | 'monthly'
//recipients: string[]
//includeHIPAA: boolean
//includeGDPR: boolean
//}

/** Custom compliance rules */
//customRules: ComplianceRule[]
//}
/**
 * Custom compliance rule definition
 */
//export interface ComplianceRule {
/** Rule identifier */
//id: string
/** Rule name */
//name: string
/** Rule description */
//description: string
/** Field path to validate */
//field: string
/** Whether field is required */
//required: boolean
/** Validation function */
//validator?: (value: any) => boolean
/** Error message when validation fails */
//message: string
/** Applicable compliance frameworks */
//frameworks: Array<'HIPAA' | 'GDPR' | 'CUSTOM'>
//}
