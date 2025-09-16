/**
 * Configuration integration service for audit system
 * Provides seamless integration between configuration management and audit worker
 * Uses existing audit system types to avoid duplication
 */
import 'dotenv/config'

import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

import { createConfigForEnvironment } from './factory.js'
import { getConfigurationManager } from './manager.js'

import type { AuditConfig, HotReloadConfig, SecureStorageConfig, StorageType } from './types.js'

/**
 * Configuration integration options
 */
export interface ConfigIntegrationOptions {
	/** Configuration file path */
	configPath?: string

	/** Configuration storage type */
	storageType?: StorageType

	/** Environment name */
	environment?: string

	/** Enable hot reloading */
	enableHotReload?: boolean

	/** Hot reload configuration */
	hotReloadConfig?: Partial<HotReloadConfig>

	/** Enable secure storage */
	enableSecureStorage?: boolean

	/** Secure storage configuration */
	secureStorageConfig?: Partial<SecureStorageConfig>

	/** Create default config if not exists */
	createDefaultIfMissing?: boolean
}

/**
 * Default hot-reloadable fields for audit system
 */
const DEFAULT_HOT_RELOADABLE_FIELDS = [
	'worker.concurrency',
	'monitoring.metricsInterval',
	'monitoring.alertThresholds.errorRate',
	'monitoring.alertThresholds.processingLatency',
	'monitoring.alertThresholds.queueDepth',
	'monitoring.alertThresholds.memoryUsage',
	'monitoring.healthCheckInterval',
	'retry.maxRetries',
	'retry.baseDelay',
	'retry.maxDelay',
	'circuitBreaker.failureThreshold',
	'circuitBreaker.recoveryTimeout',
	'deadLetter.alertThreshold',
	'logging.level',
	'compliance.reportingSchedule.enabled',
	'compliance.reportingSchedule.frequency',
]

/**
 * Initialize audit configuration with environment-specific defaults
 */
export async function initializeAuditConfig(
	options: ConfigIntegrationOptions = {}
): Promise<{ config: AuditConfig; manager: ReturnType<typeof getConfigurationManager> }> {
	const {
		configPath = getDefaultConfigPath(),
		storageType = 'file',
		environment = process.env.NODE_ENV || 'development',
		enableHotReload = process.env.NODE_ENV !== 'production',
		hotReloadConfig = {},
		enableSecureStorage = process.env.NODE_ENV === 'production',
		secureStorageConfig = {},
		createDefaultIfMissing = true,
	} = options

	// Create default configuration if it doesn't exist
	if (createDefaultIfMissing && !existsSync(configPath)) {
		await createDefaultConfigFile(configPath, storageType, environment)
	}

	// Prepare hot reload configuration
	const finalHotReloadConfig: HotReloadConfig = {
		enabled: enableHotReload,
		reloadableFields: DEFAULT_HOT_RELOADABLE_FIELDS,
		checkInterval: 30000,
		configFilePath: configPath,
		...hotReloadConfig,
	}

	// Prepare secure storage configuration
	const finalSecureStorageConfig: SecureStorageConfig | undefined = enableSecureStorage
		? {
				enabled: true,
				algorithm: 'AES-256-GCM',
				kdf: 'PBKDF2',
				salt: process.env.AUDIT_CONFIG_SALT || (await generateSalt()),
				iterations: 100000,
				kms: {
					enabled: true,
					encryptionKey: process.env.KMS_ENCRYPTION_KEY || '',
					signingKey: process.env.KMS_SIGNING_KEY || '',
					accessToken: process.env.INFISICAL_ACCESS_TOKEN || '',
					baseUrl: process.env.INFISICAL_URL || '',
				},
				...secureStorageConfig,
			}
		: undefined

	// Initialize configuration manager
	const manager = getConfigurationManager(
		configPath,
		storageType,
		finalHotReloadConfig,
		finalSecureStorageConfig
	)

	await manager.initialize()

	return {
		config: manager.getConfig(),
		manager,
	}
}

/**
 * Get default configuration file path based on environment
 */
export function getDefaultConfigPath(): string {
	const environment = process.env.NODE_ENV || 'development'
	const configDir = process.env.AUDIT_CONFIG_DIR || join(process.cwd(), 'config')
	return `${configDir}/audit-${environment}.json`
	// FIXME: This is a temporary fix for the issue with the config path on windows
	//return join(configDir, `audit-${environment}.json`)
}

/**
 * Create default configuration file
 */
export async function createDefaultConfigFile(
	configPath: string,
	storageType: StorageType,
	environment: string
): Promise<void> {
	const config = createConfigForEnvironment(environment)

	if (storageType === 's3') {
		if (!process.env.S3_BUCKET) {
			throw new Error('S3 bucket not configured')
		}
		if (!process.env.S3_ENDPOINT) {
			throw new Error('S3 endpoint not configured')
		}
		if (!process.env.AWS_ACCESS_KEY_ID) {
			throw new Error('AWS access key ID not configured')
		}
		if (!process.env.AWS_SECRET_ACCESS_KEY) {
			throw new Error('AWS secret access key not configured')
		}
		// TODO: Add support for other storage providers
		const s3Client = new S3Client({
			region: process.env.S3_REGION || 'auto',
			endpoint: process.env.S3_ENDPOINT!,
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
			},
		})
		//const s3Key = `${process.env.S3_BUCKET}/${configPath}`
		const s3ParamsPutObject: any = {
			Bucket: process.env.S3_BUCKET,
			Key: configPath,
			Body: JSON.stringify(config, null, 2),
		}
		const command = new PutObjectCommand(s3ParamsPutObject)
		await s3Client?.send(command)
	} else {
		// Ensure directory exists
		const { dirname } = await import('path')
		const { mkdir } = await import('fs/promises')
		const configDir = dirname(configPath)
		await mkdir(configDir, { recursive: true })

		// Write configuration file
		await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
	}
}

/**
 * Generate a random salt for secure storage
 */
async function generateSalt(): Promise<string> {
	const { randomBytes } = await import('crypto')
	return randomBytes(32).toString('hex')
}

/**
 * Configuration change handler for audit worker integration
 */
export class AuditConfigChangeHandler {
	private callbacks: Map<string, Array<(newValue: any, oldValue: any) => void | Promise<void>>> =
		new Map()

	/**
	 * Register callback for configuration field changes
	 */
	onConfigChange<T = any>(
		fieldPath: string,
		callback: (newValue: T, oldValue: T) => void | Promise<void>
	): void {
		if (!this.callbacks.has(fieldPath)) {
			this.callbacks.set(fieldPath, [])
		}
		this.callbacks.get(fieldPath)!.push(callback)
	}

	/**
	 * Handle configuration change event
	 */
	async handleChange(fieldPath: string, newValue: any, oldValue: any): Promise<void> {
		const callbacks = this.callbacks.get(fieldPath)
		if (callbacks) {
			await Promise.all(callbacks.map((callback) => callback(newValue, oldValue)))
		}
	}

	/**
	 * Remove all callbacks for a field
	 */
	removeCallbacks(fieldPath: string): void {
		this.callbacks.delete(fieldPath)
	}

	/**
	 * Remove all callbacks
	 */
	removeAllCallbacks(): void {
		this.callbacks.clear()
	}
}

/**
 * Setup configuration integration for audit worker
 */
export async function setupAuditConfigIntegration(options: ConfigIntegrationOptions = {}): Promise<{
	config: AuditConfig
	manager: ReturnType<typeof getConfigurationManager>
	changeHandler: AuditConfigChangeHandler
}> {
	const { config, manager } = await initializeAuditConfig(options)
	const changeHandler = new AuditConfigChangeHandler()

	// Setup hot reload event handling
	manager.on('hotReload', async ({ path, newValue, previousValue }) => {
		await changeHandler.handleChange(path, newValue, previousValue)
	})

	// Setup configuration change event handling
	manager.on('configChanged', async (changeEvent) => {
		await changeHandler.handleChange(
			changeEvent.field,
			changeEvent.newValue,
			changeEvent.previousValue
		)
	})

	return {
		config,
		manager,
		changeHandler,
	}
}

/**
 * Validate environment configuration requirements
 */
export function validateEnvironmentConfig(config: AuditConfig): void {
	const environment = config.environment

	// Production-specific validations
	if (environment === 'production') {
		if (!config.security.enableIntegrityVerification) {
			throw new Error('Integrity verification must be enabled in production')
		}

		if (!config.database.ssl) {
			throw new Error('Database SSL must be enabled in production')
		}

		if (config.logging.level === 'debug') {
			console.warn('Warning: Debug logging is enabled in production')
		}

		if (!config.security.encryptionKey && config.security.enableLogEncryption) {
			throw new Error('Encryption key is required when log encryption is enabled in production')
		}
	}

	// Development-specific validations
	if (environment === 'development') {
		if (config.worker.concurrency > 10) {
			console.warn('Warning: High concurrency in development environment may impact performance')
		}
	}

	// Test-specific validations
	if (environment === 'test') {
		if (config.compliance.gdpr.enabled) {
			console.warn('Warning: GDPR compliance is enabled in test environment')
		}
	}
}

/**
 * Get configuration summary for logging/monitoring
 */
export function getConfigSummary(config: AuditConfig): Record<string, any> {
	return {
		environment: config.environment,
		version: config.version,
		lastUpdated: config.lastUpdated,
		worker: {
			concurrency: config.worker.concurrency,
			queueName: config.worker.queueName,
			port: config.worker.port,
		},
		monitoring: {
			enabled: config.monitoring.enabled,
			metricsInterval: config.monitoring.metricsInterval,
		},
		security: {
			integrityVerification: config.security.enableIntegrityVerification,
			eventSigning: config.security.enableEventSigning,
			logEncryption: config.security.enableLogEncryption,
		},
		compliance: {
			hipaa: config.compliance.hipaa.enabled,
			gdpr: config.compliance.gdpr.enabled,
			retentionDays: config.compliance.defaultRetentionDays,
			autoArchival: config.compliance.enableAutoArchival,
		},
	}
}
