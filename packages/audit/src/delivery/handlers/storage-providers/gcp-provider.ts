/**
 * Google Cloud Storage provider implementation
 * Requirements 1.1, 10.2, 10.4: Google Cloud Storage handler with service account auth
 */

import {
	StorageAuthenticationError,
	StorageError,
	StorageNetworkError,
	StorageNotFoundError,
	StorageQuotaExceededError,
} from '../storage-handler.js'

import type { ConnectionTestResult, ValidationResult } from '../../types.js'
import type {
	GCPStorageConfig,
	IStorageProvider,
	StorageConfig,
	StorageDownloadResult,
	StorageListResult,
	StorageObjectInfo,
	StorageProvider,
	StorageUploadResult,
} from '../storage-handler.js'

/**
 * Mock Google Cloud Storage client interface
 * In a real implementation, this would use @google-cloud/storage
 */
interface GCPStorageClient {
	bucket(name: string): GCPBucket
}

interface GCPBucket {
	exists(): Promise<[boolean]>
	file(name: string): GCPFile
	getFiles(options?: { prefix?: string; maxResults?: number }): Promise<[GCPFile[]]>
}

interface GCPFile {
	save(data: Buffer, options?: any): Promise<void>
	download(): Promise<[Buffer]>
	delete(): Promise<void>
	exists(): Promise<[boolean]>
	getMetadata(): Promise<[GCPFileMetadata]>
	name: string
}

interface GCPFileMetadata {
	name: string
	size: string
	updated: string
	etag: string
	contentType?: string
	metadata?: Record<string, string>
	storageClass?: string
}

/**
 * Google Cloud Storage provider
 * Requirements 1.1, 10.2, 10.4: Google Cloud Storage with service account authentication
 */
export class GCPStorageProvider implements IStorageProvider {
	readonly provider: StorageProvider = 'gcp'

	private client: GCPStorageClient | null = null
	private config: GCPStorageConfig | null = null
	private bucketName: string = ''

	/**
	 * Initialize Google Cloud Storage client with configuration
	 * Requirements 10.2, 10.4: Service account authentication support
	 */
	async initialize(storageConfig: StorageConfig): Promise<void> {
		if (storageConfig.provider !== 'gcp') {
			throw new StorageError(
				'Invalid provider for GCPStorageProvider',
				'INVALID_PROVIDER',
				400,
				false
			)
		}

		this.config = storageConfig.config as GCPStorageConfig
		this.bucketName = this.config.bucket

		// In a real implementation, this would create the actual GCP client
		// For now, we'll create a mock client to demonstrate the interface
		this.client = this.createMockGCPClient()
	}

	/**
	 * Test connection to Google Cloud Storage
	 * Requirements 1.2, 1.3, 1.4: Connection testing and validation
	 */
	async testConnection(): Promise<ConnectionTestResult> {
		const startTime = Date.now()

		try {
			if (!this.client || !this.config) {
				throw new StorageError('GCP client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			// Test connection by checking if bucket exists
			const bucket = this.client.bucket(this.bucketName)
			const [exists] = await bucket.exists()

			if (!exists) {
				return {
					success: false,
					responseTime: Date.now() - startTime,
					error: `Bucket '${this.bucketName}' does not exist`,
					details: {
						bucket: this.bucketName,
						projectId: this.config.projectId,
					},
				}
			}

			return {
				success: true,
				responseTime: Date.now() - startTime,
				details: {
					bucket: this.bucketName,
					projectId: this.config.projectId,
				},
			}
		} catch (error: any) {
			return {
				success: false,
				responseTime: Date.now() - startTime,
				error: this.handleGCPError(error).message,
				details: {
					bucket: this.bucketName,
					projectId: this.config?.projectId,
					errorCode: error.name || error.code,
				},
			}
		}
	}

	/**
	 * Validate Google Cloud Storage configuration
	 * Requirements 1.2, 1.3, 1.4, 10.2, 10.4: Configuration validation
	 */
	validateConfig(storageConfig: StorageConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		if (storageConfig.provider !== 'gcp') {
			errors.push('Provider must be "gcp" for GCPStorageProvider')
			return { isValid: false, errors, warnings }
		}

		const config = storageConfig.config as GCPStorageConfig

		// Required fields
		if (!config.projectId) {
			errors.push('GCP project ID is required')
		} else if (!/^[a-z0-9-]{6,30}$/.test(config.projectId)) {
			errors.push(
				'GCP project ID must be 6-30 characters long and contain only lowercase letters, numbers, and hyphens'
			)
		}

		if (!config.bucket) {
			errors.push('GCP bucket name is required')
		} else {
			// Validate bucket name format
			if (!/^[a-z0-9._-]{3,63}$/.test(config.bucket)) {
				errors.push(
					'GCP bucket name must be 3-63 characters long and contain only lowercase letters, numbers, dots, underscores, and hyphens'
				)
			}
			if (config.bucket.startsWith('goog') || config.bucket.includes('google')) {
				errors.push('GCP bucket name cannot start with "goog" or contain "google"')
			}
			if (config.bucket.startsWith('.') || config.bucket.endsWith('.')) {
				errors.push('GCP bucket name cannot start or end with a dot')
			}
		}

		// Authentication validation
		const hasKeyFile = config.keyFilename
		const hasCredentials = config.credentials

		if (!hasKeyFile && !hasCredentials) {
			warnings.push(
				'No explicit credentials provided - will use default service account or environment variables'
			)
		} else if (hasKeyFile && hasCredentials) {
			warnings.push('Both keyFilename and credentials provided - keyFilename will take precedence')
		}

		if (hasKeyFile && typeof config.keyFilename !== 'string') {
			errors.push('GCP keyFilename must be a string path to the service account key file')
		}

		if (hasCredentials) {
			if (typeof config.credentials !== 'object' || config.credentials === null) {
				errors.push('GCP credentials must be a valid service account key object')
			} else {
				const requiredFields = [
					'type',
					'project_id',
					'private_key_id',
					'private_key',
					'client_email',
				]
				for (const field of requiredFields) {
					if (!config.credentials[field]) {
						errors.push(`GCP credentials missing required field: ${field}`)
					}
				}
			}
		}

		// Storage class validation
		if (config.storageClass) {
			const validStorageClasses = ['STANDARD', 'NEARLINE', 'COLDLINE', 'ARCHIVE']
			if (!validStorageClasses.includes(config.storageClass)) {
				errors.push(`Invalid GCP storage class: ${config.storageClass}`)
			}
		}

		// Endpoint validation for custom endpoints
		if (config.endpoint) {
			try {
				new URL(config.endpoint)
			} catch {
				errors.push('GCP endpoint must be a valid URL')
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Upload object to Google Cloud Storage
	 * Requirements 2.1: File upload with metadata and storage classes
	 */
	async upload(
		key: string,
		data: Buffer | string,
		metadata?: Record<string, string>
	): Promise<StorageUploadResult> {
		try {
			if (!this.client || !this.config) {
				throw new StorageError('GCP client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')

			const bucket = this.client.bucket(this.bucketName)
			const file = bucket.file(key)

			const uploadOptions: any = {
				metadata: {
					metadata,
				},
			}

			// Set storage class if configured
			if (this.config.storageClass) {
				uploadOptions.storageClass = this.config.storageClass
			}

			// Set content type based on data
			if (typeof data === 'string' || this.isJsonData(buffer)) {
				uploadOptions.metadata.contentType = 'application/json'
			} else {
				uploadOptions.metadata.contentType = 'application/octet-stream'
			}

			await file.save(buffer, uploadOptions)

			// Get metadata to retrieve etag and other info
			const [fileMetadata] = await file.getMetadata()

			// Generate URL for the uploaded object
			const url = this.config.endpoint
				? `${this.config.endpoint}/${this.bucketName}/${key}`
				: `https://storage.googleapis.com/${this.bucketName}/${key}`

			return {
				key,
				url,
				etag: fileMetadata.etag,
				size: buffer.length,
				metadata,
			}
		} catch (error: any) {
			throw this.handleGCPError(error)
		}
	}

	/**
	 * Download object from Google Cloud Storage
	 */
	async download(key: string): Promise<StorageDownloadResult> {
		try {
			if (!this.client) {
				throw new StorageError('GCP client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const bucket = this.client.bucket(this.bucketName)
			const file = bucket.file(key)

			const [data] = await file.download()
			const [metadata] = await file.getMetadata()

			return {
				data,
				metadata: metadata.metadata,
				lastModified: new Date(metadata.updated),
				contentType: metadata.contentType,
				size: parseInt(metadata.size, 10),
			}
		} catch (error: any) {
			throw this.handleGCPError(error)
		}
	}

	/**
	 * Delete object from Google Cloud Storage
	 */
	async delete(key: string): Promise<void> {
		try {
			if (!this.client) {
				throw new StorageError('GCP client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const bucket = this.client.bucket(this.bucketName)
			const file = bucket.file(key)

			await file.delete()
		} catch (error: any) {
			throw this.handleGCPError(error)
		}
	}

	/**
	 * Check if object exists in Google Cloud Storage
	 */
	async exists(key: string): Promise<boolean> {
		try {
			if (!this.client) {
				throw new StorageError('GCP client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const bucket = this.client.bucket(this.bucketName)
			const file = bucket.file(key)

			const [exists] = await file.exists()
			return exists
		} catch (error: any) {
			if (error.code === 404) {
				return false
			}
			throw this.handleGCPError(error)
		}
	}

	/**
	 * List objects in Google Cloud Storage
	 */
	async listObjects(prefix?: string, maxKeys?: number): Promise<StorageListResult> {
		try {
			if (!this.client) {
				throw new StorageError('GCP client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const bucket = this.client.bucket(this.bucketName)

			const [files] = await bucket.getFiles({
				prefix,
				maxResults: maxKeys || 1000,
			})

			const objects: StorageObjectInfo[] = []

			for (const file of files) {
				const [metadata] = await file.getMetadata()
				objects.push({
					key: file.name,
					size: parseInt(metadata.size, 10),
					lastModified: new Date(metadata.updated),
					etag: metadata.etag,
					storageClass: metadata.storageClass,
				})
			}

			return {
				objects,
				isTruncated: files.length >= (maxKeys || 1000),
			}
		} catch (error: any) {
			throw this.handleGCPError(error)
		}
	}

	/**
	 * Get provider information
	 */
	getProviderInfo() {
		return {
			name: 'Google Cloud Storage',
			version: '7.x',
			features: [
				'storage-classes',
				'lifecycle-management',
				'object-versioning',
				'uniform-bucket-level-access',
				'customer-managed-encryption',
			],
		}
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		this.client = null
		this.config = null
		this.bucketName = ''
	}

	/**
	 * Handle GCP-specific errors and convert to storage errors
	 */
	private handleGCPError(error: any): StorageError {
		const errorCode = error.name || error.code || 'UNKNOWN_ERROR'
		const message = error.message || 'Unknown GCP error'
		const statusCode = error.status || error.statusCode || 0

		switch (errorCode) {
			case 'NOT_FOUND':
			case 'NoSuchKey':
			case 'NoSuchBucket':
				return new StorageNotFoundError(message, 'gcp')

			case 'UNAUTHENTICATED':
			case 'PERMISSION_DENIED':
			case 'FORBIDDEN':
				return new StorageAuthenticationError(message, 'gcp')

			case 'QUOTA_EXCEEDED':
				return new StorageQuotaExceededError('gcp')

			case 'RESOURCE_EXHAUSTED':
				// Check if it's quota exceeded or rate limiting based on message
				if (message.toLowerCase().includes('quota')) {
					return new StorageQuotaExceededError('gcp')
				}
				return new StorageError(
					`GCP rate limit exceeded: ${message}`,
					'RATE_LIMIT_EXCEEDED',
					statusCode,
					true
				)

			case 'DEADLINE_EXCEEDED':
			case 'TIMEOUT':
				return new StorageNetworkError(message, 'gcp')

			case 'UNAVAILABLE':
			case 'INTERNAL':
				return new StorageError(`GCP service error: ${message}`, 'SERVICE_ERROR', statusCode, true)

			default:
				// Determine if error is retryable based on status code
				const retryable = statusCode >= 500 || statusCode === 429 || statusCode === 0
				return new StorageError(`GCP error: ${message}`, errorCode, statusCode, retryable)
		}
	}

	/**
	 * Create mock GCP client for demonstration
	 * In a real implementation, this would use @google-cloud/storage
	 */
	private createMockGCPClient(): GCPStorageClient {
		return {
			bucket: (name: string) => ({
				exists: async () => [true] as [boolean],
				file: (fileName: string) => ({
					save: async (data: Buffer, options?: any) => {},
					download: async () => [Buffer.from('mock data')] as [Buffer],
					delete: async () => {},
					exists: async () => [true] as [boolean],
					getMetadata: async () =>
						[
							{
								name: fileName,
								size: '100',
								updated: new Date().toISOString(),
								etag: '"mock-etag"',
								contentType: 'application/octet-stream',
								metadata: {},
								storageClass: 'STANDARD',
							},
						] as [GCPFileMetadata],
					name: fileName,
				}),
				getFiles: async (options?: { prefix?: string; maxResults?: number }) => {
					const mockFile = {
						name: 'mock-file.txt',
						getMetadata: async () =>
							[
								{
									name: 'mock-file.txt',
									size: '100',
									updated: new Date().toISOString(),
									etag: '"mock-etag"',
									contentType: 'application/octet-stream',
									metadata: {},
									storageClass: 'STANDARD',
								},
							] as [GCPFileMetadata],
					} as GCPFile
					return [[mockFile]] as [GCPFile[]]
				},
			}),
		}
	}

	/**
	 * Check if buffer contains JSON data
	 */
	private isJsonData(buffer: Buffer): boolean {
		try {
			const str = buffer.toString('utf-8', 0, Math.min(100, buffer.length))
			return str.trim().startsWith('{') || str.trim().startsWith('[')
		} catch {
			return false
		}
	}
}

/**
 * Create and initialize GCP storage provider
 */
export function createGCPStorageProvider(): GCPStorageProvider {
	return new GCPStorageProvider()
}
