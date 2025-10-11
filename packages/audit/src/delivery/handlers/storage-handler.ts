/**
 * Storage destination handler for cloud providers
 * Requirements 1.1, 10.2, 10.4, 2.1: Storage handler with multi-provider support
 */

import type { IDestinationHandler } from '../interfaces.js'
import type {
	ConnectionTestResult,
	DeliveryPayload,
	DeliveryResult,
	DestinationConfig,
	ValidationResult,
} from '../types.js'

/**
 * Storage provider types supported by the storage handler
 */
export type StorageProvider = 'local' | 's3' | 'azure' | 'gcp'

/**
 * Common storage operation interface
 */
export interface StorageOperation {
	upload(
		key: string,
		data: Buffer | string,
		metadata?: Record<string, string>
	): Promise<StorageUploadResult>
	download(key: string): Promise<StorageDownloadResult>
	delete(key: string): Promise<void>
	exists(key: string): Promise<boolean>
	listObjects(prefix?: string, maxKeys?: number): Promise<StorageListResult>
}

/**
 * Storage upload result
 */
export interface StorageUploadResult {
	key: string
	url?: string
	etag?: string
	versionId?: string
	size: number
	metadata?: Record<string, string>
}

/**
 * Storage download result
 */
export interface StorageDownloadResult {
	data: Buffer
	metadata?: Record<string, string>
	lastModified?: Date
	contentType?: string
	size: number
}

/**
 * Storage list result
 */
export interface StorageListResult {
	objects: StorageObjectInfo[]
	isTruncated: boolean
	nextContinuationToken?: string
}

/**
 * Storage object information
 */
export interface StorageObjectInfo {
	key: string
	size: number
	lastModified: Date
	etag?: string
	storageClass?: string
}

/**
 * Storage configuration for different providers
 */
export interface StorageConfig {
	provider: StorageProvider
	config: LocalStorageConfig | S3StorageConfig | AzureStorageConfig | GCPStorageConfig
	path: string
	retention: {
		days: number
		autoCleanup: boolean
	}
	metadata?: Record<string, string>
	encryption?: {
		enabled: boolean
		algorithm?: string
		keyId?: string
	}
}

/**
 * Local filesystem storage configuration
 */
export interface LocalStorageConfig {
	basePath: string
	permissions?: string // e.g., '0644'
	createDirectories?: boolean
}

/**
 * AWS S3 storage configuration
 */
export interface S3StorageConfig {
	bucket: string
	region: string
	accessKeyId?: string
	secretAccessKey?: string
	sessionToken?: string
	endpoint?: string // For S3-compatible services
	forcePathStyle?: boolean
	storageClass?:
		| 'STANDARD'
		| 'REDUCED_REDUNDANCY'
		| 'STANDARD_IA'
		| 'ONEZONE_IA'
		| 'INTELLIGENT_TIERING'
		| 'GLACIER'
		| 'DEEP_ARCHIVE'
	serverSideEncryption?: {
		algorithm: 'AES256' | 'aws:kms'
		kmsKeyId?: string
	}
}

/**
 * Azure Blob Storage configuration
 */
export interface AzureStorageConfig {
	accountName: string
	accountKey?: string
	sasToken?: string
	connectionString?: string
	containerName: string
	endpoint?: string
	accessTier?: 'Hot' | 'Cool' | 'Archive'
}

/**
 * Google Cloud Storage configuration
 */
export interface GCPStorageConfig {
	projectId: string
	bucket: string
	keyFilename?: string
	credentials?: Record<string, any>
	endpoint?: string
	storageClass?: 'STANDARD' | 'NEARLINE' | 'COLDLINE' | 'ARCHIVE'
}

/**
 * Storage error types for better error handling
 */
export class StorageError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly statusCode?: number,
		public readonly retryable: boolean = false
	) {
		super(message)
		this.name = 'StorageError'
	}
}

/**
 * Storage authentication error
 */
export class StorageAuthenticationError extends StorageError {
	constructor(message: string, provider: StorageProvider) {
		super(`Authentication failed for ${provider}: ${message}`, 'AUTHENTICATION_ERROR', 401, false)
		this.name = 'StorageAuthenticationError'
	}
}

/**
 * Storage not found error
 */
export class StorageNotFoundError extends StorageError {
	constructor(key: string, provider: StorageProvider) {
		super(`Object not found: ${key} in ${provider}`, 'NOT_FOUND', 404, false)
		this.name = 'StorageNotFoundError'
	}
}

/**
 * Storage quota exceeded error
 */
export class StorageQuotaExceededError extends StorageError {
	constructor(provider: StorageProvider) {
		super(`Storage quota exceeded for ${provider}`, 'QUOTA_EXCEEDED', 413, false)
		this.name = 'StorageQuotaExceededError'
	}
}

/**
 * Storage network error
 */
export class StorageNetworkError extends StorageError {
	constructor(message: string, provider: StorageProvider) {
		super(`Network error for ${provider}: ${message}`, 'NETWORK_ERROR', 0, true)
		this.name = 'StorageNetworkError'
	}
}

/**
 * Base storage provider interface that all storage providers must implement
 */
export interface IStorageProvider {
	readonly provider: StorageProvider

	/**
	 * Initialize the storage provider with configuration
	 */
	initialize(config: StorageConfig): Promise<void>

	/**
	 * Test connection to the storage provider
	 */
	testConnection(): Promise<ConnectionTestResult>

	/**
	 * Validate the storage configuration
	 */
	validateConfig(config: StorageConfig): ValidationResult

	/**
	 * Upload data to storage
	 */
	upload(
		key: string,
		data: Buffer | string,
		metadata?: Record<string, string>
	): Promise<StorageUploadResult>

	/**
	 * Download data from storage
	 */
	download(key: string): Promise<StorageDownloadResult>

	/**
	 * Delete object from storage
	 */
	delete(key: string): Promise<void>

	/**
	 * Check if object exists in storage
	 */
	exists(key: string): Promise<boolean>

	/**
	 * List objects in storage
	 */
	listObjects(prefix?: string, maxKeys?: number): Promise<StorageListResult>

	/**
	 * Get storage provider specific metadata
	 */
	getProviderInfo(): {
		name: string
		version: string
		features: string[]
	}

	/**
	 * Clean up resources
	 */
	cleanup(): Promise<void>
}

/**
 * Storage handler that implements the destination handler interface
 * Requirements 1.1, 10.2, 10.4, 2.1: Storage destination handler implementation
 */
export class StorageHandler implements IDestinationHandler {
	readonly type = 'storage' as const

	private providers = new Map<StorageProvider, IStorageProvider>()
	private initialized = false

	constructor() {
		// Providers will be registered during initialization
	}

	/**
	 * Register a storage provider
	 */
	registerProvider(provider: IStorageProvider): void {
		this.providers.set(provider.provider, provider)
	}

	/**
	 * Get a storage provider by type
	 */
	private getProvider(providerType: StorageProvider): IStorageProvider {
		const provider = this.providers.get(providerType)
		if (!provider) {
			throw new StorageError(
				`Storage provider '${providerType}' not registered`,
				'PROVIDER_NOT_FOUND',
				500,
				false
			)
		}
		return provider
	}

	/**
	 * Validate storage configuration
	 * Requirements 1.2, 1.3, 1.4, 10.2, 10.4: Configuration validation
	 */
	validateConfig(config: DestinationConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		if (!config.storage) {
			errors.push('Storage configuration is required')
			return { isValid: false, errors, warnings }
		}

		const storageConfig = config.storage

		// Validate provider
		if (!storageConfig.provider) {
			errors.push('Storage provider is required')
		} else if (!['local', 's3', 'azure', 'gcp'].includes(storageConfig.provider)) {
			errors.push(`Unsupported storage provider: ${storageConfig.provider}`)
		}

		// Validate path
		if (!storageConfig.path) {
			errors.push('Storage path is required')
		} else if (storageConfig.path.includes('..')) {
			errors.push('Storage path cannot contain ".." for security reasons')
		}

		// Validate retention settings
		if (storageConfig.retention) {
			if (typeof storageConfig.retention.days !== 'number' || storageConfig.retention.days < 0) {
				errors.push('Retention days must be a non-negative number')
			}
			if (storageConfig.retention.days > 0 && storageConfig.retention.days < 1) {
				warnings.push('Retention period less than 1 day may cause immediate deletion')
			}
		}

		// Provider-specific validation
		if (storageConfig.provider && this.providers.has(storageConfig.provider)) {
			try {
				const provider = this.getProvider(storageConfig.provider)
				const providerValidation = provider.validateConfig(storageConfig as StorageConfig)
				errors.push(...providerValidation.errors)
				warnings.push(...providerValidation.warnings)
			} catch (error) {
				errors.push(
					`Provider validation failed: ${error instanceof Error ? error.message : String(error)}`
				)
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Test connection to storage provider
	 * Requirements 1.2, 1.3, 1.4: Connection testing and validation
	 */
	async testConnection(config: DestinationConfig): Promise<ConnectionTestResult> {
		const startTime = Date.now()

		try {
			if (!config.storage) {
				return {
					success: false,
					error: 'Storage configuration is required',
					responseTime: Date.now() - startTime,
				}
			}

			const provider = this.getProvider(config.storage.provider)
			await provider.initialize(config.storage as StorageConfig)

			const result = await provider.testConnection()

			return {
				...result,
				responseTime: Date.now() - startTime,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				responseTime: Date.now() - startTime,
			}
		}
	}

	/**
	 * Deliver payload to storage destination
	 * Requirements 2.1: Delivery implementation with storage upload
	 */
	async deliver(payload: DeliveryPayload, config: DestinationConfig): Promise<DeliveryResult> {
		const startTime = Date.now()

		try {
			if (!config.storage) {
				throw new StorageError('Storage configuration is required', 'INVALID_CONFIG', 400, false)
			}

			const provider = this.getProvider(config.storage.provider)
			await provider.initialize(config.storage as StorageConfig)

			// Generate storage key from path and payload metadata
			const key = this.generateStorageKey(config.storage.path, payload)

			// Prepare data for upload
			const data = this.prepareDataForUpload(payload)

			// Prepare metadata
			const metadata = {
				deliveryId: payload.deliveryId,
				organizationId: payload.organizationId,
				type: payload.type,
				correlationId: payload.correlationId || '',
				idempotencyKey: payload.idempotencyKey || '',
				uploadedAt: new Date().toISOString(),
				...(config.storage as StorageConfig).metadata,
				...payload.metadata,
			}

			// Upload to storage
			const uploadResult = await provider.upload(key, data, metadata)

			return {
				success: true,
				deliveredAt: new Date().toISOString(),
				responseTime: Date.now() - startTime,
				crossSystemReference: uploadResult.url || uploadResult.key,
				retryable: false,
			}
		} catch (error) {
			const isRetryable =
				error instanceof StorageNetworkError || (error instanceof StorageError && error.retryable)

			return {
				success: false,
				responseTime: Date.now() - startTime,
				error: error instanceof Error ? error.message : String(error),
				retryable: isRetryable,
			}
		}
	}

	/**
	 * Check if handler supports a specific feature
	 */
	supportsFeature(feature: string): boolean {
		const supportedFeatures = ['retry_with_backoff', 'encryption', 'compression', 'batch_delivery']
		return supportedFeatures.includes(feature)
	}

	/**
	 * Get configuration schema for validation
	 */
	getConfigSchema(): Record<string, any> {
		return {
			type: 'object',
			properties: {
				storage: {
					type: 'object',
					required: ['provider', 'config', 'path'],
					properties: {
						provider: {
							type: 'string',
							enum: ['local', 's3', 'azure', 'gcp'],
						},
						config: {
							type: 'object',
							// Provider-specific schema would be added here
						},
						path: {
							type: 'string',
							minLength: 1,
						},
						retention: {
							type: 'object',
							properties: {
								days: {
									type: 'number',
									minimum: 0,
								},
								autoCleanup: {
									type: 'boolean',
								},
							},
						},
						metadata: {
							type: 'object',
							additionalProperties: {
								type: 'string',
							},
						},
						encryption: {
							type: 'object',
							properties: {
								enabled: {
									type: 'boolean',
								},
								algorithm: {
									type: 'string',
								},
								keyId: {
									type: 'string',
								},
							},
						},
					},
				},
			},
		}
	}

	/**
	 * Generate storage key from path template and payload
	 */
	private generateStorageKey(pathTemplate: string, payload: DeliveryPayload): string {
		const now = new Date()
		const replacements = {
			'{organizationId}': payload.organizationId,
			'{deliveryId}': payload.deliveryId,
			'{type}': payload.type,
			'{year}': now.getFullYear().toString(),
			'{month}': (now.getMonth() + 1).toString().padStart(2, '0'),
			'{day}': now.getDate().toString().padStart(2, '0'),
			'{hour}': now.getHours().toString().padStart(2, '0'),
			'{minute}': now.getMinutes().toString().padStart(2, '0'),
			'{timestamp}': now.getTime().toString(),
		}

		let key = pathTemplate
		for (const [placeholder, value] of Object.entries(replacements)) {
			key = key.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value)
		}

		// Ensure key doesn't start with /
		return key.startsWith('/') ? key.slice(1) : key
	}

	/**
	 * Prepare payload data for upload
	 */
	private prepareDataForUpload(payload: DeliveryPayload): Buffer {
		if (Buffer.isBuffer(payload.data)) {
			return payload.data
		}

		if (typeof payload.data === 'string') {
			return Buffer.from(payload.data, 'utf-8')
		}

		// For objects, serialize as JSON
		return Buffer.from(JSON.stringify(payload.data, null, 2), 'utf-8')
	}
}

/**
 * Create and configure a storage handler with providers
 */
export function createStorageHandler(): StorageHandler {
	const handler = new StorageHandler()

	// Register providers when available
	try {
		// Dynamic import to avoid loading unnecessary dependencies
		import('./storage-providers/index.js')
			.then(({ defaultStorageProviderRegistry }) => {
				for (const providerType of defaultStorageProviderRegistry.getRegisteredProviders()) {
					const provider = defaultStorageProviderRegistry.create(providerType)
					handler.registerProvider(provider)
				}
			})
			.catch(() => {
				// Providers not available - handler will work with manually registered providers
			})
	} catch {
		// Providers not available - handler will work with manually registered providers
	}

	return handler
}

/**
 * Create and configure a storage handler with specific providers
 */
export function createStorageHandlerWithProviders(
	providerTypes: StorageProvider[]
): StorageHandler {
	const handler = new StorageHandler()

	// Import and register specific providers
	import('./storage-providers/index.js')
		.then(({ createStorageProvider }) => {
			for (const providerType of providerTypes) {
				try {
					const provider = createStorageProvider(providerType)
					handler.registerProvider(provider)
				} catch (error) {
					console.warn(`Failed to register storage provider '${providerType}':`, error)
				}
			}
		})
		.catch(() => {
			console.warn('Storage providers not available')
		})

	return handler
}
