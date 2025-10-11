import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3'

import {
	StorageAuthenticationError,
	StorageError,
	StorageNetworkError,
	StorageNotFoundError,
	StorageQuotaExceededError,
} from '../storage-handler.js'

import type {
	DeleteObjectCommandInput,
	GetObjectCommandInput,
	HeadObjectCommandInput,
	ListObjectsV2CommandInput,
	PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import type { ConnectionTestResult, ValidationResult } from '../../types.js'
import type {
	IStorageProvider,
	S3StorageConfig,
	StorageConfig,
	StorageDownloadResult,
	StorageListResult,
	StorageObjectInfo,
	StorageProvider,
	StorageUploadResult,
} from '../storage-handler.js'

/**
 * AWS S3 storage provider implementation
 * Requirements 1.1, 10.2, 10.4, 2.1: S3 storage handler with IAM authentication
 */

/**
 * AWS S3 storage provider
 * Requirements 1.1, 10.2, 10.4, 2.1: S3 client with IAM role and access key support
 */
export class S3StorageProvider implements IStorageProvider {
	readonly provider: StorageProvider = 's3'

	private client: S3Client | null = null
	private config: S3StorageConfig | null = null
	private bucketName: string = ''

	/**
	 * Initialize S3 client with configuration
	 * Requirements 10.2, 10.4: IAM role and access key authentication support
	 */
	async initialize(storageConfig: StorageConfig): Promise<void> {
		if (storageConfig.provider !== 's3') {
			throw new StorageError(
				'Invalid provider for S3StorageProvider',
				'INVALID_PROVIDER',
				400,
				false
			)
		}

		this.config = storageConfig.config as S3StorageConfig
		this.bucketName = this.config.bucket

		// Configure S3 client with authentication
		const clientConfig: any = {
			region: this.config.region,
		}

		// Handle different authentication methods
		if (this.config.accessKeyId && this.config.secretAccessKey) {
			// Access key authentication
			clientConfig.credentials = {
				accessKeyId: this.config.accessKeyId,
				secretAccessKey: this.config.secretAccessKey,
				...(this.config.sessionToken && { sessionToken: this.config.sessionToken }),
			}
		}
		// If no explicit credentials, SDK will use IAM roles, environment variables, or AWS config

		// Handle custom endpoint (for S3-compatible services)
		if (this.config.endpoint) {
			clientConfig.endpoint = this.config.endpoint
			clientConfig.forcePathStyle = this.config.forcePathStyle ?? true
		}

		this.client = new S3Client(clientConfig)
	}

	/**
	 * Test connection to S3
	 * Requirements 1.2, 1.3, 1.4: Connection testing and validation
	 */
	async testConnection(): Promise<ConnectionTestResult> {
		const startTime = Date.now()

		try {
			if (!this.client || !this.config) {
				throw new StorageError('S3 client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			// Test connection by listing objects with limit 1
			const command = new ListObjectsV2Command({
				Bucket: this.bucketName,
				MaxKeys: 1,
			})

			await this.client.send(command)

			return {
				success: true,
				responseTime: Date.now() - startTime,
				details: {
					bucket: this.bucketName,
					region: this.config.region,
				},
			}
		} catch (error: any) {
			return {
				success: false,
				responseTime: Date.now() - startTime,
				error: this.handleS3Error(error).message,
				details: {
					bucket: this.bucketName,
					region: this.config?.region,
					errorCode: error.name || error.Code,
				},
			}
		}
	}

	/**
	 * Validate S3 configuration
	 * Requirements 1.2, 1.3, 1.4, 10.2, 10.4: Configuration validation
	 */
	validateConfig(storageConfig: StorageConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		if (storageConfig.provider !== 's3') {
			errors.push('Provider must be "s3" for S3StorageProvider')
			return { isValid: false, errors, warnings }
		}

		const config = storageConfig.config as S3StorageConfig

		// Required fields
		if (!config.bucket) {
			errors.push('S3 bucket name is required')
		} else {
			// Validate bucket name format
			if (!/^[a-z0-9.-]{3,63}$/.test(config.bucket)) {
				errors.push(
					'S3 bucket name must be 3-63 characters long and contain only lowercase letters, numbers, dots, and hyphens'
				)
			}
			if (config.bucket.startsWith('.') || config.bucket.endsWith('.')) {
				errors.push('S3 bucket name cannot start or end with a dot')
			}
			if (config.bucket.includes('..')) {
				errors.push('S3 bucket name cannot contain consecutive dots')
			}
		}

		if (!config.region) {
			errors.push('S3 region is required')
		} else if (!/^[a-z0-9-]+$/.test(config.region)) {
			errors.push('S3 region format is invalid')
		}

		// Authentication validation
		const hasAccessKey = config.accessKeyId && config.secretAccessKey
		const hasSessionToken = config.sessionToken

		if (hasAccessKey) {
			if (!config.accessKeyId || config.accessKeyId.length < 16) {
				errors.push('S3 access key ID must be at least 16 characters')
			}
			if (!config.secretAccessKey || config.secretAccessKey.length < 40) {
				errors.push('S3 secret access key must be at least 40 characters')
			}
		} else {
			warnings.push(
				'No explicit credentials provided - will use IAM roles, environment variables, or AWS config'
			)
		}

		if (hasSessionToken && !hasAccessKey) {
			errors.push('Session token requires access key ID and secret access key')
		}

		// Storage class validation
		if (config.storageClass) {
			const validStorageClasses = [
				'STANDARD',
				'REDUCED_REDUNDANCY',
				'STANDARD_IA',
				'ONEZONE_IA',
				'INTELLIGENT_TIERING',
				'GLACIER',
				'DEEP_ARCHIVE',
			]
			if (!validStorageClasses.includes(config.storageClass)) {
				errors.push(`Invalid S3 storage class: ${config.storageClass}`)
			}
		}

		// Server-side encryption validation
		if (config.serverSideEncryption) {
			if (!['AES256', 'aws:kms'].includes(config.serverSideEncryption.algorithm)) {
				errors.push('S3 server-side encryption algorithm must be "AES256" or "aws:kms"')
			}
			if (
				config.serverSideEncryption.algorithm === 'aws:kms' &&
				!config.serverSideEncryption.kmsKeyId
			) {
				warnings.push('KMS key ID recommended when using aws:kms encryption')
			}
		}

		// Endpoint validation for S3-compatible services
		if (config.endpoint) {
			try {
				new URL(config.endpoint)
			} catch {
				errors.push('S3 endpoint must be a valid URL')
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	/**
	 * Upload object to S3
	 * Requirements 2.1: File upload with metadata and tags
	 */
	async upload(
		key: string,
		data: Buffer | string,
		metadata?: Record<string, string>
	): Promise<StorageUploadResult> {
		try {
			if (!this.client || !this.config) {
				throw new StorageError('S3 client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')

			const putObjectInput: PutObjectCommandInput = {
				Bucket: this.bucketName,
				Key: key,
				Body: buffer,
				ContentLength: buffer.length,
				Metadata: metadata,
			}

			// Add storage class if configured
			if (this.config.storageClass) {
				putObjectInput.StorageClass = this.config.storageClass
			}

			// Add server-side encryption if configured
			if (this.config.serverSideEncryption) {
				putObjectInput.ServerSideEncryption = this.config.serverSideEncryption.algorithm
				if (this.config.serverSideEncryption.kmsKeyId) {
					putObjectInput.SSEKMSKeyId = this.config.serverSideEncryption.kmsKeyId
				}
			}

			// Set content type based on data
			if (typeof data === 'string' || this.isJsonData(buffer)) {
				putObjectInput.ContentType = 'application/json'
			} else {
				putObjectInput.ContentType = 'application/octet-stream'
			}

			const command = new PutObjectCommand(putObjectInput)
			const response = await this.client.send(command)

			// Generate URL for the uploaded object
			const url = this.config.endpoint
				? `${this.config.endpoint}/${this.bucketName}/${key}`
				: `https://${this.bucketName}.s3.${this.config.region}.amazonaws.com/${key}`

			return {
				key,
				url,
				etag: response.ETag,
				versionId: response.VersionId,
				size: buffer.length,
				metadata,
			}
		} catch (error: any) {
			throw this.handleS3Error(error)
		}
	}

	/**
	 * Download object from S3
	 */
	async download(key: string): Promise<StorageDownloadResult> {
		try {
			if (!this.client) {
				throw new StorageError('S3 client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			const response = await this.client.send(command)

			if (!response.Body) {
				throw new StorageNotFoundError(key, 's3')
			}

			// Convert stream to buffer
			const chunks: Uint8Array[] = []
			const stream = response.Body as any

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const data = Buffer.concat(chunks)

			return {
				data,
				metadata: response.Metadata,
				lastModified: response.LastModified,
				contentType: response.ContentType,
				size: data.length,
			}
		} catch (error: any) {
			throw this.handleS3Error(error)
		}
	}

	/**
	 * Delete object from S3
	 */
	async delete(key: string): Promise<void> {
		try {
			if (!this.client) {
				throw new StorageError('S3 client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const command = new DeleteObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			await this.client.send(command)
		} catch (error: any) {
			throw this.handleS3Error(error)
		}
	}

	/**
	 * Check if object exists in S3
	 */
	async exists(key: string): Promise<boolean> {
		try {
			if (!this.client) {
				throw new StorageError('S3 client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const command = new HeadObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			})

			await this.client.send(command)
			return true
		} catch (error: any) {
			if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
				return false
			}
			throw this.handleS3Error(error)
		}
	}

	/**
	 * List objects in S3
	 */
	async listObjects(prefix?: string, maxKeys?: number): Promise<StorageListResult> {
		try {
			if (!this.client) {
				throw new StorageError('S3 client not initialized', 'NOT_INITIALIZED', 500, false)
			}

			const command = new ListObjectsV2Command({
				Bucket: this.bucketName,
				Prefix: prefix,
				MaxKeys: maxKeys || 1000,
			})

			const response = await this.client.send(command)

			const objects: StorageObjectInfo[] = (response.Contents || []).map((obj) => ({
				key: obj.Key!,
				size: obj.Size || 0,
				lastModified: obj.LastModified || new Date(),
				etag: obj.ETag,
				storageClass: obj.StorageClass,
			}))

			return {
				objects,
				isTruncated: response.IsTruncated || false,
				nextContinuationToken: response.NextContinuationToken,
			}
		} catch (error: any) {
			throw this.handleS3Error(error)
		}
	}

	/**
	 * Get provider information
	 */
	getProviderInfo() {
		return {
			name: 'AWS S3',
			version: '3.x',
			features: [
				'server-side-encryption',
				'storage-classes',
				'versioning',
				'lifecycle-policies',
				'cross-region-replication',
			],
		}
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		if (this.client) {
			this.client.destroy()
			this.client = null
		}
		this.config = null
		this.bucketName = ''
	}

	/**
	 * Handle S3-specific errors and convert to storage errors
	 * Requirements: S3-specific error handling and retry logic
	 */
	private handleS3Error(error: any): StorageError {
		const errorCode = error.name || error.Code || 'UNKNOWN_ERROR'
		const message = error.message || 'Unknown S3 error'
		const statusCode = error.$metadata?.httpStatusCode || 0

		switch (errorCode) {
			case 'NoSuchBucket':
			case 'NoSuchKey':
			case 'NotFound':
				return new StorageNotFoundError(message, 's3')

			case 'AccessDenied':
			case 'InvalidAccessKeyId':
			case 'SignatureDoesNotMatch':
			case 'TokenRefreshRequired':
				return new StorageAuthenticationError(message, 's3')

			case 'QuotaExceeded':
			case 'ServiceQuotaExceeded':
				return new StorageQuotaExceededError('s3')

			case 'NetworkingError':
			case 'TimeoutError':
			case 'ConnectionError':
				return new StorageNetworkError(message, 's3')

			case 'ThrottlingException':
			case 'RequestLimitExceeded':
				return new StorageError(
					`S3 rate limit exceeded: ${message}`,
					'RATE_LIMIT_EXCEEDED',
					statusCode,
					true
				)

			case 'InternalError':
			case 'ServiceUnavailable':
				return new StorageError(`S3 service error: ${message}`, 'SERVICE_ERROR', statusCode, true)

			default:
				// Determine if error is retryable based on status code
				const retryable = statusCode >= 500 || statusCode === 429 || statusCode === 0
				return new StorageError(`S3 error: ${message}`, errorCode, statusCode, retryable)
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
 * Create and initialize S3 storage provider
 */
export function createS3StorageProvider(): S3StorageProvider {
	return new S3StorageProvider()
}
