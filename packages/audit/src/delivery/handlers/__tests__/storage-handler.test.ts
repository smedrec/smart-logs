/**
 * Storage handler unit tests
 * Requirements 1.1, 10.2, 10.4, 2.1: Storage handler testing across providers
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createStorageHandler,
	createStorageHandlerWithProviders,
	StorageAuthenticationError,
	StorageError,
	StorageHandler,
	StorageNetworkError,
	StorageNotFoundError,
	StorageQuotaExceededError,
} from '../storage-handler.js'

import type { DeliveryPayload, DestinationConfig } from '../../types.js'
import type {
	IStorageProvider,
	StorageConfig,
	StorageDownloadResult,
	StorageListResult,
	StorageProvider,
	StorageUploadResult,
} from '../storage-handler.js'

// Mock storage provider for testing
class MockStorageProvider implements IStorageProvider {
	readonly provider: StorageProvider
	private isInitialized = false
	private shouldFailConnection = false
	private shouldFailUpload = false
	private shouldFailValidation = false
	private uploadResults = new Map<string, StorageUploadResult>()
	private downloadResults = new Map<string, Buffer>()

	constructor(provider: StorageProvider) {
		this.provider = provider
	}

	// Test control methods
	setConnectionFailure(shouldFail: boolean) {
		this.shouldFailConnection = shouldFail
	}

	setUploadFailure(shouldFail: boolean) {
		this.shouldFailUpload = shouldFail
	}

	setValidationFailure(shouldFail: boolean) {
		this.shouldFailValidation = shouldFail
	}

	setUploadResult(key: string, result: StorageUploadResult) {
		this.uploadResults.set(key, result)
	}

	setDownloadResult(key: string, data: Buffer) {
		this.downloadResults.set(key, data)
	}

	async initialize(config: StorageConfig): Promise<void> {
		this.isInitialized = true
	}

	async testConnection() {
		if (this.shouldFailConnection) {
			throw new StorageNetworkError('Connection failed', this.provider)
		}
		return {
			success: true,
			responseTime: 100,
			details: { provider: this.provider },
		}
	}

	validateConfig(config: StorageConfig) {
		if (this.shouldFailValidation) {
			return {
				isValid: false,
				errors: ['Mock validation error'],
				warnings: [],
			}
		}
		return {
			isValid: true,
			errors: [],
			warnings: [],
		}
	}

	async upload(
		key: string,
		data: Buffer | string,
		metadata?: Record<string, string>
	): Promise<StorageUploadResult> {
		if (this.shouldFailUpload) {
			throw new StorageError('Upload failed', 'UPLOAD_ERROR', 500, true)
		}

		const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')
		const result = this.uploadResults.get(key) || {
			key,
			url: `mock://${this.provider}/${key}`,
			etag: '"mock-etag"',
			size: buffer.length,
			metadata,
		}

		return result
	}

	async download(key: string): Promise<StorageDownloadResult> {
		const data = this.downloadResults.get(key)
		if (!data) {
			throw new StorageNotFoundError(key, this.provider)
		}

		return {
			data,
			metadata: { key },
			lastModified: new Date(),
			contentType: 'application/octet-stream',
			size: data.length,
		}
	}

	async delete(key: string): Promise<void> {
		this.downloadResults.delete(key)
	}

	async exists(key: string): Promise<boolean> {
		return this.downloadResults.has(key)
	}

	async listObjects(prefix?: string, maxKeys?: number): Promise<StorageListResult> {
		const objects = Array.from(this.downloadResults.keys())
			.filter((key) => !prefix || key.startsWith(prefix))
			.slice(0, maxKeys || 1000)
			.map((key) => ({
				key,
				size: this.downloadResults.get(key)?.length || 0,
				lastModified: new Date(),
				etag: '"mock-etag"',
			}))

		return {
			objects,
			isTruncated: false,
		}
	}

	getProviderInfo() {
		return {
			name: `Mock ${this.provider}`,
			version: '1.0.0',
			features: ['mock-feature'],
		}
	}

	async cleanup(): Promise<void> {
		this.isInitialized = false
		this.uploadResults.clear()
		this.downloadResults.clear()
	}
}

describe('StorageHandler', () => {
	let handler: StorageHandler
	let mockS3Provider: MockStorageProvider
	let mockAzureProvider: MockStorageProvider
	let mockLocalProvider: MockStorageProvider

	beforeEach(() => {
		handler = new StorageHandler()
		mockS3Provider = new MockStorageProvider('s3')
		mockAzureProvider = new MockStorageProvider('azure')
		mockLocalProvider = new MockStorageProvider('local')

		handler.registerProvider(mockS3Provider)
		handler.registerProvider(mockAzureProvider)
		handler.registerProvider(mockLocalProvider)
	})

	afterEach(async () => {
		await mockS3Provider.cleanup()
		await mockAzureProvider.cleanup()
		await mockLocalProvider.cleanup()
	})

	describe('Configuration Validation', () => {
		it('should validate storage configuration successfully', () => {
			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {
						bucket: 'test-bucket',
						region: 'us-east-1',
					},
					path: 'uploads/{organizationId}/{deliveryId}',
					retention: {
						days: 30,
						autoCleanup: true,
					},
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should fail validation when storage config is missing', () => {
			const config: DestinationConfig = {}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Storage configuration is required')
		})

		it('should fail validation for unsupported provider', () => {
			const config: DestinationConfig = {
				storage: {
					provider: 'unsupported' as any,
					config: {},
					path: 'test',
					retention: { days: 1, autoCleanup: false },
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Unsupported storage provider: unsupported')
		})

		it('should fail validation for path with security issues', () => {
			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: '../../../etc/passwd',
					retention: { days: 1, autoCleanup: false },
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Storage path cannot contain ".." for security reasons')
		})

		it('should validate retention settings', () => {
			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: 'test',
					retention: { days: -1, autoCleanup: false },
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Retention days must be a non-negative number')
		})

		it('should include provider-specific validation errors', () => {
			mockS3Provider.setValidationFailure(true)

			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: 'test',
					retention: { days: 1, autoCleanup: false },
				},
			}

			const result = handler.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Mock validation error')
		})
	})

	describe('Connection Testing', () => {
		it('should test connection successfully', async () => {
			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: 'test',
					retention: { days: 1, autoCleanup: false },
				},
			}

			const result = await handler.testConnection(config)

			expect(result.success).toBe(true)
			expect(result.responseTime).toBeGreaterThanOrEqual(0)
			expect(result.details).toEqual({ provider: 's3' })
		})

		it('should handle connection failures', async () => {
			mockS3Provider.setConnectionFailure(true)

			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: 'test',
					retention: { days: 1, autoCleanup: false },
				},
			}

			const result = await handler.testConnection(config)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Connection failed')
		})

		it('should handle missing storage config', async () => {
			const config: DestinationConfig = {}

			const result = await handler.testConnection(config)

			expect(result.success).toBe(false)
			expect(result.error).toBe('Storage configuration is required')
		})
	})

	describe('Delivery Operations', () => {
		it('should deliver payload successfully', async () => {
			const payload: DeliveryPayload = {
				deliveryId: 'delivery-123',
				organizationId: 'org-456',
				type: 'report',
				data: { message: 'test data' },
				metadata: { source: 'test' },
			}

			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: 'uploads/{organizationId}/{deliveryId}.json',
					retention: { days: 30, autoCleanup: true },
					metadata: { environment: 'test' },
				},
			}

			const result = await handler.deliver(payload, config)

			expect(result.success).toBe(true)
			expect(result.deliveredAt).toBeDefined()
			expect(result.responseTime).toBeGreaterThanOrEqual(0)
			expect(result.crossSystemReference).toContain('org-456/delivery-123.json')
			expect(result.retryable).toBe(false)
		})

		it('should handle upload failures with retry logic', async () => {
			mockS3Provider.setUploadFailure(true)

			const payload: DeliveryPayload = {
				deliveryId: 'delivery-123',
				organizationId: 'org-456',
				type: 'report',
				data: 'test data',
				metadata: {},
			}

			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: 'uploads/{deliveryId}',
					retention: { days: 1, autoCleanup: false },
				},
			}

			const result = await handler.deliver(payload, config)

			expect(result.success).toBe(false)
			expect(result.error).toContain('Upload failed')
			expect(result.retryable).toBe(true)
		})

		it('should generate correct storage keys from templates', async () => {
			const payload: DeliveryPayload = {
				deliveryId: 'delivery-123',
				organizationId: 'org-456',
				type: 'export',
				data: 'test',
				metadata: {},
			}

			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: '{organizationId}/{type}/{year}/{month}/{deliveryId}',
					retention: { days: 1, autoCleanup: false },
				},
			}

			// Mock the upload to capture the generated key
			let capturedKey = ''
			mockS3Provider.upload = vi.fn().mockImplementation(async (key: string) => {
				capturedKey = key
				return {
					key,
					url: `mock://s3/${key}`,
					etag: '"test"',
					size: 4,
				}
			})

			await handler.deliver(payload, config)

			const now = new Date()
			const expectedKey = `org-456/export/${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/delivery-123`
			expect(capturedKey).toBe(expectedKey)
		})

		it('should prepare different data types for upload', async () => {
			const testCases = [
				{
					data: Buffer.from('binary data'),
					expectedType: Buffer,
				},
				{
					data: 'string data',
					expectedType: Buffer,
				},
				{
					data: { object: 'data' },
					expectedType: Buffer,
				},
			]

			for (const testCase of testCases) {
				const payload: DeliveryPayload = {
					deliveryId: 'test',
					organizationId: 'test',
					type: 'test',
					data: testCase.data,
					metadata: {},
				}

				const config: DestinationConfig = {
					storage: {
						provider: 's3',
						config: {},
						path: 'test',
						retention: { days: 1, autoCleanup: false },
					},
				}

				let capturedData: Buffer | string | undefined
				mockS3Provider.upload = vi
					.fn()
					.mockImplementation(async (key: string, data: Buffer | string) => {
						capturedData = data
						return {
							key,
							url: `mock://s3/${key}`,
							etag: '"test"',
							size: Buffer.isBuffer(data) ? data.length : Buffer.from(data, 'utf-8').length,
						}
					})

				await handler.deliver(payload, config)

				expect(capturedData).toBeInstanceOf(testCase.expectedType)
			}
		})

		it('should include metadata in uploads', async () => {
			const payload: DeliveryPayload = {
				deliveryId: 'delivery-123',
				organizationId: 'org-456',
				type: 'report',
				data: 'test',
				metadata: { custom: 'value' },
				correlationId: 'corr-789',
				idempotencyKey: 'idem-abc',
			}

			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: 'test',
					retention: { days: 1, autoCleanup: false },
					metadata: { environment: 'test' },
				},
			}

			let capturedMetadata: Record<string, string> | undefined
			mockS3Provider.upload = vi
				.fn()
				.mockImplementation(
					async (key: string, data: Buffer | string, metadata?: Record<string, string>) => {
						capturedMetadata = metadata
						return {
							key,
							url: `mock://s3/${key}`,
							etag: '"test"',
							size: 4,
							metadata,
						}
					}
				)

			await handler.deliver(payload, config)

			expect(capturedMetadata).toMatchObject({
				deliveryId: 'delivery-123',
				organizationId: 'org-456',
				type: 'report',
				correlationId: 'corr-789',
				idempotencyKey: 'idem-abc',
				environment: 'test',
				custom: 'value',
			})
			expect(capturedMetadata?.uploadedAt).toBeDefined()
		})
	})

	describe('Feature Support', () => {
		it('should support expected features', () => {
			expect(handler.supportsFeature('retry_with_backoff')).toBe(true)
			expect(handler.supportsFeature('encryption')).toBe(true)
			expect(handler.supportsFeature('compression')).toBe(true)
			expect(handler.supportsFeature('batch_delivery')).toBe(true)
			expect(handler.supportsFeature('unsupported_feature')).toBe(false)
		})
	})

	describe('Configuration Schema', () => {
		it('should return valid JSON schema', () => {
			const schema = handler.getConfigSchema()

			expect(schema).toHaveProperty('type', 'object')
			expect(schema.properties).toHaveProperty('storage')
			expect(schema.properties.storage.properties).toHaveProperty('provider')
			expect(schema.properties.storage.properties.provider.enum).toContain('s3')
			expect(schema.properties.storage.properties.provider.enum).toContain('azure')
			expect(schema.properties.storage.properties.provider.enum).toContain('gcp')
			expect(schema.properties.storage.properties.provider.enum).toContain('local')
		})
	})

	describe('Error Handling', () => {
		it('should handle provider not found errors', async () => {
			const config: DestinationConfig = {
				storage: {
					provider: 'nonexistent' as any,
					config: {},
					path: 'test',
					retention: { days: 1, autoCleanup: false },
				},
			}

			const payload: DeliveryPayload = {
				deliveryId: 'test',
				organizationId: 'test',
				type: 'test',
				data: 'test',
				metadata: {},
			}

			const result = await handler.deliver(payload, config)

			expect(result.success).toBe(false)
			expect(result.error).toContain('not registered')
			expect(result.retryable).toBe(false)
		})

		it('should handle missing storage config in delivery', async () => {
			const config: DestinationConfig = {}

			const payload: DeliveryPayload = {
				deliveryId: 'test',
				organizationId: 'test',
				type: 'test',
				data: 'test',
				metadata: {},
			}

			const result = await handler.deliver(payload, config)

			expect(result.success).toBe(false)
			expect(result.error).toBe('Storage configuration is required')
			expect(result.retryable).toBe(false)
		})

		it('should classify network errors as retryable', async () => {
			mockS3Provider.upload = vi
				.fn()
				.mockRejectedValue(new StorageNetworkError('Network timeout', 's3'))

			const payload: DeliveryPayload = {
				deliveryId: 'test',
				organizationId: 'test',
				type: 'test',
				data: 'test',
				metadata: {},
			}

			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: 'test',
					retention: { days: 1, autoCleanup: false },
				},
			}

			const result = await handler.deliver(payload, config)

			expect(result.success).toBe(false)
			expect(result.retryable).toBe(true)
		})

		it('should classify authentication errors as non-retryable', async () => {
			mockS3Provider.upload = vi
				.fn()
				.mockRejectedValue(new StorageAuthenticationError('Invalid credentials', 's3'))

			const payload: DeliveryPayload = {
				deliveryId: 'test',
				organizationId: 'test',
				type: 'test',
				data: 'test',
				metadata: {},
			}

			const config: DestinationConfig = {
				storage: {
					provider: 's3',
					config: {},
					path: 'test',
					retention: { days: 1, autoCleanup: false },
				},
			}

			const result = await handler.deliver(payload, config)

			expect(result.success).toBe(false)
			expect(result.retryable).toBe(false)
		})
	})
})

describe('Storage Error Classes', () => {
	it('should create StorageError with correct properties', () => {
		const error = new StorageError('Test message', 'TEST_CODE', 500, true)

		expect(error.message).toBe('Test message')
		expect(error.code).toBe('TEST_CODE')
		expect(error.statusCode).toBe(500)
		expect(error.retryable).toBe(true)
		expect(error.name).toBe('StorageError')
	})

	it('should create StorageAuthenticationError', () => {
		const error = new StorageAuthenticationError('Auth failed', 's3')

		expect(error.message).toBe('Authentication failed for s3: Auth failed')
		expect(error.code).toBe('AUTHENTICATION_ERROR')
		expect(error.statusCode).toBe(401)
		expect(error.retryable).toBe(false)
		expect(error.name).toBe('StorageAuthenticationError')
	})

	it('should create StorageNotFoundError', () => {
		const error = new StorageNotFoundError('test-key', 's3')

		expect(error.message).toBe('Object not found: test-key in s3')
		expect(error.code).toBe('NOT_FOUND')
		expect(error.statusCode).toBe(404)
		expect(error.retryable).toBe(false)
		expect(error.name).toBe('StorageNotFoundError')
	})

	it('should create StorageQuotaExceededError', () => {
		const error = new StorageQuotaExceededError('s3')

		expect(error.message).toBe('Storage quota exceeded for s3')
		expect(error.code).toBe('QUOTA_EXCEEDED')
		expect(error.statusCode).toBe(413)
		expect(error.retryable).toBe(false)
		expect(error.name).toBe('StorageQuotaExceededError')
	})

	it('should create StorageNetworkError', () => {
		const error = new StorageNetworkError('Connection timeout', 's3')

		expect(error.message).toBe('Network error for s3: Connection timeout')
		expect(error.code).toBe('NETWORK_ERROR')
		expect(error.statusCode).toBe(0)
		expect(error.retryable).toBe(true)
		expect(error.name).toBe('StorageNetworkError')
	})
})

describe('Storage Handler Factory Functions', () => {
	it('should create storage handler with default configuration', () => {
		const handler = createStorageHandler()

		expect(handler).toBeInstanceOf(StorageHandler)
		expect(handler.type).toBe('storage')
	})

	it('should create storage handler with specific providers', () => {
		const handler = createStorageHandlerWithProviders(['s3', 'local'])

		expect(handler).toBeInstanceOf(StorageHandler)
		expect(handler.type).toBe('storage')
	})
})
