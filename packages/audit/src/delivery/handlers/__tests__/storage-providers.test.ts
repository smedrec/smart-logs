/**
 * Storage providers unit tests
 * Requirements 1.1, 10.2, 10.4, 2.1: Storage provider testing for authentication and operations
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AzureStorageProvider } from '../storage-providers/azure-provider.js'
import { GCPStorageProvider } from '../storage-providers/gcp-provider.js'
import {
	createStorageProvider,
	getAvailableProviders,
	StorageProviderRegistry,
} from '../storage-providers/index.js'
import { LocalStorageProvider } from '../storage-providers/local-provider.js'
import { S3StorageProvider } from '../storage-providers/s3-provider.js'

import type { StorageConfig } from '../storage-handler.js'

describe('S3StorageProvider', () => {
	let provider: S3StorageProvider

	beforeEach(() => {
		provider = new S3StorageProvider()
	})

	afterEach(async () => {
		await provider.cleanup()
	})

	describe('Configuration Validation', () => {
		it('should validate valid S3 configuration', () => {
			const config: StorageConfig = {
				provider: 's3',
				config: {
					bucket: 'test-bucket',
					region: 'us-east-1',
					accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
					secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
				},
				path: 'uploads/{organizationId}',
				retention: { days: 30, autoCleanup: true },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should fail validation for invalid bucket name', () => {
			const config: StorageConfig = {
				provider: 's3',
				config: {
					bucket: 'Invalid-Bucket-Name',
					region: 'us-east-1',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('bucket name'))).toBe(true)
		})

		it('should fail validation for missing required fields', () => {
			const config: StorageConfig = {
				provider: 's3',
				config: {},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('S3 bucket name is required')
			expect(result.errors).toContain('S3 region is required')
		})

		it('should validate storage class options', () => {
			const config: StorageConfig = {
				provider: 's3',
				config: {
					bucket: 'test-bucket',
					region: 'us-east-1',
					storageClass: 'INVALID_CLASS' as any,
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('Invalid S3 storage class'))).toBe(true)
		})

		it('should validate server-side encryption configuration', () => {
			const config: StorageConfig = {
				provider: 's3',
				config: {
					bucket: 'test-bucket',
					region: 'us-east-1',
					serverSideEncryption: {
						algorithm: 'invalid' as any,
					},
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('encryption algorithm'))).toBe(true)
		})

		it('should warn about missing credentials', () => {
			const config: StorageConfig = {
				provider: 's3',
				config: {
					bucket: 'test-bucket',
					region: 'us-east-1',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings.some((w) => w.includes('No explicit credentials'))).toBe(true)
		})
	})

	describe('Provider Information', () => {
		it('should return correct provider information', () => {
			const info = provider.getProviderInfo()

			expect(info.name).toBe('AWS S3')
			expect(info.version).toBe('3.x')
			expect(info.features).toContain('server-side-encryption')
			expect(info.features).toContain('storage-classes')
		})
	})
})

describe('AzureStorageProvider', () => {
	let provider: AzureStorageProvider

	beforeEach(() => {
		provider = new AzureStorageProvider()
	})

	afterEach(async () => {
		await provider.cleanup()
	})

	describe('Configuration Validation', () => {
		it('should validate valid Azure configuration', () => {
			const config: StorageConfig = {
				provider: 'azure',
				config: {
					accountName: 'teststorage',
					accountKey:
						'dGVzdGtleWZvcmF6dXJlc3RvcmFnZWFjY291bnR0aGF0aXNsb25nZW5vdWdodG9wYXNzdmFsaWRhdGlvbg==',
					containerName: 'test-container',
				},
				path: 'uploads/{organizationId}',
				retention: { days: 30, autoCleanup: true },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should fail validation for invalid account name', () => {
			const config: StorageConfig = {
				provider: 'azure',
				config: {
					accountName: 'Invalid-Account-Name',
					containerName: 'test-container',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('account name'))).toBe(true)
		})

		it('should fail validation for invalid container name', () => {
			const config: StorageConfig = {
				provider: 'azure',
				config: {
					accountName: 'teststorage',
					containerName: 'Invalid-Container-Name',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('container name'))).toBe(true)
		})

		it('should require at least one authentication method', () => {
			const config: StorageConfig = {
				provider: 'azure',
				config: {
					accountName: 'teststorage',
					containerName: 'test-container',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('authentication method'))).toBe(true)
		})

		it('should validate access tier options', () => {
			const config: StorageConfig = {
				provider: 'azure',
				config: {
					accountName: 'teststorage',
					accountKey: 'validkey',
					containerName: 'test-container',
					accessTier: 'Invalid' as any,
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('access tier'))).toBe(true)
		})
	})

	describe('Provider Information', () => {
		it('should return correct provider information', () => {
			const info = provider.getProviderInfo()

			expect(info.name).toBe('Azure Blob Storage')
			expect(info.version).toBe('12.x')
			expect(info.features).toContain('access-tiers')
			expect(info.features).toContain('lifecycle-management')
		})
	})
})

describe('GCPStorageProvider', () => {
	let provider: GCPStorageProvider

	beforeEach(() => {
		provider = new GCPStorageProvider()
	})

	afterEach(async () => {
		await provider.cleanup()
	})

	describe('Configuration Validation', () => {
		it('should validate valid GCP configuration', () => {
			const config: StorageConfig = {
				provider: 'gcp',
				config: {
					projectId: 'test-project-123',
					bucket: 'test-bucket',
					keyFilename: '/path/to/service-account.json',
				},
				path: 'uploads/{organizationId}',
				retention: { days: 30, autoCleanup: true },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should fail validation for invalid project ID', () => {
			const config: StorageConfig = {
				provider: 'gcp',
				config: {
					projectId: 'Invalid_Project_ID',
					bucket: 'test-bucket',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('project ID'))).toBe(true)
		})

		it('should fail validation for invalid bucket name', () => {
			const config: StorageConfig = {
				provider: 'gcp',
				config: {
					projectId: 'test-project',
					bucket: 'google-invalid-bucket',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(
				result.errors.some((e) => e.includes('cannot start with "goog" or contain "google"'))
			).toBe(true)
		})

		it('should validate credentials object', () => {
			const config: StorageConfig = {
				provider: 'gcp',
				config: {
					projectId: 'test-project',
					bucket: 'test-bucket',
					credentials: {
						type: 'service_account',
						// Missing required fields
					},
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('missing required field'))).toBe(true)
		})

		it('should validate storage class options', () => {
			const config: StorageConfig = {
				provider: 'gcp',
				config: {
					projectId: 'test-project',
					bucket: 'test-bucket',
					storageClass: 'INVALID_CLASS' as any,
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('Invalid GCP storage class'))).toBe(true)
		})
	})

	describe('Provider Information', () => {
		it('should return correct provider information', () => {
			const info = provider.getProviderInfo()

			expect(info.name).toBe('Google Cloud Storage')
			expect(info.version).toBe('7.x')
			expect(info.features).toContain('storage-classes')
			expect(info.features).toContain('lifecycle-management')
		})
	})
})

describe('LocalStorageProvider', () => {
	let provider: LocalStorageProvider

	beforeEach(() => {
		provider = new LocalStorageProvider()
	})

	afterEach(async () => {
		await provider.cleanup()
	})

	describe('Configuration Validation', () => {
		it('should validate valid local configuration', () => {
			const config: StorageConfig = {
				provider: 'local',
				config: {
					basePath: '/tmp/test-storage',
					permissions: '0644',
					createDirectories: true,
				},
				path: 'uploads/{organizationId}',
				retention: { days: 30, autoCleanup: true },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should fail validation for path with security issues', () => {
			const config: StorageConfig = {
				provider: 'local',
				config: {
					basePath: '/tmp/../../../etc',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('cannot contain ".."'))).toBe(true)
		})

		it('should fail validation for invalid permissions format', () => {
			const config: StorageConfig = {
				provider: 'local',
				config: {
					basePath: '/tmp/test',
					permissions: '999',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.includes('octal format'))).toBe(true)
		})

		it('should warn about relative paths', () => {
			const config: StorageConfig = {
				provider: 'local',
				config: {
					basePath: './relative/path',
				},
				path: 'test',
				retention: { days: 1, autoCleanup: false },
			}

			const result = provider.validateConfig(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings.some((w) => w.includes('Relative paths'))).toBe(true)
		})
	})

	describe('Provider Information', () => {
		it('should return correct provider information', () => {
			const info = provider.getProviderInfo()

			expect(info.name).toBe('Local Filesystem')
			expect(info.version).toBe('1.0')
			expect(info.features).toContain('file-permissions')
			expect(info.features).toContain('metadata-files')
		})
	})
})

describe('Storage Provider Factory', () => {
	describe('createStorageProvider', () => {
		it('should create S3 provider', () => {
			const provider = createStorageProvider('s3')
			expect(provider).toBeInstanceOf(S3StorageProvider)
			expect(provider.provider).toBe('s3')
		})

		it('should create Azure provider', () => {
			const provider = createStorageProvider('azure')
			expect(provider).toBeInstanceOf(AzureStorageProvider)
			expect(provider.provider).toBe('azure')
		})

		it('should create GCP provider', () => {
			const provider = createStorageProvider('gcp')
			expect(provider).toBeInstanceOf(GCPStorageProvider)
			expect(provider.provider).toBe('gcp')
		})

		it('should create local provider', () => {
			const provider = createStorageProvider('local')
			expect(provider).toBeInstanceOf(LocalStorageProvider)
			expect(provider.provider).toBe('local')
		})

		it('should throw error for unsupported provider', () => {
			expect(() => createStorageProvider('unsupported' as any)).toThrow(
				'Unsupported storage provider'
			)
		})
	})

	describe('getAvailableProviders', () => {
		it('should return all available providers', () => {
			const providers = getAvailableProviders()
			expect(providers).toEqual(['s3', 'azure', 'gcp', 'local'])
		})
	})
})

describe('StorageProviderRegistry', () => {
	let registry: StorageProviderRegistry

	beforeEach(() => {
		registry = new StorageProviderRegistry()
	})

	it('should have default providers registered', () => {
		const providers = registry.getRegisteredProviders()
		expect(providers).toContain('s3')
		expect(providers).toContain('azure')
		expect(providers).toContain('gcp')
		expect(providers).toContain('local')
	})

	it('should create provider instances', () => {
		const s3Provider = registry.create('s3')
		expect(s3Provider).toBeInstanceOf(S3StorageProvider)

		const azureProvider = registry.create('azure')
		expect(azureProvider).toBeInstanceOf(AzureStorageProvider)
	})

	it('should check if provider is registered', () => {
		expect(registry.has('s3')).toBe(true)
		expect(registry.has('nonexistent' as any)).toBe(false)
	})

	it('should allow registering custom providers', () => {
		const customFactory = () => new LocalStorageProvider()
		registry.register('custom' as any, customFactory)

		expect(registry.has('custom' as any)).toBe(true)
		const provider = registry.create('custom' as any)
		expect(provider).toBeInstanceOf(LocalStorageProvider)
	})

	it('should throw error for unregistered provider', () => {
		expect(() => registry.create('unregistered' as any)).toThrow('not registered')
	})
})
