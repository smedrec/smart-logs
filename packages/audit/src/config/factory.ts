/**
 * Configuration factory for creating environment-specific configurations
 */
import 'dotenv/config'

import { generateDefaultSecret } from '../crypto.js'

import type { AuditConfig, CacheType } from './types.js'

/**
 * Create default configuration for development environment
 */
export function createDevelopmentConfig(): AuditConfig {
	return {
		environment: 'development',
		version: '1.0.0',
		lastUpdated: new Date().toISOString(),
		redis: {
			url: process.env.REDIS_URL || 'redis://localhost:6379',
			connectTimeout: 10000,
			commandTimeout: 10000,
			maxRetriesPerRequest: null,
			retryDelayOnFailover: 100,
			enableOfflineQueue: true,
			enableAutoPipelining: true,
		},
		database: {
			url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_dev',
			poolSize: 10,
			connectionTimeout: 10000,
			queryTimeout: 30000,
			ssl: false,
			maxConnectionAttempts: 3,
		},
		enhancedClient: {
			connectionPool: {
				url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_dev',
				minConnections: 2,
				maxConnections: 20,
				idleTimeout: 30000,
				acquireTimeout: 10000,
				validateConnections: true,
				retryAttempts: 3,
				retryDelay: 1000,
				ssl: false,
			},
			queryCacheFactory: {
				type: 'hybrid' as CacheType,
				queryCache: {
					enabled: true,
					maxSizeMB: 50,
					defaultTTL: 300, // 5 minutes
					maxQueries: 1000,
					keyPrefix: 'dev_audit_query',
				},
				redis: {
					redisKeyPrefix: 'audit_cache',
					enableLocalCache: true,
					localCacheSizeMB: 100,
					enableCompression: true,
					serializationFormat: 'json' as const,
				},
			},
			replication: {
				enabled: false,
				readReplicas: [
					process.env.AUDIT_DB_READ_REPLICA_URL || 'postgresql://localhost:5432/audit_dev',
				],
				routingStrategy: 'round-robin',
				fallbackToMaster: true,
			},
			partitioning: {
				enabled: true,
				tables: ['audit_log', 'error_log'],
				strategy: 'range',
				interval: 'monthly',
				retentionDays: 2555, // 7 years
				autoMaintenance: true,
				maintenanceInterval: 24 * 60 * 60 * 1000, // Daily
			},
			monitoring: {
				enabled: true,
				slowQueryThreshold: 1000, // 1 second
				metricsRetentionDays: 30,
				autoOptimization: true,
			},
		},
		server: {
			port: 3000,
			host: '0.0.0.0',
			environment: 'development',
			timeout: 30000,
			cors: {
				origin: '*',
				credentials: true,
				allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
				allowedHeaders: [
					'Content-Type',
					'Authorization',
					'x-application',
					'x-requestid',
					'x-version',
				],
			},
			rateLimit: {
				windowMs: 60000,
				maxRequests: 100,
				skipSuccessfulRequests: false,
				keyGenerator: 'ip',
			},
			auth: {
				sessionSecret:
					process.env.BETTER_AUTH_SECRET || 'your-session-secret-key-here-min-32-chars',
				sessionMaxAge: 86400,
				trustedOrigins: ['http://localhost:3001'],
				betterAuthUrl: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
				redisUrl: process.env.BETTER_AUTH_REDIS_URL || 'redis://localhost:6379',
				dbUrl: process.env.BETTER_AUTH_DB_URL || 'postgresql://localhost:5432/auth_dev',
				poolSize: 10,
			},
			inngest: {
				enabled: true,
				inngestPath: '/api/inngest',
				id: 'smart-logs-app-dev',
				eventKey: process.env.INNGEST_EVENT_KEY || 'your-event-key-here',
				signingKey: process.env.INNGEST_SIGNING_KEY || 'your-signing-key-here',
				baseUrl: process.env.INNGEST_BASE_URL || 'https://inngest.smedrec.qzz.io',
			},
			monitoring: {
				enableMetrics: true,
				metricsPath: '/metrics',
				healthCheckPath: '/health',
				logLevel: 'info',
				enableTracing: false,
			},
			performance: {
				responseCache: {
					enabled: true,
					defaultTTL: 60, // 1 minute for faster development
					maxSizeMB: 50,
					keyPrefix: 'dev_api_cache',
				},
				pagination: {
					defaultLimit: 20,
					maxLimit: 100,
					enableCursor: true,
				},
				streaming: {
					enabled: true,
					chunkSize: 500,
					maxConcurrentStreams: 5,
				},
				concurrency: {
					maxConcurrentRequests: 50,
					queueTimeout: 15000, // 15 seconds
					enableRequestQueue: true,
				},
				monitoring: {
					enableMetrics: true,
					slowRequestThreshold: 500, // 500ms for development
					memoryThreshold: 70, // 70%
				},
			},
			api: {
				enableTrpc: true,
				enableRest: true,
				enableGraphql: true,
				trpcPath: '/trpc',
				restPath: '/api',
				graphqlPath: '/graphql',
				enableOpenApi: true,
				openApiPath: '/api/docs',
			},
			security: {
				apiKeyHeader: 'x-api-key',
				enableApiKeyAuth: false,
				trustedProxies: [],
				maxRequestSize: '10mb',
			},
			externalServices: {},
		},
		worker: {
			concurrency: 2,
			queueName: 'audit-reliable-dev',
			port: 5600,
			gracefulShutdown: true,
			shutdownTimeout: 10000,
		},
		retry: {
			maxRetries: 3,
			baseDelay: 1000,
			maxDelay: 10000,
			backoffStrategy: 'exponential',
			retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
		},
		reliableProcessor: {
			queueName: 'audit-reliable-dev',
			concurrency: 2,
			retryConfig: {
				maxRetries: 3,
				baseDelay: 1000,
				maxDelay: 10000,
				backoffStrategy: 'exponential',
				retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
			},
			circuitBreakerConfig: {
				failureThreshold: 5,
				recoveryTimeout: 30000,
				monitoringPeriod: 60000,
				minimumThroughput: 10,
			},
			deadLetterConfig: {
				queueName: 'audit-dead-letter-dev',
				maxRetentionDays: 30,
				alertThreshold: 10,
				processingInterval: 3000,
				archiveAfterDays: 30,
			},
			persistentStorage: true,
			durabilityGuarantees: true,
		},
		monitoring: {
			enabled: true,
			metricsInterval: 30000,
			alertThresholds: {
				errorRate: 0.1,
				processingLatency: 5000,
				queueDepth: 100,
				memoryUsage: 0.8,
			},
			healthCheckInterval: 30000,
			patternDetection: {
				failedAuthThreshold: 5,
				failedAuthTimeWindow: 5 * 60 * 1000, // 5 minutes
				unauthorizedAccessThreshold: 3,
				unauthorizedAccessTimeWindow: 10 * 60 * 1000, // 10 minutes
				dataAccessVelocityThreshold: 50,
				dataAccessTimeWindow: 60 * 1000, // 1 minute
				bulkOperationThreshold: 100,
				bulkOperationTimeWindow: 5 * 60 * 1000, // 5 minutes
				offHoursStart: 22, // 10 PM
				offHoursEnd: 6, // 6 AM
			},
			notification: {
				enabled: true,
				provider: 'push',
				url: process.env.NOTIFICATION_URL || 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
				credentials: {
					secret: process.env.NOTIFICATION_SECRET || 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
				},
			},
		},
		security: {
			enableIntegrityVerification: true,
			hashAlgorithm: 'SHA-256',
			enableEventSigning: false,
			encryptionKey: process.env.AUDIT_CRYPTO_SECRET || generateDefaultSecret(),
			enableLogEncryption: false,
			kms: {
				enabled: true,
				encryptionKey: process.env.KMS_ENCRYPTION_KEY_ID || 'your-encryption-key-id',
				signingKey: process.env.KMS_SIGNING_KEY_ID || 'your-signing-key-id',
				accessToken: process.env.INFISICAL_ACCESS_TOKEN || 'your-access-token',
				baseUrl: process.env.INFISICAL_URL || 'https://infisical.smedrec.qzz.io',
			},
		},
		compliance: {
			hipaa: {
				enabled: true,
				retentionYears: 6,
			},
			gdpr: {
				enabled: true,
				defaultLegalBasis: 'legitimate_interest',
				retentionDays: 365,
			},
			defaultRetentionDays: 2555, // 7 years
			defaultDataClassification: 'INTERNAL',
			generateHash: true,
			generateSignature: true,
			enableAutoArchival: true,
			enablePseudonymization: true,
			reportingSchedule: {
				enabled: false,
				frequency: 'weekly',
				recipients: [],
				includeGDPR: false,
				includeHIPAA: false,
			},
		},
		validation: {
			maxStringLength: 10000,
			allowedDataClassifications: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'],
			requiredFields: ['timestamp', 'action', 'status'],
			maxCustomFieldDepth: 3,
			allowedEventVersions: ['1.0', '1.1', '2.0'],
		},
		archive: {
			compressionAlgorithm: 'gzip',
			compressionLevel: 6,
			format: 'json',
			batchSize: 1000,
			verifyIntegrity: true,
			encryptArchive: false,
		},
		logging: {
			level: 'debug',
			structured: true,
			format: 'json',
			enableCorrelationIds: true,
			retentionDays: 30,
			exporterType: 'otlp',
			exporterEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
			exporterHeaders: {
				...getAuthHeaders(),
			},
		},
	}
}

/**
 * Create default configuration for staging environment
 */
export function createStagingConfig(): AuditConfig {
	const baseConfig = createDevelopmentConfig()

	return {
		...baseConfig,
		environment: 'staging',
		redis: {
			...baseConfig.redis,
			url: process.env.REDIS_URL || 'redis://redis-staging:6379',
		},
		database: {
			...baseConfig.database,
			url: process.env.AUDIT_DB_URL || 'postgresql://postgres-staging:5432/audit_staging',
			ssl: true,
			poolSize: 15,
		},
		enhancedClient: {
			...baseConfig.enhancedClient,
			connectionPool: {
				...baseConfig.enhancedClient.connectionPool,
				url: process.env.AUDIT_DB_URL || 'postgresql://postgres-staging:5432/audit_staging',
				minConnections: 5,
				maxConnections: 30,
				retryAttempts: 5,
				retryDelay: 2000,
				ssl: true,
			},
			queryCacheFactory: {
				type: 'hybrid' as CacheType,
				queryCache: {
					enabled: true,
					maxSizeMB: 500,
					defaultTTL: 900, // 15 minutes
					maxQueries: 10000,
					keyPrefix: 'prod_audit_query',
				},
				redis: {
					redisKeyPrefix: 'audit_cache',
					enableLocalCache: true,
					localCacheSizeMB: 100,
					enableCompression: true,
					serializationFormat: 'json' as const,
				},
			},
			partitioning: {
				...baseConfig.enhancedClient.partitioning,
				retentionDays: 365, // 1 year
				maintenanceInterval: 24 * 60 * 60 * 1000, // Daily
			},
			monitoring: {
				...baseConfig.enhancedClient.monitoring,
				slowQueryThreshold: 2000, // 2 seconds
				metricsRetentionDays: 60,
				autoOptimization: true,
			},
		},
		server: {
			...baseConfig.server,
			environment: 'staging',
			auth: {
				...baseConfig.server.auth,
				sessionSecret: process.env.BETTER_AUTH_SECRET || generateDefaultSecret(),
				dbUrl: process.env.BETTER_AUTH_DB_URL || 'postgresql://postgres-staging:5432/auth_staging',
				redisUrl: process.env.BETTER_AUTH_REDIS_URL || 'redis://redis-staging:6379',
			},
			performance: {
				responseCache: {
					enabled: true,
					defaultTTL: 300, // 5 minutes
					maxSizeMB: 100,
					keyPrefix: 'staging_api_cache',
				},
				pagination: {
					defaultLimit: 50,
					maxLimit: 500,
					enableCursor: true,
				},
				streaming: {
					enabled: true,
					chunkSize: 1000,
					maxConcurrentStreams: 10,
				},
				concurrency: {
					maxConcurrentRequests: 100,
					queueTimeout: 30000, // 30 seconds
					enableRequestQueue: true,
				},
				monitoring: {
					enableMetrics: true,
					slowRequestThreshold: 1000, // 1 second
					memoryThreshold: 80, // 80%
				},
			},
		},
		worker: {
			...baseConfig.worker,
			concurrency: 4,
			queueName: 'audit-reliable-staging',
		},
		retry: {
			...baseConfig.retry,
			maxRetries: 5,
		},
		reliableProcessor: {
			...baseConfig.reliableProcessor,
			queueName: 'audit-reliable-staging',
			retryConfig: {
				...baseConfig.reliableProcessor.retryConfig,
				maxRetries: 5,
			},
			circuitBreakerConfig: {
				...baseConfig.reliableProcessor.circuitBreakerConfig,
				failureThreshold: 3,
				recoveryTimeout: 60000,
			},
			deadLetterConfig: {
				...baseConfig.reliableProcessor.deadLetterConfig,
				queueName: 'audit-dead-letter-staging',
				alertThreshold: 5,
				processingInterval: 3000,
				archiveAfterDays: 2, // 48 hours
			},
		},
		monitoring: {
			...baseConfig.monitoring,
			metricsInterval: 15000,
			alertThresholds: {
				errorRate: 0.05,
				processingLatency: 3000,
				queueDepth: 50,
				memoryUsage: 0.75,
			},
			healthCheckInterval: 15000,
		},
		security: {
			...baseConfig.security,
			enableEventSigning: true,
			enableLogEncryption: true,
		},
		compliance: {
			...baseConfig.compliance,
			reportingSchedule: {
				enabled: true,
				frequency: 'weekly',
				recipients: process.env.COMPLIANCE_RECIPIENTS?.split(',') || [],
				includeGDPR: true,
				includeHIPAA: true,
			},
		},
		validation: {
			...baseConfig.validation,
		},
		archive: {
			...baseConfig.archive,
			encryptArchive: true,
		},
		logging: {
			...baseConfig.logging,
			level: 'info',
			retentionDays: 90,
		},
	}
}

/**
 * Create default configuration for production environment
 */
export function createProductionConfig(): AuditConfig {
	const baseConfig = createStagingConfig()

	return {
		...baseConfig,
		environment: 'production',
		redis: {
			...baseConfig.redis,
			url: process.env.REDIS_URL || 'rediss://redis-prod:6380',
			connectTimeout: 5000,
			commandTimeout: 3000,
			maxRetriesPerRequest: 5,
		},
		database: {
			...baseConfig.database,
			url: process.env.AUDIT_DB_URL || 'postgresql://postgres-prod:5432/audit_prod',
			ssl: true,
			poolSize: 25,
			connectionTimeout: 5000,
			queryTimeout: 60000,
			maxConnectionAttempts: 5,
		},
		enhancedClient: {
			...baseConfig.enhancedClient,
			connectionPool: {
				...baseConfig.enhancedClient.connectionPool,
				url: process.env.AUDIT_DB_URL || 'postgresql://postgres-prod:5432/audit_prod',
				minConnections: 10,
				maxConnections: 50,
				retryAttempts: 10,
				retryDelay: 5000,
				ssl: true,
			},
			queryCacheFactory: {
				type: 'hybrid' as CacheType,
				queryCache: {
					enabled: true,
					maxSizeMB: 500,
					defaultTTL: 900, // 15 minutes
					maxQueries: 10000,
					keyPrefix: 'prod_audit_query',
				},
				redis: {
					redisKeyPrefix: 'audit_cache',
					enableLocalCache: true,
					localCacheSizeMB: 100,
					enableCompression: true,
					serializationFormat: 'json' as const,
				},
			},
			partitioning: {
				...baseConfig.enhancedClient.partitioning,
				retentionDays: 365 * 3, // 3 years
				maintenanceInterval: 7 * 24 * 60 * 60 * 1000, // Weekly
			},
			monitoring: {
				...baseConfig.enhancedClient.monitoring,
				slowQueryThreshold: 3000, // 3 seconds
				metricsRetentionDays: 90,
				autoOptimization: true,
			},
		},
		server: {
			...baseConfig.server,
			environment: 'production',
			auth: {
				...baseConfig.server.auth,
				sessionSecret: process.env.BETTER_AUTH_SECRET || generateDefaultSecret(),
				dbUrl: process.env.BETTER_AUTH_DB_URL || 'postgresql://postgres-staging:5432/auth_staging',
				redisUrl: process.env.BETTER_AUTH_REDIS_URL || 'redis://redis-staging:6379',
				poolSize: 20,
			},
			performance: {
				responseCache: {
					enabled: true,
					defaultTTL: 600, // 10 minutes
					maxSizeMB: 500,
					keyPrefix: 'prod_api_cache',
				},
				pagination: {
					defaultLimit: 50,
					maxLimit: 1000,
					enableCursor: true,
				},
				streaming: {
					enabled: true,
					chunkSize: 2000,
					maxConcurrentStreams: 20,
				},
				concurrency: {
					maxConcurrentRequests: 200,
					queueTimeout: 60000, // 60 seconds
					enableRequestQueue: true,
				},
				monitoring: {
					enableMetrics: true,
					slowRequestThreshold: 2000, // 2 seconds
					memoryThreshold: 85, // 85%
				},
			},
		},
		worker: {
			...baseConfig.worker,
			concurrency: 8,
			queueName: 'audit-reliable-prod',
			port: 3001,
			shutdownTimeout: 30000,
		},
		retry: {
			...baseConfig.retry,
			maxRetries: 5,
			baseDelay: 2000,
			maxDelay: 30000,
		},
		reliableProcessor: {
			...baseConfig.reliableProcessor,
			queueName: 'audit-reliable-prod',
			retryConfig: {
				...baseConfig.reliableProcessor.retryConfig,
				maxRetries: 5,
				baseDelay: 2000,
				maxDelay: 30000,
			},
			circuitBreakerConfig: {
				...baseConfig.reliableProcessor.circuitBreakerConfig,
			},
			deadLetterConfig: {
				...baseConfig.reliableProcessor.deadLetterConfig,
				queueName: 'audit-dead-letter-prod',
				alertThreshold: 20,
				archiveAfterDays: 7, // 7 days
			},
		},
		monitoring: {
			...baseConfig.monitoring,
			metricsInterval: 10000,
			alertThresholds: {
				errorRate: 0.01,
				processingLatency: 2000,
				queueDepth: 25,
				memoryUsage: 0.7,
			},
			healthCheckInterval: 10000,
		},
		security: {
			...baseConfig.security,
			enableIntegrityVerification: true,
			hashAlgorithm: 'SHA-256',
			enableEventSigning: true,
			enableLogEncryption: true,
		},
		compliance: {
			...baseConfig.compliance,
			reportingSchedule: {
				enabled: true,
				frequency: 'daily',
				recipients: process.env.COMPLIANCE_RECIPIENTS?.split(',') || [],
				includeGDPR: true,
				includeHIPAA: true,
			},
		},
		validation: {
			...baseConfig.validation,
		},
		archive: {
			...baseConfig.archive,
			encryptArchive: true,
		},
		logging: {
			...baseConfig.logging,
			level: 'warn',
			retentionDays: 365,
		},
	}
}

/**
 * Create default configuration for test environment
 */
export function createTestConfig(): AuditConfig {
	const baseConfig = createDevelopmentConfig()

	return {
		...baseConfig,
		environment: 'test',
		redis: {
			...baseConfig.redis,
			url: process.env.REDIS_URL || 'redis://localhost:6380',
		},
		database: {
			...baseConfig.database,
			url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
			poolSize: 5,
		},
		server: {
			...baseConfig.server,
			environment: 'test',
			auth: {
				...baseConfig.server.auth,
				sessionSecret: process.env.BETTER_AUTH_SECRET || generateDefaultSecret(),
				dbUrl: process.env.BETTER_AUTH_DB_URL || 'postgresql://postgres-staging:5432/auth_staging',
				redisUrl: process.env.BETTER_AUTH_REDIS_URL || 'redis://redis-staging:6379',
				poolSize: 5,
			},
		},
		worker: {
			...baseConfig.worker,
			concurrency: 1,
			queueName: 'audit-events-test',
			port: 3002,
		},
		retry: {
			...baseConfig.retry,
			maxRetries: 1,
			baseDelay: 100,
			maxDelay: 1000,
		},
		reliableProcessor: {
			...baseConfig.reliableProcessor,
			queueName: 'audit-reliable-test',
			retryConfig: {
				...baseConfig.reliableProcessor.retryConfig,
				maxRetries: 1,
				baseDelay: 100,
				maxDelay: 1000,
			},
			circuitBreakerConfig: {
				...baseConfig.reliableProcessor.circuitBreakerConfig,
				failureThreshold: 10,
				recoveryTimeout: 5000,
				monitoringPeriod: 10000,
				minimumThroughput: 5,
			},
			deadLetterConfig: {
				...baseConfig.reliableProcessor.deadLetterConfig,
				queueName: 'audit-dead-letter-test',
				alertThreshold: 50,
				processingInterval: 3000,
				archiveAfterDays: 1,
			},
		},
		monitoring: {
			...baseConfig.monitoring,
			enabled: false,
			metricsInterval: 60000,
			healthCheckInterval: 60000,
		},
		security: {
			...baseConfig.security,
			enableIntegrityVerification: false,
			enableEventSigning: false,
			enableLogEncryption: false,
		},
		compliance: {
			...baseConfig.compliance,
			defaultRetentionDays: 1,
			enableAutoArchival: false,
			enablePseudonymization: false,
			reportingSchedule: {
				enabled: false,
				frequency: 'daily',
				recipients: [],
				includeGDPR: false,
				includeHIPAA: false,
			},
		},
		validation: {
			...baseConfig.validation,
		},
		archive: {
			...baseConfig.archive,
			verifyIntegrity: false,
			encryptArchive: false,
		},
		logging: {
			...baseConfig.logging,
			level: 'error',
			retentionDays: 1,
		},
	}
}

/**
 * Create configuration based on environment
 */
export function createConfigForEnvironment(environment: string): AuditConfig {
	switch (environment.toLowerCase()) {
		case 'development':
		case 'dev':
			return createDevelopmentConfig()
		case 'staging':
		case 'stage':
			return createStagingConfig()
		case 'production':
		case 'prod':
			return createProductionConfig()
		case 'test':
			return createTestConfig()
		default:
			throw new Error(`Unknown environment: ${environment}`)
	}
}

/**
 * Create minimal configuration with only required fields
 */
export function createMinimalConfig(
	environment: 'development' | 'staging' | 'production' | 'test'
): Partial<AuditConfig> {
	return {
		environment,
		version: '1.0.0',
		lastUpdated: new Date().toISOString(),
		redis: {
			url: process.env.REDIS_URL || 'redis://localhost:6379',
			connectTimeout: 10000,
			commandTimeout: 5000,
			maxRetriesPerRequest: 3,
			retryDelayOnFailover: 100,
			enableOfflineQueue: true,
			enableAutoPipelining: true,
		},
		database: {
			url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit',
			poolSize: 10,
			connectionTimeout: 10000,
			queryTimeout: 30000,
			ssl: environment === 'production',
			maxConnectionAttempts: 3,
		},
		/**server: {
			host: 'localhost',
			port: 3001,
			environment: 'test',
			auth: {
				sessionSecret: process.env.BETTER_AUTH_SECRET || generateDefaultSecret(),
				sessionMaxAge: 86400000,
    		trustedOrigins: ['*'],
    		betterAuthUrl: process.env.BETTER_AUTH_URL || 'XXXXXXXXXXXXXXXXXXXXX',
				dbUrl: process.env.BETTER_AUTH_DB_URL || 'postgresql://localhost:5432/auth',
				redisUrl: process.env.BETTER_AUTH_REDIS_URL || 'redis://localhost:6379',
			},
		},*/
		worker: {
			concurrency: 2,
			queueName: `audit-events-${environment}`,
			port: 3001,
			gracefulShutdown: true,
			shutdownTimeout: 10000,
		},
	}
}

/**
 * Merge configurations with override precedence
 */
export function mergeConfigurations(
	baseConfig: AuditConfig,
	overrideConfig: Partial<AuditConfig>
): AuditConfig {
	const merged = { ...baseConfig }

	for (const [key, value] of Object.entries(overrideConfig)) {
		if (value !== undefined) {
			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				// Deep merge objects
				const currentValue = merged[key as keyof AuditConfig]
				if (typeof currentValue === 'object' && currentValue !== null) {
					merged[key as keyof AuditConfig] = {
						...(currentValue as Record<string, any>),
						...value,
					} as any
				} else {
					merged[key as keyof AuditConfig] = value as any
				}
			} else {
				// Direct assignment for primitives and arrays
				merged[key as keyof AuditConfig] = value as any
			}
		}
	}

	// Update metadata
	merged.lastUpdated = new Date().toISOString()

	return merged
}

/**
 * Get authentication headers based on configuration
 */
function getAuthHeaders(): Record<string, string> {
	const headers: Record<string, string> = {}

	// Support different authentication methods
	if (process.env.OTLP_API_KEY) {
		headers['Authorization'] = `Bearer ${process.env.OTLP_API_KEY}`
	} else if (process.env.OTLP_AUTH_HEADER) {
		const [key, value] = process.env.OTLP_AUTH_HEADER.split(':')
		if (key && value) {
			headers[key.trim()] = value.trim()
		}
	}

	return headers
}
